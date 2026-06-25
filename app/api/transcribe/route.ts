import { NextRequest, NextResponse } from 'next/server';
import ffmpeg from 'fluent-ffmpeg';
import { promisify } from 'util';
import { writeFile, unlink } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';

const DEEPGRAM_API_KEY = process.env.DEEPGRAM_API_KEY || '';
const DEEPGRAM_API_URL = 'https://api.deepgram.com/v1/listen';

const execAsync = promisify(require('child_process').exec);

async function extractAudioFromVideo(videoBuffer: Buffer, mimeType: string): Promise<Buffer> {
  const tempDir = tmpdir();
  const videoPath = join(tempDir, `input_${Date.now()}.${mimeType.split('/')[1]}`);
  const audioPath = join(tempDir, `output_${Date.now()}.wav`);

  try {
    // Write video file to disk
    await writeFile(videoPath, videoBuffer);

    // Extract audio using ffmpeg
    await new Promise<void>((resolve, reject) => {
      ffmpeg(videoPath)
        .toFormat('wav')
        .audioChannels(1)
        .audioFrequency(16000)
        .on('end', () => resolve())
        .on('error', (err) => reject(err))
        .save(audioPath);
    });

    // Read the extracted audio
    const fs = require('fs');
    const audioBuffer = fs.readFileSync(audioPath);

    // Clean up temporary files
    await unlink(videoPath).catch(() => {});
    await unlink(audioPath).catch(() => {});

    return audioBuffer;
  } catch (error) {
    // Clean up on error
    try {
      await unlink(videoPath).catch(() => {});
      await unlink(audioPath).catch(() => {});
    } catch (cleanupError) {
      console.error('Cleanup error:', cleanupError);
    }
    throw error;
  }
}

async function transcribeAudio(audioContent: Buffer, contentType: string): Promise<string> {
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
        body: new Blob([new Uint8Array(audioContent)]),
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
    // Check authentication - extract token from Authorization header
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.error('Transcription failed: No authorization header');
      return NextResponse.json(
        { success: false, error: 'unauthorized', message: 'Please log in to use transcription' },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    console.log('Transcription request received, token length:', token.length);
    
    // Optionally verify the token with Supabase
    // For now, we'll trust the token since it's coming from the authenticated client
    // If needed, we can add JWT verification here

    // Get audio/video file from request
    const formData = await request.formData();
    const mediaFile = formData.get('audio') as File;

    console.log('Media file received:', mediaFile ? mediaFile.name : 'null', 'size:', mediaFile?.size, 'type:', mediaFile?.type);

    if (!mediaFile) {
      return NextResponse.json(
        { success: false, error: 'missing_audio' },
        { status: 400 }
      );
    }

    let audioContent: Buffer;
    let contentType: string;

    // Check if file is video
    const videoTypes = ['video/mp4', 'video/webm', 'video/x-matroska', 'video/quicktime'];
    const isVideo = videoTypes.includes(mediaFile.type) || mediaFile.name.match(/\.(mp4|webm|mkv|mov)$/i);

    if (isVideo) {
      console.log('Video file detected, extracting audio...');
      try {
        const videoBuffer = Buffer.from(await mediaFile.arrayBuffer());
        audioContent = await extractAudioFromVideo(videoBuffer, mediaFile.type);
        contentType = 'audio/wav';
        console.log('Audio extraction completed');
      } catch (error) {
        console.error('Audio extraction failed:', error);
        return NextResponse.json(
          { success: false, error: 'audio_extraction_failed', details: error instanceof Error ? error.message : String(error) },
          { status: 500 }
        );
      }
    } else {
      // Audio file - use directly
      audioContent = Buffer.from(await mediaFile.arrayBuffer());
      contentType = mediaFile.type || 'audio/wav';
    }

    console.log('Audio content length:', audioContent.length);

    if (audioContent.length === 0) {
      return NextResponse.json(
        { success: false, error: 'empty_audio' },
        { status: 400 }
      );
    }

    console.log('Content type:', contentType);

    // Transcribe audio
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
