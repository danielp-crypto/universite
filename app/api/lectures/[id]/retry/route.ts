import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/client';

export const maxDuration = 60;

const DEEPGRAM_API_KEY = process.env.DEEPGRAM_API_KEY || '';
const NEXT_PUBLIC_SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || '';
const DEEPGRAM_WEBHOOK_SECRET = process.env.DEEPGRAM_WEBHOOK_SECRET || '';
const SIGNED_URL_EXPIRY_SECONDS = 6 * 60 * 60;
const MAX_PROCESSING_ATTEMPTS = 3;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ success: false, error: 'unauthorized' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'unauthorized' }, { status: 401 });
    }

    if (!DEEPGRAM_API_KEY || !NEXT_PUBLIC_SITE_URL || !DEEPGRAM_WEBHOOK_SECRET) {
      return NextResponse.json({ success: false, error: 'server_configuration_error' }, { status: 500 });
    }

    const { id: lectureId } = await params;
    const { data: lecture, error: fetchError } = await supabaseAdmin
      .from('lectures')
      .select('id, user_id, file_path, status, processing_attempts')
      .eq('id', lectureId)
      .single();

    if (fetchError || !lecture) {
      return NextResponse.json({ success: false, error: 'lecture_not_found' }, { status: 404 });
    }
    if (lecture.user_id !== user.id) {
      return NextResponse.json({ success: false, error: 'forbidden' }, { status: 403 });
    }
    if (lecture.status !== 'failed') {
      return NextResponse.json({ success: false, error: 'not_failed' }, { status: 400 });
    }
    if ((lecture.processing_attempts || 0) >= MAX_PROCESSING_ATTEMPTS) {
      return NextResponse.json({ success: false, error: 'retry_limit_reached' }, { status: 429 });
    }
    if (!lecture.file_path) {
      return NextResponse.json({ success: false, error: 'file_unavailable' }, { status: 409 });
    }

    const { data: signedUrlData, error: signedUrlError } = await supabaseAdmin
      .storage.from('lecture-media').createSignedUrl(lecture.file_path, SIGNED_URL_EXPIRY_SECONDS);

    if (signedUrlError || !signedUrlData?.signedUrl) {
      return NextResponse.json({ success: false, error: 'file_unavailable' }, { status: 409 });
    }

    const nextAttempt = (lecture.processing_attempts || 0) + 1;
    const { error: resetError } = await supabaseAdmin
      .from('lectures')
      .update({
        status: 'processing',
        transcription_status: 'processing',
        transcription_error: null,
        processing_error_code: null,
        processing_attempts: nextAttempt,
        transcription_started_at: new Date().toISOString(),
        transcription_completed_at: null,
        transcription_failed_at: null,
      })
      .eq('id', lectureId)
      .eq('status', 'failed');

    if (resetError) {
      console.error('Error resetting lecture for retry:', resetError);
      return NextResponse.json({ success: false, error: 'retry_failed' }, { status: 500 });
    }

    const callbackUrl = `${NEXT_PUBLIC_SITE_URL}/api/webhooks/deepgram/${lectureId}/${encodeURIComponent(DEEPGRAM_WEBHOOK_SECRET)}`;
    const deepgramParams = new URLSearchParams({
      callback: callbackUrl,
      callback_method: 'POST',
      model: 'nova-2',
      language: 'en-US',
      smart_format: 'true',
      punctuate: 'true',
      utterances: 'true',
    });

    try {
      const deepgramResponse = await fetch(`https://api.deepgram.com/v1/listen?${deepgramParams.toString()}`, {
        method: 'POST',
        headers: {
          Authorization: `Token ${DEEPGRAM_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url: signedUrlData.signedUrl }),
      });

      if (!deepgramResponse.ok) {
        const errorText = await deepgramResponse.text().catch(() => '');
        console.error('Deepgram retry submission failed:', deepgramResponse.status, errorText);
        await markRetryFailed(lectureId, 'DEEPGRAM_SUBMISSION_FAILED', `Deepgram submission failed (${deepgramResponse.status})`);
        return NextResponse.json({ success: false, error: 'deepgram_submission_failed' }, { status: 502 });
      }

      const accepted = await deepgramResponse.json().catch(() => null);
      await supabaseAdmin.from('deepgram_webhook_logs').insert({
        lecture_id: lectureId,
        outcome: 'retry_submitted',
        raw_payload: accepted,
      });
    } catch (deepgramError: any) {
      console.error('Error submitting retry to Deepgram:', deepgramError);
      await markRetryFailed(lectureId, 'DEEPGRAM_NETWORK_ERROR', deepgramError?.message || 'Deepgram request failed');
      return NextResponse.json({ success: false, error: 'deepgram_submission_failed' }, { status: 502 });
    }

    return NextResponse.json({ success: true, attempt: nextAttempt });
  } catch (error: any) {
    console.error('Retry lecture error:', error);
    return NextResponse.json({ success: false, error: 'server_error' }, { status: 500 });
  }
}

async function markRetryFailed(lectureId: string, errorCode: string, reason: string) {
  try {
    await supabaseAdmin.from('lectures').update({
      status: 'failed',
      transcription_status: 'failed',
      transcription_error: reason,
      processing_error_code: errorCode,
      transcription_failed_at: new Date().toISOString(),
    }).eq('id', lectureId);

    await supabaseAdmin.from('deepgram_webhook_logs').insert({
      lecture_id: lectureId,
      outcome: 'retry_submission_failed',
      error: reason,
    });
  } catch (err) {
    console.error('Failed to mark lecture as failed after retry submission error:', err);
  }
}
