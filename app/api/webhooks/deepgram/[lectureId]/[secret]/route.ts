import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/client';

export const maxDuration = 60;
const DEEPGRAM_WEBHOOK_SECRET = process.env.DEEPGRAM_WEBHOOK_SECRET || '';
const NEXT_PUBLIC_SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || '';

async function logWebhookEvent(entry: { lectureId: string | null; outcome: string; transcriptLength?: number | null; error?: string | null; rawPayload?: any }) {
  try {
    await supabaseAdmin.from('deepgram_webhook_logs').insert({ lecture_id: entry.lectureId, outcome: entry.outcome, transcript_length: entry.transcriptLength ?? null, error: entry.error ?? null, raw_payload: entry.rawPayload ?? null });
  } catch (logError) { console.error('Failed to write deepgram webhook log:', logError); }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ lectureId: string; secret: string }> }) {
  const { lectureId, secret } = await params;
  if (!DEEPGRAM_WEBHOOK_SECRET || secret !== DEEPGRAM_WEBHOOK_SECRET) {
    await logWebhookEvent({ lectureId, outcome: 'unauthorized', error: 'Invalid or missing secret' });
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  if (!lectureId) return NextResponse.json({ error: 'missing_lecture_id' }, { status: 400 });

  let payload: any = null;
  try {
    payload = await request.json();
    const { data: existingLecture, error: lectureLookupError } = await supabaseAdmin.from('lectures')
      .select('id, status, title, transcription_status, mime_type').eq('id', lectureId).single();
    if (lectureLookupError || !existingLecture) {
      await logWebhookEvent({ lectureId, outcome: 'lecture_not_found', error: lectureLookupError?.message });
      return NextResponse.json({ error: 'lecture_not_found' }, { status: 404 });
    }
    if (existingLecture.status === 'completed') {
      await logWebhookEvent({ lectureId, outcome: 'duplicate_callback_ignored' });
      return NextResponse.json({ success: true });
    }

    const deepgramError = payload?.err_msg || payload?.error || payload?.err_code;
    const alternative = payload?.results?.channels?.[0]?.alternatives?.[0];
    const transcript = String(alternative?.transcript || '').trim();
    const confidence = typeof alternative?.confidence === 'number' ? alternative.confidence : null;
    if (!transcript) {
      const reason = deepgramError ? `Deepgram error: ${deepgramError}` : 'Deepgram returned no transcript';
      await markLectureFailed(lectureId, 'NO_TRANSCRIPT', reason);
      await logWebhookEvent({ lectureId, outcome: 'no_transcript', error: reason, rawPayload: payload });
      await notifyStudent(lectureId, 'failed');
      return NextResponse.json({ success: true });
    }

    const modelUsed = String(existingLecture.mime_type || '').startsWith('video/') ? 'deepgram-nova-2-video' : 'deepgram-nova-2';
    const { error: transcriptionUpsertError } = await supabaseAdmin.from('transcriptions').upsert({
      lecture_id: lectureId,
      content: transcript,
      word_count: transcript.split(/\s+/).filter(Boolean).length,
      model_used: modelUsed,
      language: 'en',
      confidence_score: confidence,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'lecture_id' });
    if (transcriptionUpsertError) {
      await markLectureFailed(lectureId, 'TRANSCRIPT_PERSIST_FAILED', transcriptionUpsertError.message);
      await logWebhookEvent({ lectureId, outcome: 'transcript_persist_failed', transcriptLength: transcript.length, error: transcriptionUpsertError.message });
      return NextResponse.json({ error: 'transcript_persist_failed' }, { status: 500 });
    }

    const { data: claimedLecture, error: claimError } = await supabaseAdmin.from('lectures').update({
      transcription: transcript,
      transcription_status: 'completed',
      has_transcription: true,
      transcription_completed_at: new Date().toISOString(),
      processing_error_code: null,
    }).eq('id', lectureId).eq('status', 'processing').eq('transcription_status', 'processing')
      .select('user_id, module_id, title').maybeSingle();
    if (claimError) {
      await logWebhookEvent({ lectureId, outcome: 'transcript_claim_failed', error: claimError.message });
      return NextResponse.json({ error: 'claim_failed' }, { status: 500 });
    }
    if (!claimedLecture) {
      await logWebhookEvent({ lectureId, outcome: 'duplicate_callback_ignored_after_transcript_save' });
      return NextResponse.json({ success: true });
    }

    const isGenericTitle = /^Lecture \d+$/.test(claimedLecture.title || '');
    let summary = '';
    let summaryDegraded = false;
    let summaryError: string | null = null;
    try {
      const summaryResponse = await fetch(`${NEXT_PUBLIC_SITE_URL}/api/generate-summary`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ transcript }),
      });
      if (summaryResponse.ok) {
        const summaryData = await summaryResponse.json();
        summary = summaryData.summary || '';
        summaryDegraded = !!summaryData.degraded;
      } else summaryError = `generate-summary responded ${summaryResponse.status}`;
    } catch (err: any) { summaryError = `generate-summary threw: ${err?.message || 'unknown error'}`; }

    const generatedTitle = isGenericTitle ? await generateLectureTitle(transcript) : null;
    const updatePayload: Record<string, any> = {
      summary: summary || null,
      degraded: summaryDegraded || !!summaryError,
      status: 'completed',
      transcription_status: 'completed',
      has_transcription: true,
      transcription_completed_at: new Date().toISOString(),
      processing_error_code: summaryError ? 'SUMMARY_GENERATION_FAILED' : null,
    };
    if (generatedTitle) updatePayload.title = generatedTitle;

    const { data: updatedLecture, error: updateError } = await supabaseAdmin.from('lectures').update(updatePayload)
      .eq('id', lectureId).eq('status', 'processing').select('user_id, module_id').maybeSingle();
    if (updateError || !updatedLecture) {
      await logWebhookEvent({ lectureId, outcome: 'lecture_completion_update_failed', transcriptLength: transcript.length, error: updateError?.message || 'Lecture was no longer in processing state' });
      return NextResponse.json({ error: 'update_failed' }, { status: 500 });
    }

    if (updatedLecture.module_id) {
      const { error: creditError } = await supabaseAdmin.from('credits').insert({ user_id: updatedLecture.user_id, module_id: updatedLecture.module_id, lecture_id: lectureId, used_for: 'upload' });
      if (creditError && creditError.code !== '23505') {
        console.error('Error recording credit usage:', creditError);
        await logWebhookEvent({ lectureId, outcome: 'credit_record_failed', error: creditError.message });
      }
    }

    await logWebhookEvent({ lectureId, outcome: summaryError ? 'completed_without_summary' : 'completed', transcriptLength: transcript.length, error: summaryError });
    await notifyStudent(lectureId, 'completed', !!summaryError);
    await cleanupStorageFile(lectureId);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Deepgram webhook error:', error);
    await markLectureFailed(lectureId, 'WEBHOOK_EXCEPTION', error?.message || 'Webhook processing failed');
    await logWebhookEvent({ lectureId, outcome: 'exception', error: error?.message || 'unknown error', rawPayload: payload });
    await notifyStudent(lectureId, 'failed');
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }
}

async function generateLectureTitle(transcript: string): Promise<string | null> {
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
  if (!GEMINI_API_KEY) return null;
  const excerpt = transcript.slice(0, 4000);
  const prompt = `Based on this excerpt from a university lecture transcript, write a short, descriptive title (5-8 words) capturing the main topic covered. Return ONLY the title text — no quotes, no markdown, no trailing punctuation, no preamble or explanation.\n\nTranscript excerpt:\n${excerpt}`;
  try {
    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': GEMINI_API_KEY },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.3, maxOutputTokens: 30, thinkingConfig: { thinkingBudget: 0 } } }),
    });
    if (!response.ok) return null;
    const result = await response.json();
    const text = result.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    return text ? text.replace(/^["'*]+|["'*]+$/g, '').slice(0, 100) : null;
  } catch (err) { console.error('Title generation threw:', err); return null; }
}

async function markLectureFailed(lectureId: string, errorCode: string, reason: string) {
  try {
    await supabaseAdmin.from('lectures').update({ status: 'failed', transcription_status: 'failed', transcription_error: reason, processing_error_code: errorCode, transcription_failed_at: new Date().toISOString() }).eq('id', lectureId);
  } catch (err) { console.error('Failed to mark lecture as failed:', err); }
}

async function notifyStudent(lectureId: string, outcome: 'completed' | 'failed', degraded = false) {
  try {
    const { data: lecture } = await supabaseAdmin.from('lectures').select('user_id, title').eq('id', lectureId).single();
    if (!lecture) return;
    const title = outcome === 'completed' ? 'Your lecture notes are ready 🎉' : 'Lecture processing failed';
    const message = outcome === 'completed'
      ? (degraded ? `"${lecture.title}" has been transcribed. The transcript is ready, but AI notes could not be fully generated.` : `"${lecture.title}" has been transcribed and summarized — open it to start studying.`)
      : `We couldn't process "${lecture.title}". This didn't use up a credit — please try again.`;
    await supabaseAdmin.from('notifications').insert({ user_id: lecture.user_id, type: 'lecture_ready', title, message, metadata: { lecture_id: lectureId, outcome, degraded } });
  } catch (err) { console.error('Failed to send lecture-ready notification:', err); }
}

async function cleanupStorageFile(lectureId: string) {
  try {
    const { data: lecture } = await supabaseAdmin.from('lectures').select('file_path').eq('id', lectureId).single();
    if (!lecture?.file_path) return;
    const { error } = await supabaseAdmin.storage.from('lecture-media').remove([lecture.file_path]);
    if (error) console.error('Failed to clean up storage file:', error);
  } catch (err) { console.error('Failed to clean up storage file:', err); }
}
