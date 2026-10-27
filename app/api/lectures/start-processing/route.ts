import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/client';
import { getPlanAccess } from '@/lib/quota/plan';

// Force dynamic rendering for API routes with static export
export const dynamic = 'force-dynamic';

const DEEPGRAM_API_KEY = process.env.DEEPGRAM_API_KEY || '';
const NEXT_PUBLIC_SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || '';
const DEEPGRAM_WEBHOOK_SECRET = process.env.DEEPGRAM_WEBHOOK_SECRET || '';
const SIGNED_URL_EXPIRY_SECONDS = 6 * 60 * 60;
const MAX_FILE_SIZE_BYTES = 300 * 1024 * 1024;
const MAX_DURATION_SECONDS = 2 * 60 * 60;
const ALLOWED_MIME_TYPES = new Set([
  'audio/webm', 'audio/mp4', 'audio/m4a', 'audio/mpeg', 'audio/wav', 'audio/x-wav', 'audio/ogg', 'audio/aac',
  'video/mp4', 'video/webm', 'video/quicktime', 'video/mpeg', 'video/ogg',
]);

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) return NextResponse.json({ success: false, error: 'unauthorized' }, { status: 401 });
    const token = authHeader.substring(7);
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) return NextResponse.json({ success: false, error: 'unauthorized' }, { status: 401 });

    if (!DEEPGRAM_API_KEY || !NEXT_PUBLIC_SITE_URL || !DEEPGRAM_WEBHOOK_SECRET) {
      console.error('Missing required lecture-processing environment variables');
      return NextResponse.json({ success: false, error: 'server_configuration_error' }, { status: 500 });
    }

    const body = await request.json();
    const { title, duration, module_id, mime_type, file_path, file_size } = body;
    if (!title || !file_path || !module_id) return NextResponse.json({ success: false, error: 'missing_fields' }, { status: 400 });

    const normalizedMimeType = String(mime_type || '').split(';')[0].trim().toLowerCase();
    const normalizedFileSize = Number(file_size || 0);
    const normalizedDuration = Number(duration || 0);
    if (!String(file_path).startsWith(`${user.id}/`)) return NextResponse.json({ success: false, error: 'invalid_file_path' }, { status: 403 });

    // The browser uploads the file to storage BEFORE calling this endpoint, so
    // every refusal below has to delete it again. Otherwise each rejected
    // upload (up to 300 MB) stays in storage forever.
    const reject = async (error: string, status: number, extra: Record<string, unknown> = {}) => {
      const { error: removeError } = await supabaseAdmin.storage.from('lecture-media').remove([String(file_path)]);
      if (removeError) console.error('Could not remove rejected upload:', removeError);
      return NextResponse.json({ success: false, error, ...extra }, { status });
    };

    if (!Number.isFinite(normalizedFileSize) || normalizedFileSize <= 0 || normalizedFileSize > MAX_FILE_SIZE_BYTES) return reject('file_too_large', 413);
    if (!ALLOWED_MIME_TYPES.has(normalizedMimeType)) return reject('unsupported_media_type', 415);
    if (!Number.isFinite(normalizedDuration) || normalizedDuration <= 0 || normalizedDuration > MAX_DURATION_SECONDS) return reject('lecture_too_long', 400);

    // Server-side entitlement check. The UI check is only a convenience;
    // this is the actual gate that protects the free/premium lecture quota.
    const access = await getPlanAccess(user.id);

    // The duration comes from the browser, so it is a guard for honest users
    // rather than proof. A minute of slack covers recorder rounding.
    const maxMinutes = access.policy.maxLectureMinutes;
    if (normalizedDuration > maxMinutes * 60 + 60) {
      return reject('lecture_too_long', 400, {
        max_minutes: maxMinutes,
        message: access.isPremium
          ? `Lectures can be up to ${maxMinutes} minutes long.`
          : `Free accounts can upload lectures up to ${maxMinutes} minutes long. Upgrade to Premium for up to 90 minutes.`,
      });
    }

    const lectureLimit = access.policy.lifetimeLectures; // null = unlimited
    if (lectureLimit !== null) {
      const { count: creditsUsed, error: creditsError } = await supabaseAdmin.from('credits')
        .select('id', { count: 'exact', head: true }).eq('user_id', user.id).neq('used_for', 'free_tier_credit');
      if (creditsError) {
        console.error('Could not check lecture credit entitlement:', creditsError);
        return reject('credit_check_failed', 500);
      }
      if ((creditsUsed || 0) >= lectureLimit) {
        return reject('credit_limit_reached', 402, {
          limit: lectureLimit,
          used: creditsUsed || 0,
          message: `You've used all ${lectureLimit} free lecture credits. Upgrade to Premium to keep uploading.`,
        });
      }
    }

    // Only one Deepgram job per student at a time for the MVP. This also
    // prevents accidental double-clicks from creating duplicate jobs.
    const { count: processingCount, error: processingCountError } = await supabaseAdmin
      .from('lectures').select('id', { count: 'exact', head: true }).eq('user_id', user.id).eq('status', 'processing');
    if (processingCountError) {
      console.error('Could not check active lecture processing jobs:', processingCountError);
      return reject('processing_check_failed', 500);
    }
    if ((processingCount || 0) >= 1) return reject('processing_limit_reached', 409);

    const { data: moduleRow, error: moduleError } = await supabaseAdmin.from('modules')
      .select('id').eq('id', module_id).eq('user_id', user.id).single();
    if (moduleError || !moduleRow) return reject('module_not_found', 404);

    const { data: lecture, error: insertError } = await supabaseAdmin.from('lectures').insert({
      user_id: user.id,
      title: String(title).trim().slice(0, 200),
      description: '',
      duration_seconds: Math.round(normalizedDuration),
      status: 'processing',
      tags: [],
      stored_locally: false,
      local_audio_size: normalizedFileSize,
      file_path,
      file_size: normalizedFileSize,
      mime_type: normalizedMimeType,
      transcription_status: 'processing',
      has_transcription: false,
      transcription_started_at: new Date().toISOString(),
      processing_attempts: 1,
      processing_error_code: null,
      transcription_error: null,
      module_id,
    }).select().single();
    if (insertError || !lecture) {
      console.error('Error creating lecture:', insertError);
      return NextResponse.json({ success: false, error: 'lecture_create_failed' }, { status: 500 });
    }

    const { data: signedUrlData, error: signedUrlError } = await supabaseAdmin.storage.from('lecture-media').createSignedUrl(file_path, SIGNED_URL_EXPIRY_SECONDS);
    if (signedUrlError || !signedUrlData?.signedUrl) {
      console.error('Error creating signed URL:', signedUrlError);
      await markLectureFailed(lecture.id, 'STORAGE_SIGNED_URL_FAILED', 'Could not generate signed URL for uploaded file');
      return NextResponse.json({ success: false, error: 'storage_file_unavailable' }, { status: 502 });
    }

    const callbackUrl = `${NEXT_PUBLIC_SITE_URL}/api/webhooks/deepgram/${lecture.id}/${encodeURIComponent(DEEPGRAM_WEBHOOK_SECRET)}`;
    const model = normalizedMimeType.startsWith('video/') ? 'nova-2-video' : 'nova-2';
    // callback_method deliberately omitted — POST is already Deepgram's
    // default, and this redundant param was the actual cause of the 400s
    // (Deepgram's own docs only ever show it lowercase, e.g. callback_method=put).
    const deepgramParams = new URLSearchParams({ callback: callbackUrl, model, language: 'en-US', smart_format: 'true', punctuate: 'true', utterances: 'true' });

    try {
      const deepgramResponse = await fetch(`https://api.deepgram.com/v1/listen?${deepgramParams.toString()}`, {
        method: 'POST', headers: { Authorization: `Token ${DEEPGRAM_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: signedUrlData.signedUrl }),
      });
      if (!deepgramResponse.ok) {
        const errorText = await deepgramResponse.text().catch(() => '');
        console.error('Deepgram submission failed:', deepgramResponse.status, errorText);
        // Store the actual response body, not just the status code — this is
        // what let us diagnose the callback_method issue in the first place.
        await markLectureFailed(lecture.id, 'DEEPGRAM_SUBMISSION_FAILED', `Deepgram submission failed (${deepgramResponse.status}): ${errorText || '(no response body)'}`);
        return NextResponse.json({ success: false, error: 'deepgram_submission_failed' }, { status: 502 });
      }
      const deepgramAccepted = await deepgramResponse.json().catch(() => null);
      await supabaseAdmin.from('deepgram_webhook_logs').insert({ lecture_id: lecture.id, outcome: 'submitted', raw_payload: deepgramAccepted });
    } catch (deepgramError: any) {
      console.error('Error submitting to Deepgram:', deepgramError);
      await markLectureFailed(lecture.id, 'DEEPGRAM_NETWORK_ERROR', deepgramError?.message || 'Deepgram request failed');
      return NextResponse.json({ success: false, error: 'deepgram_submission_failed' }, { status: 502 });
    }

    return NextResponse.json({ success: true, lecture, message: 'Lecture uploaded and transcription started' });
  } catch (error: any) {
    console.error('Start processing error:', error);
    return NextResponse.json({ success: false, error: 'server_error' }, { status: 500 });
  }
}

async function markLectureFailed(lectureId: string, errorCode: string, reason: string) {
  try {
    await supabaseAdmin.from('lectures').update({ status: 'failed', transcription_status: 'failed', transcription_error: reason, processing_error_code: errorCode, transcription_failed_at: new Date().toISOString() }).eq('id', lectureId);
    await supabaseAdmin.from('deepgram_webhook_logs').insert({ lecture_id: lectureId, outcome: 'failed_before_submission', error: reason });
  } catch (err) { console.error('Failed to mark lecture as failed:', err); }
}