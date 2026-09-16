import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/client';
import { extractDocumentText } from '@/lib/documents/extractText';

// Force dynamic rendering for API routes with static export
export const dynamic = 'force-dynamic';

export const runtime = 'nodejs';
export const maxDuration = 60;

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

    const { id: lectureId } = await params;

    const { data: lecture, error: lectureError } = await supabaseAdmin
      .from('lectures')
      .select('id')
      .eq('id', lectureId)
      .eq('user_id', user.id)
      .single();

    if (lectureError || !lecture) {
      return NextResponse.json({ success: false, error: 'lecture_not_found' }, { status: 404 });
    }

    const body = await request.json();
    const { file_path, filename, mime_type } = body;

    if (!file_path || !filename) {
      return NextResponse.json({ success: false, error: 'missing_fields' }, { status: 400 });
    }

    // Download the just-uploaded file from Storage to extract text from it.
    const { data: fileBlob, error: downloadError } = await supabaseAdmin
      .storage
      .from('lecture-media')
      .download(file_path);

    if (downloadError || !fileBlob) {
      console.error('Error downloading slides file:', downloadError);
      return NextResponse.json({ success: false, error: 'download_failed', detail: downloadError?.message }, { status: 500 });
    }

    const buffer = Buffer.from(await fileBlob.arrayBuffer());

    let slidesText: string;
    try {
      const result = await extractDocumentText(buffer, { mimeType: mime_type, filename });
      slidesText = result.text;
    } catch (extractError: any) {
      console.error('Error extracting slide text:', extractError);
      return NextResponse.json(
        { success: false, error: 'extraction_failed', detail: extractError.message },
        { status: 500 }
      );
    }

    if (!slidesText || slidesText.length < 5) {
      return NextResponse.json(
        { success: false, error: 'no_text_found', detail: 'No readable text was found in this file — it may be image-only slides with no text layer.' },
        { status: 422 }
      );
    }

    const { error: updateError } = await supabaseAdmin
      .from('lectures')
      .update({
        slides_text: slidesText,
        slides_file_path: file_path,
        slides_filename: filename,
      })
      .eq('id', lectureId);

    if (updateError) {
      console.error('Error saving slides text:', updateError);
      return NextResponse.json({ success: false, error: 'save_failed', detail: updateError.message, code: updateError.code }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      slidesText,
      charCount: slidesText.length,
    });

  } catch (error: any) {
    console.error('Slides upload error:', error);
    return NextResponse.json({ success: false, error: 'server_error', detail: error.message }, { status: 500 });
  }
}

export async function DELETE(
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

    const { data: lecture } = await supabaseAdmin
      .from('lectures')
      .select('slides_file_path')
      .eq('id', lectureId)
      .eq('user_id', user.id)
      .single();

    if (lecture?.slides_file_path) {
      await supabaseAdmin.storage.from('lecture-media').remove([lecture.slides_file_path]);
    }

    const { error: updateError } = await supabaseAdmin
      .from('lectures')
      .update({ slides_text: null, slides_file_path: null, slides_filename: null })
      .eq('id', lectureId)
      .eq('user_id', user.id);

    if (updateError) {
      return NextResponse.json({ success: false, error: 'delete_failed' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Slides delete error:', error);
    return NextResponse.json({ success: false, error: 'server_error' }, { status: 500 });
  }
}