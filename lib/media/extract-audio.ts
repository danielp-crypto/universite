import ffmpegPath from 'ffmpeg-static';
import { spawn } from 'node:child_process';
import {
  mkdtemp,
  writeFile,
  readFile,
  rm,
} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

if (!ffmpegPath) {
  throw new Error(
    'FFmpeg binary could not be located'
  );
}

/**
 * Extracts the audio track from a video and returns
 * a normalized MP3 buffer.
 *
 * Output:
 * - MP3
 * - mono
 * - 16 kHz
 * - 128 kbps
 *
 * 16 kHz mono is more than sufficient for lecture
 * transcription and keeps the processed file small.
 */
export async function extractAudioToMp3(
  inputBuffer: Buffer
): Promise<Buffer> {
  const tempDirectory =
    await mkdtemp(
      path.join(
        os.tmpdir(),
        'universite-ffmpeg-'
      )
    );

  const inputPath = path.join(
    tempDirectory,
    'input-video'
  );

  const outputPath = path.join(
    tempDirectory,
    'output.mp3'
  );

  try {
    await writeFile(
      inputPath,
      inputBuffer
    );

    await runFfmpeg(
      inputPath,
      outputPath
    );

    const outputBuffer =
      await readFile(outputPath);

    if (!outputBuffer.length) {
      throw new Error(
        'FFmpeg produced an empty audio file'
      );
    }

    return outputBuffer;
  } finally {
    await rm(
      tempDirectory,
      {
        recursive: true,
        force: true,
      }
    ).catch(() => {});
  }
}

function runFfmpeg(
  inputPath: string,
  outputPath: string
): Promise<void> {
  return new Promise(
    (resolve, reject) => {
      const args = [
        '-hide_banner',

        // Don't ask questions / overwrite.
        '-y',

        // Input.
        '-i',
        inputPath,

        // Remove video.
        '-vn',

        // Audio codec.
        '-c:a',
        'libmp3lame',

        // Lecture-friendly quality.
        '-b:a',
        '128k',

        // Mono is sufficient for speech.
        '-ac',
        '1',

        // 16 kHz is sufficient for speech transcription.
        '-ar',
        '16000',

        // Explicit MP3 format.
        '-f',
        'mp3',

        // Output.
        outputPath,
      ];

      const ffmpeg = spawn(
        ffmpegPath as string,
        args,
        {
          stdio: [
            'ignore',
            'pipe',
            'pipe',
          ],
        }
      );

      let stderr = '';

      ffmpeg.stderr.on(
        'data',
        (chunk) => {
          stderr +=
            chunk.toString();
        }
      );

      ffmpeg.on(
        'error',
        (error) => {
          reject(
            new Error(
              `FFmpeg failed to start: ${error.message}` 
            )
          );
        }
      );

      ffmpeg.on(
        'close',
        (code) => {
          if (code === 0) {
            resolve();
            return;
          }

          reject(
            new Error(
              `FFmpeg exited with code ${code}: ${
                stderr.slice(-4000)
              }`
            )
          );
        }
      );
    }
  );
}
