import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/supabase/auth';
import { DeepgramClient } from '@deepgram/sdk';

const DEEPGRAM_API_KEY = process.env.DEEPGRAM_API_KEY || '';

async function transcribeAudio(audioContent: Buffer, contentType: string): Promise<string> {
  if (!DEEPGRAM_API_KEY) {
    throw new Error('DEEPGRAM_API_KEY not set');
  }

  const deepgram = new DeepgramClient(DEEPGRAM_API_KEY);

  const options = {
    model: 'nova-2',
    language: 'en-US',
    punctuate: true,
    utterances: true,
  };

  try {
    const { result, error } = await deepgram.listen.prerecorded.transcribeFile(
      audioContent,
      options
    );

    if (error) {
      throw new Error(`Deepgram API error: ${error.message}`);
    }

    if (result && result.results && result.results.channels && result.results.channels.length > 0) {
      const channel = result.results.channels[0];
      const transcripts = channel.alternatives
        .map((alt: any) => alt.transcript || '')
        .filter((t: string) => t.length > 0);
      
      return transcripts.join(' ').trim();
    }

    return '';
  } catch (error) {
    throw new Error(`Transcription failed: ${error instanceof Error ? error.message : String(error)}`);
  }
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
