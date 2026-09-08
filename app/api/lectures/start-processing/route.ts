import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/client';

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

    if (!Number.isFinite(normalizedFileSize) || normalizedFileSize <= 0 || normalizedFileSize > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json({ success: false, error: 'file_too_large' }, { status: 413 });
    }
    if (!ALLOWED_MIME_TYPES.has(normalizedMimeType)) return NextResponse.json({ success: false, error: 'unsupported_media_type' }, { status: 415 });
    if (!Number.isFinite(normalizedDuration) || normalizedDuration <= 0 || normalizedDuration > MAX_DURATION_SECONDS) {
      return NextResponse.json({ success: false, error: 'lecture_too_long' }, { status: 400 });
    }
    if (!String(file_path).startsWith(`${user.id}/`)) return NextResponse.json({ success: false, error: 'invalid_file_path' }, { status: 403 });

    const { count: processingCount, error: processingCountError } = await supabaseAdmin
      .from('lectures').select('id', { count: 'exact', head: true }).eq('user_id', user.id).eq('status', 'processing');
    if (processingCountError) {
      console.error('Could not check active lecture processing jobs:', processingCountError);
      return NextResponse.json({ success: false, error: 'processing_check_failed' }, { status: 500 });
    }
    if ((processingCount || 0) >= 1) return NextResponse.json({ success: false, error: 'processing_limit_reached' }, { status: 409 });

    const { data: moduleRow, error: moduleError } = await supabaseAdmin
      .from('modules').select('id').eq('id', module_id).eq('user_id', user.id).single();
    if (moduleError || !moduleRow) return NextResponse.json({ success: false, error: 'module_not_found' }, { status: 404 });

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
    const deepgramParams = new URLSearchParams({
      callback: callbackUrl,
      callback_method: 'POST',
      model,
      language: 'en-US',
      smart_format: 'true',
      punctuate: 'true',
      utterances: 'true',
    });

    try {
      const deepgramResponse = await fetch(`https://api.deepgram.com/v1/listen?${deepgramParams.toString()}`, {
        method: 'POST',
        headers: { Authorization: `Token ${DEEPGRAM_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: signedUrlData.signedUrl }),
      });

      if (!deepgramResponse.ok) {
        const errorText = await deepgramResponse.text().catch(() => '');
        console.error('Deepgram submission failed:', deepgramResponse.status, errorText);
        await markLectureFailed(lecture.id, 'DEEPGRAM_SUBMISSION_FAILED', `Deepgram submission failed (${deepgramResponse.status})`);
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
    await supabaseAdmin.from('lectures').update({
      status: 'failed', transcription_status: 'failed', transcription_error: reason,
      processing_error_code: errorCode, transcription_failed_at: new Date().toISOString(),
    }).eq('id', lectureId);
    await supabaseAdmin.from('deepgram_webhook_logs').insert({ lecture_id: lectureId, outcome: 'failed_before_submission', error: reason });
  } catch (err) {
    console.error('Failed to mark lecture as failed:', err);
  }
}
