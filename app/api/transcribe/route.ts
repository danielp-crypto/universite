import { NextRequest, NextResponse } from 'next/server';

const DEEPGRAM_API_KEY = process.env.DEEPGRAM_API_KEY || '';
const DEEPGRAM_API_URL = 'https://api.deepgram.com/v1/listen';

async function transcribeAudio(audioContent: Uint8Array | Buffer, contentType: string): Promise<string> {
  if (!DEEPGRAM_API_KEY) {
    throw new Error('DEEPGRAM_API_KEY not set');
  }

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
          'Content-Type': contentType || 'audio/wav',
        },
        body: new Blob([audioContent]),
      });

      if (response.ok) {
        const result = await response.json();
        
        if (result.results && result.results.channels && result.results.channels.length > 0) {
          const channel = result.results.channels[0];
          const transcripts = channel.alternatives
            .map((alt: any) => alt.transcript || '')
            .filter((t: string) => t.length > 0);
          
          return transcripts.join(' ').trim();
        }
        return '';
      } else {
        const errorText = await response.text();
        lastError = `Deepgram API error: ${response.status} - ${response.statusText} - ${errorText}`;
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
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.error('Transcription failed: No authorization header');
      return NextResponse.json(
        { success: false, error: 'unauthorized', message: 'Please log in to use transcription' },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);
    console.log('Transcription request received, token length:', token.length);

    const formData = await request.formData();
    const mediaFile = formData.get('audio') as File;

    console.log('Media file received:', mediaFile ? mediaFile.name : 'null', 'size:', mediaFile?.size, 'type:', mediaFile?.type);

    if (!mediaFile) {
      return NextResponse.json(
        { success: false, error: 'missing_audio' },
        { status: 400 }
      );
    }

    const audioContent = Buffer.from(await mediaFile.arrayBuffer());
    const contentType = mediaFile.type || 'audio/wav';

    console.log('Audio content length:', audioContent.length);

    if (audioContent.length === 0) {
      return NextResponse.json(
        { success: false, error: 'empty_audio' },
        { status: 400 }
      );
    }

    console.log('Content type:', contentType);
    console.log('Starting transcription...');
    const transcript = await transcribeAudio(audioContent, contentType);
    console.log('Transcription completed, length:', transcript.length);

    return NextResponse.json({
      success: true,
      transcript: transcript
    });

  } catch (error) {
    console.error('Transcription error:', error);
    
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Error message:', errorMessage);
    
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