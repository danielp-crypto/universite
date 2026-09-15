// Extracts just the audio track from a video file, entirely in the browser,
// using ffmpeg.wasm. This exists to work around Supabase's free-tier 50MB
// upload limit: a lecture video can easily be several hundred MB, but the
// same lecture as compressed mono audio is typically well under 50MB even
// for a 90+ minute recording.
//
// Deliberately client-side rather than server-side: bundling a real ffmpeg
// binary into a Vercel serverless function eats most of the function's size
// budget (the static binary alone is 70-100MB) and risks CPU-time/duration
// limits on Hobby for anything but very short clips. Running it in the
// student's own browser has neither problem, at the cost of a one-time
// ~25-30MB WASM download the first time someone uploads a video (browser-
// cached after that; audio uploads and live recordings never trigger it).
//
// Uses the single-threaded @ffmpeg/core build specifically — the
// multi-threaded build is faster but requires Cross-Origin-Embedder-Policy /
// Cross-Origin-Opener-Policy response headers on every page of the site,
// which this app doesn't set. Single-threaded works anywhere with zero
// server config, just somewhat slower.

import { FFmpeg } from '@ffmpeg/ffmpeg';
import { toBlobURL, fetchFile } from '@ffmpeg/util';

const CORE_VERSION = '0.12.10';
const CORE_BASE_URL = `https://unpkg.com/@ffmpeg/core@${CORE_VERSION}/dist/umd`;

// Output settings match the bitrate cap already used for live MediaRecorder
// recordings elsewhere in the app — 32kbps mono Opus stays clearly
// intelligible for speech while keeping file size minimal. Output container
// is webm (not a bare .opus/ogg file) so the result reuses the exact same
// 'audio/webm' handling — allowed mime type, extension mapping, Deepgram
// model selection — that recorded and uploaded audio already goes through
// with no other code changes needed.
const AUDIO_BITRATE = '32k';
const OUTPUT_FILENAME = 'extracted-audio.webm';

let ffmpegInstance: FFmpeg | null = null;
let loadPromise: Promise<FFmpeg> | null = null;

// Loads and caches a single FFmpeg instance for the lifetime of the page.
// The ~25-30MB core download only happens once per session, the first time
// a video is uploaded, not on every page load.
async function getFFmpeg(onLog?: (message: string) => void): Promise<FFmpeg> {
  if (ffmpegInstance) return ffmpegInstance;
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    const ffmpeg = new FFmpeg();
    if (onLog) {
      ffmpeg.on('log', ({ message }) => onLog(message));
    }
    await ffmpeg.load({
      coreURL: await toBlobURL(`${CORE_BASE_URL}/ffmpeg-core.js`, 'text/javascript'),
      wasmURL: await toBlobURL(`${CORE_BASE_URL}/ffmpeg-core.wasm`, 'application/wasm'),
    });
    ffmpegInstance = ffmpeg;
    return ffmpeg;
  })();

  return loadPromise;
}

export interface ExtractAudioResult {
  blob: Blob;
  mimeType: 'audio/webm';
}

// Extracts audio from a video File, reporting 0-100 progress via onProgress.
// Throws on failure — callers should catch this and fall back to telling
// the student to try a different file, not silently upload the original
// (likely oversized) video.
export async function extractAudioFromVideo(
  file: File,
  onProgress?: (percent: number) => void
): Promise<ExtractAudioResult> {
  const ffmpeg = await getFFmpeg();

  const progressHandler = ({ progress }: { progress: number }) => {
    // ffmpeg.wasm's reported progress can occasionally exceed 1 or dip
    // below 0 right at the start/end of a job — clamp for a sane UI value.
    const percent = Math.min(100, Math.max(0, Math.round(progress * 100)));
    onProgress?.(percent);
  };
  ffmpeg.on('progress', progressHandler);

  const inputFilename = 'input' + (file.name.match(/\.[^/.]+$/)?.[0] || '.mp4');

  try {
    await ffmpeg.writeFile(inputFilename, await fetchFile(file));

    await ffmpeg.exec([
      '-i', inputFilename,
      '-vn',                    // drop video stream entirely
      '-c:a', 'libopus',
      '-b:a', AUDIO_BITRATE,
      '-ac', '1',                // mono — speech doesn't need stereo
      '-ar', '48000',
      OUTPUT_FILENAME,
    ]);

    const data = await ffmpeg.readFile(OUTPUT_FILENAME);
    const bytes = data instanceof Uint8Array ? data : new TextEncoder().encode(String(data));
    const blob = new Blob([bytes as BlobPart], { type: 'audio/webm' });

    return { blob, mimeType: 'audio/webm' };
  } finally {
    ffmpeg.off('progress', progressHandler);
    // Best-effort cleanup of the virtual filesystem — failures here don't
    // matter since each file uses a fixed name and gets overwritten next
    // time, but avoids slowly leaking memory across many uploads in one
    // session.
    try { await ffmpeg.deleteFile(inputFilename); } catch { /* ignore */ }
    try { await ffmpeg.deleteFile(OUTPUT_FILENAME); } catch { /* ignore */ }
  }
}