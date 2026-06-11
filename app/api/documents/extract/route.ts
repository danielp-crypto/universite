import { NextRequest, NextResponse } from 'next/server';
import pdf from 'pdf-parse';
import mammoth from 'mammoth';
import { supabaseAdmin } from '@/lib/supabase/client';

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'unauthorized' },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json(
        { error: 'unauthorized' },
        { status: 401 }
      );
    }

    const { documentId, type, content } = await request.json();

    if (!documentId || !type || !content) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    let text = '';

    // Convert base64 back to buffer
    const buffer = Buffer.from(content, 'base64');

    if (type === 'application/pdf') {
      // Extract text from PDF
      const data = await pdf(buffer);
      text = data.text;
    } else if (type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      // Extract text from DOCX
      const result = await mammoth.extractRawText({ buffer });
      text = result.value;
    } else if (type === 'application/msword') {
      // For older .doc files, we might need a different library
      // For now, return an error
      return NextResponse.json(
        { error: 'Old .doc format not supported yet. Please convert to .docx' },
        { status: 400 }
      );
    }

    // Clean up the extracted text
    text = text
      .replace(/\s+/g, ' ')
      .replace(/\n\s*\n/g, '\n\n')
      .trim();

    // Update the document with extracted text in Supabase
    const { error: updateError } = await supabaseAdmin
      .from('documents')
      .update({ text: text })
      .eq('id', documentId)
      .eq('user_id', user.id);

    if (updateError) {
      console.error('Supabase update error:', updateError);
      return NextResponse.json(
        { error: 'Failed to update document' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      text: text
    });

  } catch (error) {
    console.error('Text extraction error:', error);
    return NextResponse.json(
      { error: 'Text extraction failed' },
      { status: 500 }
    );
  }
}
