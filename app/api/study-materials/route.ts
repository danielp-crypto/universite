import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/client';
import { extractDocumentText } from '@/lib/documents/extractText';
import { chunkText, embedDocumentChunks } from '@/lib/documents/embeddings';

// Force dynamic rendering for API routes with static export
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Same reasoning as the lecture-processing routes: this does real work
// (download, extract, embed) inline and must not be killed by Vercel
// Hobby's 10s default before it finishes.
export const maxDuration = 60;

const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024; // matches Supabase's free-tier upload cap
const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation', // .pptx
  'text/plain',
  'text/markdown',
]);

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

    if (!process.env.GEMINI_API_KEY) {
      console.error('Missing GEMINI_API_KEY');
      return NextResponse.json({ success: false, error: 'server_configuration_error' }, { status: 500 });
    }

    const body = await request.json();
    const { module_id, title, file_path, filename, mime_type, file_size } = body;

    if (!module_id || !file_path || !filename) {
      return NextResponse.json({ success: false, error: 'missing_fields' }, { status: 400 });
    }

    const normalizedMimeType = String(mime_type || '').split(';')[0].trim().toLowerCase();
    const normalizedFileSize = Number(file_size || 0);

    if (Number.isFinite(normalizedFileSize) && normalizedFileSize > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json({ success: false, error: 'file_too_large' }, { status: 413 });
    }
    if (!ALLOWED_MIME_TYPES.has(normalizedMimeType) && !/\.(pdf|pptx|txt|md)$/i.test(filename)) {
      return NextResponse.json({ success: false, error: 'unsupported_file_type' }, { status: 415 });
    }
    if (!String(file_path).startsWith(`${user.id}/`)) {
      return NextResponse.json({ success: false, error: 'invalid_file_path' }, { status: 403 });
    }

    const { data: moduleRow, error: moduleError } = await supabaseAdmin
      .from('modules')
      .select('id')
      .eq('id', module_id)
      .eq('user_id', user.id)
      .single();
    if (moduleError || !moduleRow) {
      return NextResponse.json({ success: false, error: 'module_not_found' }, { status: 404 });
    }

    const { data: material, error: insertError } = await supabaseAdmin
      .from('study_materials')
      .insert({
        user_id: user.id,
        module_id,
        title: String(title || filename).trim().slice(0, 200),
        filename,
        file_path,
        mime_type: normalizedMimeType || null,
        file_size: Number.isFinite(normalizedFileSize) ? normalizedFileSize : null,
        status: 'processing',
      })
      .select()
      .single();

    if (insertError || !material) {
      console.error('Error creating study material:', insertError);
      return NextResponse.json({ success: false, error: 'create_failed' }, { status: 500 });
    }

    try {
      const { data: fileBlob, error: downloadError } = await supabaseAdmin
        .storage
        .from('lecture-media')
        .download(file_path);

      if (downloadError || !fileBlob) {
        throw new Error(downloadError?.message || 'download_failed');
      }

      const buffer = Buffer.from(await fileBlob.arrayBuffer());
      const { text } = await extractDocumentText(buffer, { mimeType: normalizedMimeType, filename });

      if (!text || text.length < 5) {
        await markFailed(material.id, 'No readable text was found in this file.');
        return NextResponse.json({ success: false, error: 'no_text_found' }, { status: 422 });
      }

      const { chunks, truncated } = chunkText(text);
      if (chunks.length === 0) {
        await markFailed(material.id, 'No usable text chunks could be produced from this file.');
        return NextResponse.json({ success: false, error: 'no_text_found' }, { status: 422 });
      }

      const embeddings = await embedDocumentChunks(chunks.map((c) => c.content));

      const { error: chunksError } = await supabaseAdmin
        .from('study_material_chunks')
        .insert(
          chunks.map((chunk, i) => ({
            study_material_id: material.id,
            user_id: user.id,
            module_id,
            chunk_index: chunk.index,
            content: chunk.content,
            embedding: embeddings[i],
          }))
        );

      if (chunksError) {
        throw new Error(chunksError.message);
      }

      const { data: updated, error: updateError } = await supabaseAdmin
        .from('study_materials')
        .update({
          status: 'completed',
          chunk_count: chunks.length,
          truncated,
          updated_at: new Date().toISOString(),
        })
        .eq('id', material.id)
        .select()
        .single();

      if (updateError) {
        console.error('Error finalizing study material:', updateError);
      }

      return NextResponse.json({ success: true, material: updated || material, chunkCount: chunks.length, truncated });

    } catch (processingError: any) {
      console.error('Error processing study material:', processingError);
      await markFailed(material.id, processingError.message || 'Processing failed');
      return NextResponse.json({ success: false, error: 'processing_failed', detail: processingError.message }, { status: 500 });
    }

  } catch (error: any) {
    console.error('Study material upload error:', error);
    return NextResponse.json({ success: false, error: 'server_error', detail: error.message }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
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

    const moduleId = request.nextUrl.searchParams.get('module_id');

    let query = supabaseAdmin
      .from('study_materials')
      .select('id, module_id, title, filename, mime_type, file_size, status, error, chunk_count, truncated, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (moduleId) {
      query = query.eq('module_id', moduleId);
    }

    const { data, error } = await query;
    if (error) {
      console.error('Error listing study materials:', error);
      return NextResponse.json({ success: false, error: 'list_failed' }, { status: 500 });
    }

    return NextResponse.json({ success: true, materials: data });
  } catch (error: any) {
    console.error('Study materials list error:', error);
    return NextResponse.json({ success: false, error: 'server_error' }, { status: 500 });
  }
}

async function markFailed(materialId: string, reason: string) {
  try {
    await supabaseAdmin
      .from('study_materials')
      .update({ status: 'failed', error: reason, updated_at: new Date().toISOString() })
      .eq('id', materialId);
  } catch (err) {
    console.error('Failed to mark study material as failed:', err);
  }
}