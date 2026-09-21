import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/client';

export const dynamic = 'force-dynamic';

// Just long enough for an immediate client-side download/playback — this
// isn't meant to be cached or reused across a session.
const SIGNED_URL_EXPIRY_SECONDS = 5 * 60;

export async function GET(
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

    const { id: lectureId } = await params;

    const { data: lecture, error: fetchError } = await supabaseAdmin
      .from('lectures')
      .select('id, user_id, file_path')
      .eq('id', lectureId)
      .single();

    if (fetchError || !lecture) {
      return NextResponse.json({ success: false, error: 'lecture_not_found' }, { status: 404 });
    }
    if (lecture.user_id !== user.id) {
      return NextResponse.json({ success: false, error: 'forbidden' }, { status: 403 });
    }
    if (!lecture.file_path) {
      // Expected for any completed lecture — the audio file is deleted
      // once processing succeeds, since nothing needs it after that.
      return NextResponse.json({ success: false, error: 'file_unavailable' }, { status: 409 });
    }

    const { data: signedUrlData, error: signedUrlError } = await supabaseAdmin
      .storage
      .from('lecture-media')
      .createSignedUrl(lecture.file_path, SIGNED_URL_EXPIRY_SECONDS);

    if (signedUrlError || !signedUrlData?.signedUrl) {
      return NextResponse.json({ success: false, error: 'file_unavailable' }, { status: 409 });
    }

    return NextResponse.json({ success: true, url: signedUrlData.signedUrl });
  } catch (error: any) {
    console.error('Error creating audio signed URL:', error);
    return NextResponse.json({ success: false, error: 'server_error' }, { status: 500 });
  }
}