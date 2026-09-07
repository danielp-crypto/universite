import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/client';

// Same reasoning as the Deepgram webhook and start-processing routes: this
// makes a live outbound call to Deepgram and must not be killed by Vercel
// Hobby's 10s default before that call resolves.
export const maxDuration = 60;

const DEEPGRAM_API_KEY = process.env.DEEPGRAM_API_KEY || '';
const NEXT_PUBLIC_SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || '';
const DEEPGRAM_WEBHOOK_SECRET = process.env.DEEPGRAM_WEBHOOK_SECRET || '';

const SIGNED_URL_EXPIRY_SECONDS = 6 * 60 * 60; // 6 hours, same as the original submission

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
      console.error('Missing DEEPGRAM_API_KEY, NEXT_PUBLIC_SITE_URL, or DEEPGRAM_WEBHOOK_SECRET');
      return NextResponse.json({ success: false, error: 'server_configuration_error' }, { status: 500 });
    }

    const { id: lectureId } = await params;

    const { data: lecture, error: fetchError } = await supabaseAdmin
      .from('lectures')
      .select('id, user_id, file_path, status')
      .eq('id', lectureId)
      .single();

    if (fetchError || !lecture) {
      return NextResponse.json({ success: false, error: 'lecture_not_found' }, { status: 404 });
    }

    if (lecture.user_id !== user.id) {
      return NextResponse.json({ success: false, error: 'forbidden' }, { status: 403 });
    }

    // Only failed lectures are retryable — a completed lecture retrying
    // would silently overwrite good notes, and a processing one already has
    // a submission in flight.
    if (lecture.status !== 'failed') {
      return NextResponse.json({ success: false, error: 'not_failed' }, { status: 400 });
    }

    // Lectures that failed before this retry feature existed had their
    // storage file deleted as part of the old failure handling, so there's
    // nothing left to resubmit. Tell the student to re-upload instead of
    // retrying into a 404.
    if (!lecture.file_path) {
      return NextResponse.json({ success: false, error: 'file_unavailable' }, { status: 409 });
    }

    const { data: signedUrlData, error: signedUrlError } = await supabaseAdmin
      .storage
      .from('lecture-media')
      .createSignedUrl(lecture.file_path, SIGNED_URL_EXPIRY_SECONDS);

    if (signedUrlError || !signedUrlData?.signedUrl) {
      console.error('Error creating signed URL for retry:', signedUrlError);
      // Most likely cause: the object no longer exists in storage (e.g. an
      // older failure from before this feature). Same student-facing
      // message as the missing file_path case above.
      return NextResponse.json({ success: false, error: 'file_unavailable' }, { status: 409 });
    }

    // Reset to processing before resubmitting, so the UI reflects an
    // in-progress state immediately — same fields start-processing sets on
    // a fresh submission.
    const { error: resetError } = await supabaseAdmin
      .from('lectures')
      .update({
        status: 'processing',
        transcription_status: 'processing',
        transcription_error: null,
        transcription_started_at: new Date().toISOString(),
        transcription_completed_at: null,
        transcription_failed_at: null,
      })
      .eq('id', lectureId);

    if (resetError) {
      console.error('Error resetting lecture for retry:', resetError);
      return NextResponse.json({ success: false, error: 'retry_failed' }, { status: 500 });
    }

    // Same path-based callback URL and quality params as the original
    // submission (see start-processing) — nova-2 explicitly requested, since
    // the default model was the actual root cause this retry feature exists
    // to work around for edge cases (rate limits, transient Deepgram errors).
    const callbackUrl = `${NEXT_PUBLIC_SITE_URL}/api/webhooks/deepgram/${lectureId}/${encodeURIComponent(DEEPGRAM_WEBHOOK_SECRET)}`;

    const deepgramParams = new URLSearchParams({
      callback: callbackUrl,
      model: 'nova-2',
      language: 'en-US',
      smart_format: 'true',
      punctuate: 'true',
      utterances: 'true',
    });

    try {
      const deepgramUrl = `https://api.deepgram.com/v1/listen?${deepgramParams.toString()}`;
      const deepgramResponse = await fetch(deepgramUrl, {
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
        await markRetryFailed(lectureId, `Deepgram submission failed on retry: ${errorText}`);
        return NextResponse.json({ success: false, error: 'deepgram_submission_failed' }, { status: 502 });
      }
    } catch (deepgramError: any) {
      console.error('Error submitting retry to Deepgram:', deepgramError);
      await markRetryFailed(lectureId, deepgramError.message);
      return NextResponse.json({ success: false, error: 'deepgram_submission_failed' }, { status: 502 });
    }

    // Same log table the webhook and start-processing write to, so a
    // retry's outcome is visible alongside the original failure.
    await supabaseAdmin.from('deepgram_webhook_logs').insert({
      lecture_id: lectureId,
      outcome: 'retry_submitted',
    });

    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error('Retry lecture error:', error);
    return NextResponse.json({ success: false, error: 'server_error' }, { status: 500 });
  }
}

// Puts the lecture back into 'failed' if the retry submission itself fails
// (e.g. Deepgram API error). The storage file is deliberately left alone so
// the student can retry again rather than being deleted here.
async function markRetryFailed(lectureId: string, reason: string) {
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

    await supabaseAdmin.from('deepgram_webhook_logs').insert({
      lecture_id: lectureId,
      outcome: 'retry_submission_failed',
      error: reason,
    });
  } catch (err) {
    console.error('Failed to mark lecture as failed after retry submission error:', err);
  }
}