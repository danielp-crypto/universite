import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // Validate file type
    const validTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (!validTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Please upload a PDF or Word document.' },
        { status: 400 }
      );
    }

    // Generate a unique document ID
    const documentId = crypto.randomUUID();

    // Convert file to base64 for storage
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const base64 = buffer.toString('base64');

    // Store document in localStorage-like structure (for now, using a simple approach)
    // In production, this should be stored in Supabase or a file storage service
    const documentData = {
      id: documentId,
      name: file.name,
      type: file.type,
      size: file.size,
      content: base64,
      uploadedAt: new Date().toISOString(),
      text: '', // Will be extracted later
      summary: '',
      questions: []
    };

    // Store in a simple in-memory storage (for development)
    // In production, this would be stored in Supabase
    const documents = JSON.parse(localStorage.getItem('universite_documents') || '[]');
    documents.push(documentData);
    localStorage.setItem('universite_documents', JSON.stringify(documents));

    return NextResponse.json({
      success: true,
      documentId: documentId,
      document: documentData
    });

  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: 'Upload failed' },
      { status: 500 }
    );
  }
}
