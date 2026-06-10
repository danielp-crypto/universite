import { NextRequest, NextResponse } from 'next/server';
import pdf from 'pdf-parse';
import mammoth from 'mammoth';

export async function POST(request: NextRequest) {
  try {
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

    // Update the document with extracted text
    const documents = JSON.parse(localStorage.getItem('universite_documents') || '[]');
    const docIndex = documents.findIndex((doc: any) => doc.id === documentId);
    if (docIndex !== -1) {
      documents[docIndex].text = text;
      localStorage.setItem('universite_documents', JSON.stringify(documents));
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
