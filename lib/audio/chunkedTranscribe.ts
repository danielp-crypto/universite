/**
 * Vercel Functions cap request bodies at 4.5MB (hard limit, returns
 * 413 FUNCTION_PAYLOAD_TOO_LARGE above that). A full lecture recording sent
 * as a single multipart upload blows past that in a few minutes.
 *
 * This module decodes whatever audio we have (a live MediaRecorder blob or
 * an uploaded file) into mono 16kHz PCM in the browser via the Web Audio
 * API, splits it into fixed-length chunks, encodes each chunk as a small
 * WAV blob, and transcribes them individually through the existing
 * /api/transcribe route — no server changes needed. Chunk size is chosen
 * to stay comfortably under the 4.5MB ceiling even with multipart overhead.
 */

const TARGET_SAMPLE_RATE = 16000;
const CHUNK_SECONDS = 90; // ~2.9MB per WAV chunk at 16kHz mono 16-bit
const UPLOAD_CONCURRENCY = 3; // keep Deepgram calls modest for multi-chunk lectures
const MAX_ATTEMPTS_PER_CHUNK = 2;

export interface ChunkedTranscribeResult {
  success: boolean;
  transcript?: string;
  error?: string;
  chunkCount?: number;
  failedChunks?: number;
}

async function decodeToMonoPCM(blob: Blob): Promise<{ samples: Float32Array; sampleRate: number }> {
  const arrayBuffer = await blob.arrayBuffer();
  const AudioContextCtor = window.AudioContext || (window as any).webkitAudioContext;
  const audioCtx = new AudioContextCtor();

  let decoded: AudioBuffer;
  try {
    decoded = await audioCtx.decodeAudioData(arrayBuffer.slice(0));
  } finally {
    audioCtx.close();
  }

  // Downmix to mono
  const numChannels = decoded.numberOfChannels;
  const mono = new Float32Array(decoded.length);
  for (let ch = 0; ch < numChannels; ch++) {
    const data = decoded.getChannelData(ch);
    for (let i = 0; i < data.length; i++) {
      mono[i] += data[i] / numChannels;
    }
  }

  if (decoded.sampleRate === TARGET_SAMPLE_RATE) {
    return { samples: mono, sampleRate: TARGET_SAMPLE_RATE };
  }

  // Resample to 16kHz — Deepgram doesn't need more, and it keeps chunks small.
  const OfflineCtor = window.OfflineAudioContext || (window as any).webkitOfflineAudioContext;
  const targetLength = Math.ceil((mono.length * TARGET_SAMPLE_RATE) / decoded.sampleRate);
  const offlineCtx = new OfflineCtor(1, targetLength, TARGET_SAMPLE_RATE);
  const monoBuffer = offlineCtx.createBuffer(1, mono.length, decoded.sampleRate);
  monoBuffer.copyToChannel(mono, 0);
  const source = offlineCtx.createBufferSource();
  source.buffer = monoBuffer;
  source.connect(offlineCtx.destination);
  source.start(0);
  const rendered = await offlineCtx.startRendering();
  return { samples: rendered.getChannelData(0).slice(), sampleRate: TARGET_SAMPLE_RATE };
}

function chunkSamples(samples: Float32Array, sampleRate: number, chunkSeconds: number): Float32Array[] {
  const chunkSize = chunkSeconds * sampleRate;
  const chunks: Float32Array[] = [];
  for (let start = 0; start < samples.length; start += chunkSize) {
    chunks.push(samples.subarray(start, Math.min(start + chunkSize, samples.length)));
  }
  return chunks.length > 0 ? chunks : [samples];
}

function encodeWavPCM16(samples: Float32Array, sampleRate: number): Blob {
  const dataSize = samples.length * 2; // 16-bit mono
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true); // PCM chunk size
  view.setUint16(20, 1, true); // format = PCM
  view.setUint16(22, 1, true); // channels = mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // byte rate
  view.setUint16(32, 2, true); // block align
  view.setUint16(34, 16, true); // bits per sample
  writeString(36, 'data');
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    offset += 2;
  }

  return new Blob([buffer], { type: 'audio/wav' });
}

async function runWithConcurrencyLimit<T>(tasks: (() => Promise<T>)[], limit: number): Promise<T[]> {
  const results: T[] = new Array(tasks.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < tasks.length) {
      const current = nextIndex++;
      results[current] = await tasks[current]();
    }
  }

  const workers = Array.from({ length: Math.min(limit, tasks.length) }, worker);
  await Promise.all(workers);
  return results;
}

async function transcribeChunk(
  wavBlob: Blob,
  index: number,
  accessToken: string
): Promise<string | null> {
  let lastError = '';
  for (let attempt = 0; attempt < MAX_ATTEMPTS_PER_CHUNK; attempt++) {
    try {
      const formData = new FormData();
      formData.append('audio', wavBlob, `chunk-${index}.wav`);

      const response = await fetch('/api/transcribe', {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
        body: formData
      });
      const data = await response.json().catch(() => ({}));

      if (response.ok && data.success) {
        return (data.transcript || '').trim();
      }
      lastError = data.error || `HTTP ${response.status}`;
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
    }
  }
  console.error(`Chunk ${index} failed after ${MAX_ATTEMPTS_PER_CHUNK} attempts:`, lastError);
  return null;
}

/**
 * Decodes, chunks, and transcribes an audio Blob/File of any length.
 * Returns the same shape the old single-shot /api/transcribe fetch did
 * ({ success, transcript }), so call sites only need to swap the fetch
 * for this call.
 */
export async function transcribeAudioChunked(
  audioSource: Blob,
  accessToken: string,
  onProgress?: (message: string) => void
): Promise<ChunkedTranscribeResult> {
  try {
    onProgress?.('Preparing audio...');
    const { samples, sampleRate } = await decodeToMonoPCM(audioSource);
    const sampleChunks = chunkSamples(samples, sampleRate, CHUNK_SECONDS);

    onProgress?.(
      sampleChunks.length > 1
        ? `Transcribing audio in ${sampleChunks.length} parts...`
        : 'Transcribing audio...'
    );

    let completed = 0;
    const tasks = sampleChunks.map((chunk, index) => async () => {
      const wavBlob = encodeWavPCM16(chunk, sampleRate);
      const result = await transcribeChunk(wavBlob, index, accessToken);
      completed++;
      if (sampleChunks.length > 1) {
        onProgress?.(`Transcribed ${completed} of ${sampleChunks.length} parts...`);
      }
      return result;
    });

    const results = await runWithConcurrencyLimit(tasks, UPLOAD_CONCURRENCY);
    const failedChunks = results.filter((r) => r === null).length;
    const transcript = results.filter((r): r is string => r !== null).join(' ').trim();

    if (transcript.length === 0) {
      return {
        success: false,
        error: 'Transcription failed for all audio segments. Please check your connection and try again.'
      };
    }

    if (failedChunks > 0) {
      console.warn(`${failedChunks} of ${sampleChunks.length} audio chunks failed to transcribe; continuing with partial transcript.`);
    }

    return { success: true, transcript, chunkCount: sampleChunks.length, failedChunks };
  } catch (err) {
    console.error('Chunked transcription error:', err);
    return {
      success: false,
      error:
        err instanceof Error
          ? err.message
          : 'Failed to process this audio file. Try a different format (mp3, wav, or m4a) or re-record.'
    };
  }
}
