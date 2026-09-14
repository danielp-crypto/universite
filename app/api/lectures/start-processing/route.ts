import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/client';
import { extractAudioToMp3 } from '@/lib/media/extract-audio';

// FFmpeg requires the Node.js runtime.
export const runtime = 'nodejs';

// Force dynamic rendering for API routes.
export const dynamic = 'force-dynamic';

const DEEPGRAM_API_KEY = process.env.DEEPGRAM_API_KEY || '';
const NEXT_PUBLIC_SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || '';
const DEEPGRAM_WEBHOOK_SECRET = process.env.DEEPGRAM_WEBHOOK_SECRET || '';

const STORAGE_BUCKET = 'lecture-media';

// Supabase Free tier MVP limit.
// Keep this consistent with the frontend.
const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024;

// Maximum lecture duration.
const MAX_DURATION_SECONDS = 2 * 60 * 60;

// How long Deepgram can access the uploaded/processed media.
const SIGNED_URL_EXPIRY_SECONDS = 6 * 60 * 60;

// Free-tier lecture quota.
const FREE_LECTURE_LIMIT = 4;

const ALLOWED_MIME_TYPES = new Set([
  // Audio
  'audio/webm',
  'audio/mp4',
  'audio/m4a',
  'audio/mpeg',
  'audio/wav',
  'audio/x-wav',
  'audio/ogg',
  'audio/aac',

  // Video
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'video/mpeg',
  'video/ogg',
]);

function isVideoMimeType(mimeType: string): boolean {
  return mimeType.startsWith('video/');
}

function isAudioMimeType(mimeType: string): boolean {
  return mimeType.startsWith('audio/');
}

export async function POST(request: NextRequest) {
  let lectureId: string | null = null;

  try {
    // ---------------------------------------------------------
    // 1. Authenticate user
    // ---------------------------------------------------------

    const authHeader = request.headers.get('authorization');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        {
          success: false,
          error: 'unauthorized',
        },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);

    const {
      data: { user },
      error: authError,
    } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json(
        {
          success: false,
          error: 'unauthorized',
        },
        { status: 401 }
      );
    }

    // ---------------------------------------------------------
    // 2. Validate environment
    // ---------------------------------------------------------

    if (
      !DEEPGRAM_API_KEY ||
      !NEXT_PUBLIC_SITE_URL ||
      !DEEPGRAM_WEBHOOK_SECRET
    ) {
      console.error(
        'Missing required lecture-processing environment variables'
      );

      return NextResponse.json(
        {
          success: false,
          error: 'server_configuration_error',
        },
        { status: 500 }
      );
    }

    // ---------------------------------------------------------
    // 3. Parse request
    // ---------------------------------------------------------

    const body = await request.json();

    const {
      title,
      duration,
      module_id,
      mime_type,
      file_path,
      file_size,
    } = body;

    if (!title || !file_path || !module_id) {
      return NextResponse.json(
        {
          success: false,
          error: 'missing_fields',
        },
        { status: 400 }
      );
    }

    const normalizedMimeType = String(mime_type || '')
      .split(';')[0]
      .trim()
      .toLowerCase();

    const normalizedFileSize = Number(file_size || 0);
    const normalizedDuration = Number(duration || 0);

    // ---------------------------------------------------------
    // 4. Validate file
    // ---------------------------------------------------------

    if (
      !Number.isFinite(normalizedFileSize) ||
      normalizedFileSize <= 0 ||
      normalizedFileSize > MAX_FILE_SIZE_BYTES
    ) {
      return NextResponse.json(
        {
          success: false,
          error: 'file_too_large',
          max_size_mb: 50,
        },
        { status: 413 }
      );
    }

    if (!ALLOWED_MIME_TYPES.has(normalizedMimeType)) {
      return NextResponse.json(
        {
          success: false,
          error: 'unsupported_media_type',
          mime_type: normalizedMimeType,
        },
        { status: 415 }
      );
    }

    if (
      !Number.isFinite(normalizedDuration) ||
      normalizedDuration <= 0 ||
      normalizedDuration > MAX_DURATION_SECONDS
    ) {
      return NextResponse.json(
        {
          success: false,
          error: 'lecture_too_long',
          max_duration_minutes: 120,
        },
        { status: 400 }
      );
    }

    // ---------------------------------------------------------
    // 5. Prevent users from processing another user's file
    // ---------------------------------------------------------

    const expectedPrefix = `${user.id}/`;

    if (!String(file_path).startsWith(expectedPrefix)) {
      return NextResponse.json(
        {
          success: false,
          error: 'invalid_file_path',
        },
        { status: 403 }
      );
    }

    // ---------------------------------------------------------
    // 6. Server-side subscription / credit check
    // ---------------------------------------------------------

    const { data: subscription } = await supabaseAdmin
      .from('user_subscriptions')
      .select(
        'status, plan_slug, plans(monthly_lecture_uploads)'
      )
      .eq('user_id', user.id)
      .maybeSingle();

    const isPremium =
      subscription?.status === 'active' &&
      subscription.plan_slug !== 'free';

    const configuredLimit = Number(
      (subscription?.plans as any)?.monthly_lecture_uploads || 0
    );

    const lectureLimit = isPremium
      ? configuredLimit > 0
        ? configuredLimit
        : 999999
      : FREE_LECTURE_LIMIT;

    const {
      count: creditsUsed,
      error: creditsError,
    } = await supabaseAdmin
      .from('credits')
      .select('id', {
        count: 'exact',
        head: true,
      })
      .eq('user_id', user.id)
      .neq('used_for', 'free_tier_credit');

    if (creditsError) {
      console.error(
        'Could not check lecture credit entitlement:',
        creditsError
      );

      return NextResponse.json(
        {
          success: false,
          error: 'credit_check_failed',
        },
        { status: 500 }
      );
    }

    if ((creditsUsed || 0) >= lectureLimit) {
      return NextResponse.json(
        {
          success: false,
          error: 'credit_limit_reached',
        },
        { status: 402 }
      );
    }

    // ---------------------------------------------------------
    // 7. Only one processing lecture per student
    // ---------------------------------------------------------

    const {
      count: processingCount,
      error: processingCountError,
    } = await supabaseAdmin
      .from('lectures')
      .select('id', {
        count: 'exact',
        head: true,
      })
      .eq('user_id', user.id)
      .eq('status', 'processing');

    if (processingCountError) {
      console.error(
        'Could not check active lecture processing jobs:',
        processingCountError
      );

      return NextResponse.json(
        {
          success: false,
          error: 'processing_check_failed',
        },
        { status: 500 }
      );
    }

    if ((processingCount || 0) >= 1) {
      return NextResponse.json(
        {
          success: false,
          error: 'processing_limit_reached',
        },
        { status: 409 }
      );
    }

    // ---------------------------------------------------------
    // 8. Verify module belongs to user
    // ---------------------------------------------------------

    const {
      data: moduleRow,
      error: moduleError,
    } = await supabaseAdmin
      .from('modules')
      .select('id')
      .eq('id', module_id)
      .eq('user_id', user.id)
      .single();

    if (moduleError || !moduleRow) {
      return NextResponse.json(
        {
          success: false,
          error: 'module_not_found',
        },
        { status: 404 }
      );
    }

    // ---------------------------------------------------------
    // 9. Create lecture record
    // ---------------------------------------------------------

    const {
      data: lecture,
      error: insertError,
    } = await supabaseAdmin
      .from('lectures')
      .insert({
        user_id: user.id,
        title: String(title)
          .trim()
          .slice(0, 200),

        description: '',

        duration_seconds: Math.round(
          normalizedDuration
        ),

        status: 'processing',

        tags: [],

        stored_locally: false,

        local_audio_size: normalizedFileSize,

        file_path,

        file_size: normalizedFileSize,

        mime_type: normalizedMimeType,

        transcription_status: 'processing',

        has_transcription: false,

        transcription_started_at:
          new Date().toISOString(),

        processing_attempts: 1,

        processing_error_code: null,

        transcription_error: null,

        module_id,
      })
      .select()
      .single();

    if (insertError || !lecture) {
      console.error(
        'Error creating lecture:',
        insertError
      );

      return NextResponse.json(
        {
          success: false,
          error: 'lecture_create_failed',
        },
        { status: 500 }
      );
    }

    lectureId = lecture.id;

    console.log(
      `[Lecture ${lectureId}] Processing started`,
      {
        mimeType: normalizedMimeType,
        fileSize: normalizedFileSize,
        duration: normalizedDuration,
      }
    );

    // ---------------------------------------------------------
    // 10. Download original file from Supabase
    // ---------------------------------------------------------

    const {
      data: originalFile,
      error: downloadError,
    } = await supabaseAdmin.storage
      .from(STORAGE_BUCKET)
      .download(file_path);

    if (downloadError || !originalFile) {
      console.error(
        `[Lecture ${lectureId}] Failed to download original file:`,
        downloadError
      );

      await markLectureFailed(
        lectureId,
        'STORAGE_DOWNLOAD_FAILED',
        'Could not download uploaded lecture from storage'
      );

      return NextResponse.json(
        {
          success: false,
          error: 'storage_file_unavailable',
        },
        { status: 502 }
      );
    }

    const originalBuffer = Buffer.from(
      await originalFile.arrayBuffer()
    );

    console.log(
      `[Lecture ${lectureId}] Downloaded ${originalBuffer.length} bytes` 
    );

    // ---------------------------------------------------------
    // 11. Convert video -> MP3
    // ---------------------------------------------------------

    let audioBuffer: Buffer;
    let deepgramMimeType = normalizedMimeType;
    let processedFilePath: string | null = null;

    if (isVideoMimeType(normalizedMimeType)) {
      console.log(
        `[Lecture ${lectureId}] Video detected. Extracting audio with FFmpeg...` 
      );

      try {
        audioBuffer = await extractAudioToMp3(
          originalBuffer
        );

        console.log(
          `[Lecture ${lectureId}] FFmpeg extraction complete. MP3 size: ${audioBuffer.length} bytes` 
        );

        // -----------------------------------------------------
        // 12. Upload processed MP3
        // -----------------------------------------------------

        processedFilePath =
          `${user.id}/processed/${lectureId}.mp3`;

        const {
          error: processedUploadError,
        } = await supabaseAdmin.storage
          .from(STORAGE_BUCKET)
          .upload(
            processedFilePath,
            audioBuffer,
            {
              contentType: 'audio/mpeg',
              upsert: true,
            }
          );

        if (processedUploadError) {
          console.error(
            `[Lecture ${lectureId}] Failed to upload processed MP3:`,
            processedUploadError
          );

          await markLectureFailed(
            lectureId,
            'PROCESSED_AUDIO_UPLOAD_FAILED',
            'Could not upload extracted lecture audio'
          );

          return NextResponse.json(
            {
              success: false,
              error: 'processed_audio_upload_failed',
            },
            { status: 502 }
          );
        }

        deepgramMimeType = 'audio/mpeg';

        console.log(
          `[Lecture ${lectureId}] Processed MP3 uploaded to ${processedFilePath}` 
        );
      } catch (ffmpegError: any) {
        console.error(
          `[Lecture ${lectureId}] FFmpeg extraction failed:`,
          ffmpegError
        );

        await markLectureFailed(
          lectureId,
          'FFMPEG_EXTRACTION_FAILED',
          ffmpegError?.message ||
            'Could not extract audio from video'
        );

        return NextResponse.json(
          {
            success: false,
            error: 'audio_extraction_failed',
          },
          { status: 422 }
        );
      }
    } else if (isAudioMimeType(normalizedMimeType)) {
      // Audio files do not need conversion.
      audioBuffer = originalBuffer;

      console.log(
        `[Lecture ${lectureId}] Audio file detected. Skipping FFmpeg.` 
      );
    } else {
      await markLectureFailed(
        lectureId,
        'UNSUPPORTED_MEDIA_TYPE',
        `Unsupported media type: ${normalizedMimeType}` 
      );

      return NextResponse.json(
        {
          success: false,
          error: 'unsupported_media_type',
        },
        { status: 415 }
      );
    }

    // ---------------------------------------------------------
    // 13. Create signed URL for Deepgram
    // ---------------------------------------------------------

    const fileForDeepgram =
      processedFilePath || file_path;

    const {
      data: signedUrlData,
      error: signedUrlError,
    } = await supabaseAdmin.storage
      .from(STORAGE_BUCKET)
      .createSignedUrl(
        fileForDeepgram,
        SIGNED_URL_EXPIRY_SECONDS
      );

    if (
      signedUrlError ||
      !signedUrlData?.signedUrl
    ) {
      console.error(
        `[Lecture ${lectureId}] Failed to create signed URL:`,
        signedUrlError
      );

      await markLectureFailed(
        lectureId,
        'STORAGE_SIGNED_URL_FAILED',
        'Could not generate signed URL for lecture audio'
      );

      return NextResponse.json(
        {
          success: false,
          error: 'storage_file_unavailable',
        },
        { status: 502 }
      );
    }

    // ---------------------------------------------------------
    // 14. Send audio to Deepgram
    // ---------------------------------------------------------

    const callbackUrl =
      `${NEXT_PUBLIC_SITE_URL}/api/webhooks/deepgram/` +
      `${lectureId}/` +
      `${encodeURIComponent(DEEPGRAM_WEBHOOK_SECRET)}`;

    // IMPORTANT:
    //
    // We now always send audio to Deepgram.
    //
    // Video uploads have already been converted to MP3.
    //
    // Therefore we do NOT use nova-2-video anymore.
    const model = 'nova-2';

    const deepgramParams =
      new URLSearchParams({
        callback: callbackUrl,
        model,
        language: 'en-US',
        smart_format: 'true',
        punctuate: 'true',
        utterances: 'true',
      });

    console.log(
      `[Lecture ${lectureId}] Submitting audio to Deepgram`,
      {
        model,
        originalMimeType: normalizedMimeType,
        deepgramMimeType,
        sourceFile: fileForDeepgram,
      },
    );

    try {
      const deepgramResponse = await fetch(
        `https://api.deepgram.com/v1/listen?${deepgramParams.toString()}`,
        {
          method: 'POST',

          headers: {
            Authorization:
              `Token ${DEEPGRAM_API_KEY}`,

            'Content-Type':
              'application/json',
          },

          body: JSON.stringify({
            url: signedUrlData.signedUrl,
          }),
        }
      );

      if (!deepgramResponse.ok) {
        const errorText =
          await deepgramResponse
            .text()
            .catch(() => '');

        console.error(
          `[Lecture ${lectureId}] Deepgram submission failed:`,
          deepgramResponse.status,
          errorText
        );

        await markLectureFailed(
          lectureId,
          'DEEPGRAM_SUBMISSION_FAILED',
          `Deepgram submission failed (${deepgramResponse.status}): ${
            errorText || '(no response body)'
          }`
        );

        // Clean up processed MP3 if we created one.
        if (processedFilePath) {
          await removeStorageFile(
            processedFilePath
          );
        }

        return NextResponse.json(
          {
            success: false,
            error: 'deepgram_submission_failed',
          },
          { status: 502 }
        );
      }

      const deepgramAccepted =
        await deepgramResponse
          .json()
          .catch(() => null);

      await supabaseAdmin
        .from('deepgram_webhook_logs')
        .insert({
          lecture_id: lectureId,
          outcome: 'submitted',
          raw_payload: deepgramAccepted,
        });

      console.log(
        `[Lecture ${lectureId}] Deepgram accepted transcription job` 
      );
    } catch (deepgramError: any) {
      console.error(
        `[Lecture ${lectureId}] Deepgram network error:`,
        deepgramError
      );

      await markLectureFailed(
        lectureId,
        'DEEPGRAM_NETWORK_ERROR',
        deepgramError?.message ||
          'Deepgram request failed'
      );

      if (processedFilePath) {
        await removeStorageFile(
          processedFilePath
        );
      }

      return NextResponse.json(
        {
          success: false,
          error: 'deepgram_submission_failed',
        },
        { status: 502 }
      );
    }

    // ---------------------------------------------------------
    // 15. Success
    // ---------------------------------------------------------

    return NextResponse.json({
      success: true,
      lecture,
      message:
        'Lecture uploaded and transcription started',
    });
  } catch (error: any) {
    console.error(
      'Start processing error:',
      error
    );

    if (lectureId) {
      await markLectureFailed(
        lectureId,
        'SERVER_PROCESSING_ERROR',
        error?.message ||
          'Unexpected processing error'
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: 'server_error',
      },
      { status: 500 }
    );
  }
}

// ============================================================
// Helpers
// ============================================================

async function markLectureFailed(
  lectureId: string,
  errorCode: string,
  reason: string
) {
  try {
    await supabaseAdmin
      .from('lectures')
      .update({
        status: 'failed',
        transcription_status: 'failed',
        transcription_error: reason,
        processing_error_code: errorCode,
        transcription_failed_at:
          new Date().toISOString(),
      })
      .eq('id', lectureId);

    await supabaseAdmin
      .from('deepgram_webhook_logs')
      .insert({
        lecture_id: lectureId,
        outcome: 'failed_before_submission',
        error: reason,
      });
  } catch (err) {
    console.error(
      'Failed to mark lecture as failed:',
      err
    );
  }
}

async function removeStorageFile(
  filePath: string
) {
  try {
    const { error } =
      await supabaseAdmin.storage
        .from(STORAGE_BUCKET)
        .remove([filePath]);

    if (error) {
      console.error(
        `Failed to remove storage file ${filePath}:`,
        error
      );
    }
  } catch (err) {
    console.error(
      `Failed to remove storage file ${filePath}:`,
      err
    );
  }
}