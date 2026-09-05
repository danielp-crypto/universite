import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/client';
import { PDFParse } from 'pdf-parse';
import JSZip from 'jszip';

// Extracts plain text from a PDF, page by page. PowerPoint-exported PDFs
// (the overwhelming majority of "lecture slides as PDF" uploads) always
// retain a text layer even for visually-laid-out slides, so this works well
// for the common case without needing OCR or multimodal AI calls.
async function extractPdfText(buffer: Buffer): Promise<string> {
  const parser = new PDFParse({ data: buffer });
  const result = await parser.getText();
  return result.text.trim();
}

// A .pptx file is a ZIP archive of XML files, one per slide
// (ppt/slides/slide1.xml, slide2.xml, ...). Each slide's text runs live in
// <a:t> tags. This pulls out just the text — diagrams/images without text
// aren't captured, but slide titles, bullets, and body text all are, which
// covers the large majority of what's actually useful as study context.
async function extractPptxText(buffer: Buffer): Promise<string> {
  const zip = await JSZip.loadAsync(buffer);

  const slideFiles = Object.keys(zip.files)
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
    .sort((a, b) => {
      const numA = parseInt(a.match(/slide(\d+)\.xml/)![1], 10);
      const numB = parseInt(b.match(/slide(\d+)\.xml/)![1], 10);
      return numA - numB;
    });

  const slideTexts: string[] = [];

  for (let i = 0; i < slideFiles.length; i++) {
    const xml = await zip.files[slideFiles[i]].async('string');
    const matches = [...xml.matchAll(/<a:t>([^<]*)<\/a:t>/g)];
    const text = matches.map((m) => m[1]).join(' ').trim();
    if (text) {
      slideTexts.push(`Slide ${i + 1}: ${text}`);
    }
  }

  return slideTexts.join('\n\n');
}

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
    const isPptx = mime_type?.includes('presentation') || filename.toLowerCase().endsWith('.pptx');

    let slidesText: string;
    try {
      slidesText = isPptx ? await extractPptxText(buffer) : await extractPdfText(buffer);
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
