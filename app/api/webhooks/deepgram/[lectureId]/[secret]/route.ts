import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/client';

const DEEPGRAM_WEBHOOK_SECRET = process.env.DEEPGRAM_WEBHOOK_SECRET || '';
const NEXT_PUBLIC_SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || '';

// Writes a row to deepgram_webhook_logs so this webhook's behavior can be
// inspected directly in Supabase's Table Editor, without needing access to
// Vercel's function logs. Never let a logging failure break the webhook itself.
async function logWebhookEvent(entry: {
  lectureId: string | null;
  outcome: string;
  transcriptLength?: number | null;
  error?: string | null;
  rawPayload?: any;
}) {
  try {
    await supabaseAdmin.from('deepgram_webhook_logs').insert({
      lecture_id: entry.lectureId,
      outcome: entry.outcome,
      transcript_length: entry.transcriptLength ?? null,
      error: entry.error ?? null,
      raw_payload: entry.rawPayload ?? null,
    });
  } catch (logError) {
    console.error('Failed to write deepgram webhook log:', logError);
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ lectureId: string; secret: string }> }
) {
  const { lectureId, secret } = await params;

  // Deepgram doesn't sign callback requests itself, so this shared secret
  // (embedded in the callback URL path we gave Deepgram) is what stops a
  // random internet request from spoofing a lecture completion.
  if (!DEEPGRAM_WEBHOOK_SECRET || secret !== DEEPGRAM_WEBHOOK_SECRET) {
    await logWebhookEvent({ lectureId, outcome: 'unauthorized', error: 'Invalid or missing secret' });
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  if (!lectureId) {
    await logWebhookEvent({ lectureId: null, outcome: 'missing_lecture_id' });
    return NextResponse.json({ error: 'missing_lecture_id' }, { status: 400 });
  }

  let payload: any = null;

  try {
    payload = await request.json();

    // Deepgram sends a different shape when it couldn't process the file at
    // all (e.g. couldn't fetch the URL, unsupported codec) — surface that
    // specific reason rather than a generic "no transcript" if present.
    const deepgramError = payload?.err_msg || payload?.error || payload?.err_code;
    const transcript = payload?.results?.channels?.[0]?.alternatives?.[0]?.transcript;

    if (!transcript) {
      const reason = deepgramError
        ? `Deepgram error: ${deepgramError}`
        : 'Deepgram returned no transcript';

      await markLectureFailed(lectureId, reason);
      await logWebhookEvent({ lectureId, outcome: 'no_transcript', error: reason, rawPayload: payload });
      await notifyStudent(lectureId, 'failed');
      await cleanupStorageFile(lectureId);
      return NextResponse.json({ success: true }); // ack regardless — nothing to retry
    }

    // Only generate an AI title for lectures still on the generic
    // "Lecture N" placeholder from a live recording — uploaded files keep
    // whatever title came from their filename, since that's often already
    // meaningful and shouldn't be silently overridden.
    const { data: currentLecture } = await supabaseAdmin
      .from('lectures')
      .select('title')
      .eq('id', lectureId)
      .single();

    const isGenericTitle = !!currentLecture?.title && /^Lecture \d+$/.test(currentLecture.title);

    // Generate the summary the same way the old synchronous flow did —
    // same endpoint, just called server-to-server now instead of from the
    // browser, since this webhook has no direct relationship to the
    // student's original request.
    let summary = '';
    let summaryError: string | null = null;
    try {
      const summaryResponse = await fetch(`${NEXT_PUBLIC_SITE_URL}/api/generate-summary`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript }),
      });

      if (summaryResponse.ok) {
        const summaryData = await summaryResponse.json();
        summary = summaryData.summary || '';
      } else {
        summaryError = `generate-summary responded ${summaryResponse.status}`;
      }
    } catch (err: any) {
      summaryError = `generate-summary threw: ${err.message}`;
    }

    // Title generation runs AFTER the summary call finishes, not in
    // parallel with it — generate-summary already fires up to 6 concurrent
    // Gemini calls of its own (map + reduce steps) against a per-minute
    // free-tier quota; adding a 7th on top of that during the same window
    // was contributing to rate-limit failures on longer lectures. This is
    // background processing the student never watches, so a few extra
    // seconds here costs nothing in practice.
    const generatedTitle = isGenericTitle ? await generateLectureTitle(transcript) : null;

    const updatePayload: Record<string, any> = {
      transcription: transcript,
      summary: summary || null,
      status: 'completed',
      transcription_status: 'completed',
      has_transcription: true,
      transcription_completed_at: new Date().toISOString(),
    };

    if (generatedTitle) {
      updatePayload.title = generatedTitle;
    }

    const { data: updatedLecture, error: updateError } = await supabaseAdmin
      .from('lectures')
      .update(updatePayload)
      .eq('id', lectureId)
      .select('user_id, module_id')
      .single();

    if (updateError || !updatedLecture) {
      await logWebhookEvent({
        lectureId,
        outcome: 'lecture_update_failed',
        transcriptLength: transcript.length,
        error: updateError?.message,
        rawPayload: payload,
      });
      return NextResponse.json({ error: 'update_failed' }, { status: 500 });
    }

    // Credit usage is recorded here, on success, not at upload time — a
    // lecture that fails processing shouldn't consume the student's credit.
    if (updatedLecture.module_id) {
      const { error: creditError } = await supabaseAdmin.from('credits').insert({
        user_id: updatedLecture.user_id,
        module_id: updatedLecture.module_id,
        lecture_id: lectureId,
        used_for: 'upload',
      });
      if (creditError) {
        console.error('Error recording credit usage:', creditError);
      }
    }

    await logWebhookEvent({
      lectureId,
      outcome: summaryError ? 'completed_without_summary' : 'completed',
      transcriptLength: transcript.length,
      error: summaryError,
      rawPayload: null, // no need to store the full payload on success — it's large and rarely needed
    });

    await notifyStudent(lectureId, 'completed');
    await cleanupStorageFile(lectureId);

    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error('Deepgram webhook error:', error);
    await markLectureFailed(lectureId, error.message);
    await logWebhookEvent({ lectureId, outcome: 'exception', error: error.message, rawPayload: payload });
    await notifyStudent(lectureId, 'failed');
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }
}

// Generates a short descriptive title from the transcript, used only to
// replace the generic "Lecture N" placeholder from a live recording. Uses
// just the first ~4000 chars — lecturers almost always establish the topic
// early, and this keeps the call small and fast rather than sending the
// full (potentially very long) transcript for a 5-8 word output.
async function generateLectureTitle(transcript: string): Promise<string | null> {
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
  if (!GEMINI_API_KEY) return null;

  const excerpt = transcript.slice(0, 4000);
  const prompt = `Based on this excerpt from a university lecture transcript, write a short, descriptive title (5-8 words) capturing the main topic covered. Return ONLY the title text — no quotes, no markdown, no trailing punctuation, no preamble or explanation.\n\nTranscript excerpt:\n${excerpt}`;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': GEMINI_API_KEY },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.3, maxOutputTokens: 30, thinkingConfig: { thinkingBudget: 0 } },
        }),
      }
    );

    if (!response.ok) {
      console.error('Title generation failed:', response.status, await response.text().catch(() => ''));
      return null;
    }

    const result = await response.json();
    const text = result.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    if (!text) return null;

    // Strip any stray quotes/markdown the model might add despite instructions,
    // and hard-cap length as a safety net.
    return text.replace(/^["'*]+|["'*]+$/g, '').slice(0, 100);
  } catch (err) {
    console.error('Title generation threw:', err);
    return null;
  }
}

async function markLectureFailed(lectureId: string, reason: string) {
  try {
    await supabaseAdmin
      .from('lectures')
      .update({
        status: 'failed',
        transcription_status: 'failed',
        transcription_error: reason,
        transcription_failed_at: new Date().toISOString(),
      })
      .eq('id', lectureId);
  } catch (err) {
    console.error('Failed to mark lecture as failed:', err);
  }
}

async function notifyStudent(lectureId: string, outcome: 'completed' | 'failed') {
  try {
    const { data: lecture } = await supabaseAdmin
      .from('lectures')
      .select('user_id, title')
      .eq('id', lectureId)
      .single();

    if (!lecture) return;

    const title = outcome === 'completed' ? 'Your lecture notes are ready 🎉' : 'Lecture processing failed';
    const message = outcome === 'completed'
      ? `"${lecture.title}" has been transcribed and summarized — open it to start studying.`
      : `We couldn't process "${lecture.title}". This didn't use up a credit — please try uploading it again.`;

    await supabaseAdmin.from('notifications').insert({
      user_id: lecture.user_id,
      type: 'lecture_ready',
      title,
      message,
      metadata: { lecture_id: lectureId, outcome },
    });
  } catch (err) {
    console.error('Failed to send lecture-ready notification:', err);
  }
}

// The raw uploaded file is only needed for Deepgram to fetch it — once
// processing finishes (successfully or not), it can be deleted to keep
// Supabase Storage usage bounded rather than growing with every upload.
async function cleanupStorageFile(lectureId: string) {
  try {
    const { data: lecture } = await supabaseAdmin
      .from('lectures')
      .select('file_path')
      .eq('id', lectureId)
      .single();

    if (!lecture?.file_path) return;

    const { error } = await supabaseAdmin.storage.from('lecture-media').remove([lecture.file_path]);
    if (error) {
      console.error('Failed to clean up storage file:', error);
    }
  } catch (err) {
    console.error('Failed to clean up storage file:', err);
  }
}