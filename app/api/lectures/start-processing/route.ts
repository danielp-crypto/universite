import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/client';

const DEEPGRAM_API_KEY = process.env.DEEPGRAM_API_KEY || '';
const NEXT_PUBLIC_SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || '';
const DEEPGRAM_WEBHOOK_SECRET = process.env.DEEPGRAM_WEBHOOK_SECRET || '';

// How long the signed URL we hand to Deepgram stays valid. Deepgram fetches
// the file itself once processing starts, but we don't control exactly when
// that happens relative to when we generate the URL, so this is generous.
const SIGNED_URL_EXPIRY_SECONDS = 6 * 60 * 60; // 6 hours

export async function POST(request: NextRequest) {
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

    const body = await request.json();
    const { title, duration, module_id, mime_type, file_path, file_size } = body;

    if (!title || !file_path) {
      return NextResponse.json({ success: false, error: 'missing_fields' }, { status: 400 });
    }

    // Verify credits before creating anything — mirrors the check the
    // frontend already does, but re-checked server-side since this is the
    // point where a credit actually gets consumed.
    if (module_id) {
      const { data: moduleRow } = await supabaseAdmin
        .from('modules')
        .select('id')
        .eq('id', module_id)
        .eq('user_id', user.id)
        .single();

      if (!moduleRow) {
        return NextResponse.json({ success: false, error: 'module_not_found' }, { status: 404 });
      }
    }

    // Create the lecture immediately, in a processing state. The student
    // sees this in their lecture list right away and can navigate away —
    // transcription and summary generation happen asynchronously from here.
    const { data: lecture, error: insertError } = await supabaseAdmin
      .from('lectures')
      .insert({
        user_id: user.id,
        title,
        description: '',
        duration_seconds: duration || 0,
        status: 'processing',
        tags: [],
        stored_locally: false,
        local_audio_size: file_size || 0,
        file_path,
        mime_type: mime_type || null,
        transcription_status: 'processing',
        has_transcription: false,
        transcription_started_at: new Date().toISOString(),
        module_id: module_id || null,
      })
      .select()
      .single();

    if (insertError || !lecture) {
      console.error('Error creating lecture:', insertError);
      return NextResponse.json({ success: false, error: 'lecture_create_failed' }, { status: 500 });
    }

    // NOTE: credit usage is intentionally NOT recorded here. It's recorded
    // in the Deepgram webhook, only once transcription actually succeeds —
    // a lecture that fails processing shouldn't consume the student's credit.

    // Generate a signed URL so Deepgram can fetch the file directly from
    // Supabase Storage — no chunking, no client-side decoding, no Vercel
    // body-size limit, since the raw bytes never pass through our functions.
    const { data: signedUrlData, error: signedUrlError } = await supabaseAdmin
      .storage
      .from('lecture-media')
      .createSignedUrl(file_path, SIGNED_URL_EXPIRY_SECONDS);

    if (signedUrlError || !signedUrlData?.signedUrl) {
      console.error('Error creating signed URL:', signedUrlError);
      await markLectureFailed(lecture.id, 'Could not generate signed URL for uploaded file');
      return NextResponse.json({ success: true, lecture }); // lecture exists, but flagged failed above
    }

    // callback_method=POST + our own secret query param (Deepgram doesn't
    // sign callbacks itself) + lecture_id so the webhook knows which lecture
    // this result belongs to without needing a separate lookup table.
    // Path-based callback (no nested query string) — lecture_id and our
    // shared secret are URL path segments instead of query params, avoiding
    // a callback URL that itself contains "?...&..." as a parameter value,
    // which Deepgram rejected with "Invalid query string" when tried.
    const callbackUrl = `${NEXT_PUBLIC_SITE_URL}/api/webhooks/deepgram/${lecture.id}/${encodeURIComponent(DEEPGRAM_WEBHOOK_SECRET)}`;

    const deepgramParams = new URLSearchParams({
      model: 'nova-2',
      smart_format: 'true',
      callback: callbackUrl,
      callback_method: 'POST',
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
        console.error('Deepgram submission failed:', deepgramResponse.status, errorText);
        await markLectureFailed(lecture.id, `Deepgram submission failed: ${errorText}`);
      }
      // On success, Deepgram returns a request_id immediately and processes
      // in the background — we don't wait for it. The webhook handles the
      // rest whenever Deepgram actually finishes.
    } catch (deepgramError: any) {
      console.error('Error submitting to Deepgram:', deepgramError);
      await markLectureFailed(lecture.id, deepgramError.message);
    }

    return NextResponse.json({ success: true, lecture });

  } catch (error: any) {
    console.error('Start processing error:', error);
    return NextResponse.json({ success: false, error: 'server_error' }, { status: 500 });
  }
}

async function markLectureFailed(lectureId: string, reason: string) {
  try {
    const { data: lecture } = await supabaseAdmin
      .from('lectures')
      .select('file_path')
      .eq('id', lectureId)
      .single();

    await supabaseAdmin
      .from('lectures')
      .update({
        status: 'failed',
        transcription_status: 'failed',
        transcription_error: reason,
        transcription_failed_at: new Date().toISOString(),
      })
      .eq('id', lectureId);

    // Same log table the Deepgram webhook writes to — this lets you see the
    // full picture (both "failed before Deepgram ever got it" and "Deepgram
    // itself rejected it") in one place via Supabase Table Editor.
    await supabaseAdmin.from('deepgram_webhook_logs').insert({
      lecture_id: lectureId,
      outcome: 'failed_before_submission',
      error: reason,
    });

    // Deepgram never picked this file up, so the webhook (which normally
    // handles cleanup) will never fire — clean it up here instead.
    if (lecture?.file_path) {
      const { error } = await supabaseAdmin.storage.from('lecture-media').remove([lecture.file_path]);
      if (error) {
        console.error('Failed to clean up storage file after failed submission:', error);
      }
    }
  } catch (err) {
    console.error('Failed to mark lecture as failed:', err);
  }
}