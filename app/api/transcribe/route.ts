import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/supabase/auth';

const DEEPGRAM_API_KEY = process.env.DEEPGRAM_API_KEY || '';
const DEEPGRAM_API_URL = 'https://api.deepgram.com/v1/listen';

async function transcribeAudio(audioContent: Buffer, contentType: string): Promise<string> {
  if (!DEEPGRAM_API_KEY) {
    throw new Error('DEEPGRAM_API_KEY not set');
  }

  const formData = new FormData();
  
  let filename = 'audio';
  if (contentType) {
    if (contentType.includes('wav')) filename += '.wav';
    else if (contentType.includes('mp3')) filename += '.mp3';
    else if (contentType.includes('webm')) filename += '.webm';
    else if (contentType.includes('flac')) filename += '.flac';
    else filename += '.audio';
  }

  formData.append('file', new Blob([audioContent], { type: contentType || 'audio/wav' }), filename);

  const params = new URLSearchParams({
    model: 'nova-2',
    language: 'en-US',
    punctuate: 'true',
    utterances: 'true'
  });

  const maxRetries = 3;
  let retryDelay = 1000;
  let lastError: string = '';

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch(`${DEEPGRAM_API_URL}?${params}`, {
        method: 'POST',
        headers: {
          'Authorization': `Token ${DEEPGRAM_API_KEY}`,
        },
        body: formData,
      });

      if (response.ok) {
        const result = await response.json();
        
        if (result.results && result.results.length > 0) {
          const transcripts = result.results
            .map((r: any) => r.alternatives?.[0]?.transcript || '')
            .filter((t: string) => t.length > 0);
          
          return transcripts.join(' ').trim();
        }
        return '';
      } else {
        lastError = `Deepgram API error: ${response.status} - ${response.statusText}`;
      }
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }

    if (attempt < maxRetries - 1) {
      await new Promise(resolve => setTimeout(resolve, retryDelay));
      retryDelay *= 2;
    }
  }

  throw new Error(`Transcription failed after ${maxRetries} attempts: ${lastError}`);
}

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'unauthorized' },
        { status: 401 }
      );
    }

    // Get audio file from request
    const formData = await request.formData();
    const audioFile = formData.get('audio') as File;
    
    if (!audioFile) {
      return NextResponse.json(
        { success: false, error: 'missing_audio' },
        { status: 400 }
      );
    }

    // Read audio content
    const audioContent = Buffer.from(await audioFile.arrayBuffer());
    
    if (audioContent.length === 0) {
      return NextResponse.json(
        { success: false, error: 'empty_audio' },
        { status: 400 }
      );
    }

    const contentType = audioFile.type || 'audio/wav';

    // Transcribe audio
    const transcript = await transcribeAudio(audioContent, contentType);

    return NextResponse.json({
      success: true,
      transcript: transcript
    });

  } catch (error) {
    console.error('Transcription error:', error);
    
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    if (errorMessage.includes('DEEPGRAM_API_KEY')) {
      return NextResponse.json(
        { success: false, error: 'deepgram_not_configured' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { success: false, error: 'transcription_failed', details: errorMessage },
      { status: 500 }
    );
  }
}
