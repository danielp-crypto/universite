import { NextRequest, NextResponse } from 'next/server';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';

// Safety cap to avoid runaway cost/quota usage on pathological inputs.
// This is generous on purpose — a 90min lecture transcript is typically
// 60k-100k characters. Raise further if you expect longer lectures.
const MAX_TRANSCRIPT_CHARS = 200000;

const MAP_PROMPT = `You are a content extractor for lecture transcripts. Your ONLY job: extract key academic content. Ignore everything else.

INPUT: A 10-minute chunk of a South African university lecture transcript.

EXTRACT ONLY:
1. Definitions (term + explanation)
2. Formulas (equation + when to use it)
3. Lists (enumerated items)
4. Cause→effect relationships
5. Comparisons (X vs Y)
6. Anything said after: "important", "exam", "remember", "test you on", "this always comes up"

IGNORE:
- Admin talk, jokes, "can you hear me"
- Registration, assignment dates (unless marks mentioned)
- "um", "okay so", "right", filler words
- Loadshedding interruptions
- Lecturer going off-topic

OUTPUT FORMAT:
Return bullets only. Each bullet must include:
- The content (definition, formula, etc.)
- Approximate timestamp if mentioned
- No explanations, no fluff

Example output:
- Photosynthesis = process where plants convert light energy to chemical energy [12:34]
- Newton's Second Law: F = ma, used when calculating force from mass and acceleration [15:20]
- "This will be on the exam" [23:45]

Transcript chunk:\n\n`;

const REDUCE_PROMPT = `You are "Exam Buddy", a Unisa tutor with 10 years experience. Your only job: turn 90min rambly lectures into notes that help a working student pass tomorrow's test.

INPUT: Extracted key content from a South African university lecture (already cleaned of fluff).

OUTPUT RULES:
1. IGNORE: admin talk, jokes, "can you hear me", registration, assignment dates unless marks are mentioned.
2. FIND: definitions, formulas, lists, cause→effect, comparisons, and anything said after "important", "exam", "remember", "test you on".
3. FORMAT: Use this exact structure, no deviation:

## Key Concepts [3-5 only]
- **[Term]**: Definition in 1 sentence, like you'd explain to a friend. [timestamp]
- **Formula**: Name = equation + when to use it [timestamp]

## Exam Hints Detected
- "He said 'this always comes up' at 23:14"
- "Repeated 3x: difference between X and Y" [12:03, 45:22, 78:01]

## Summary: 5-Bullet Pass Guarantee
1. If you only study 5 things, study these. Each = 1 sentence. No fluff.

## Test Yourself: 5 Questions
Create 5 questions using Bloom's taxonomy. Base ONLY on transcript facts.
Format:
Q1 [Recall]: What is ___? [timestamp]
Q2 [Understand]: Explain why ___ happens [timestamp]
Q3 [Apply]: If ___, calculate ___ [timestamp]
Q4 [Analyze]: Compare X vs Y from lecture [timestamp]
Q5 [Evaluate]: Which is better for ___ and why? [timestamp]

4. TONE: 8th grade English. Short sentences. No "furthermore". No "it is important to note".
5. HALLUCINATION BAN: If info not in transcript, write "Not covered in this lecture". Never invent.
6. SA CONTEXT: Keep ZAR, Unisa module codes, South African examples. Don't convert to USD.

CONTEXT: Student is at Unisa. Works full time. Studies on taxi. Has 20min to revise. Make every word count.

Extracted content:\n\n`;

// Split transcript into chunks by WORD COUNT (~10 minutes of speech each).
// Average spoken English is roughly 130-150 words/minute, so ~1300-1500
// words covers a 10-minute chunk. Bumped default from 2000 to a more
// accurate ~1400, but exposed as a param so it's easy to tune.
function splitIntoChunks(transcript: string, wordsPerChunk: number = 1400): string[] {
  const words = transcript.split(/\s+/).filter(Boolean);
  const chunks: string[] = [];

  for (let i = 0; i < words.length; i += wordsPerChunk) {
    const chunk = words.slice(i, i + wordsPerChunk).join(' ');
    chunks.push(chunk);
  }

  return chunks;
}

// Map step: Extract key info from each chunk
async function mapChunk(chunk: string, index: number): Promise<string> {
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': GEMINI_API_KEY,
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: MAP_PROMPT + chunk
            }]
          }],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 500,
          }
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Map chunk ${index} failed (status ${response.status}): ${errorText}`);
    }

    const result = await response.json();
    const text = result.candidates?.[0]?.content?.parts?.[0]?.text || '';

    if (!text) {
      console.warn(`Map chunk ${index} produced no output. Finish reason:`, result.candidates?.[0]?.finishReason);
    }

    return text;
  } catch (error) {
    // Re-throw with context instead of swallowing — let the caller decide
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`mapChunk[${index}]: ${message}`);
  }
}

// Reduce step: Generate final summary from extracted content
async function reduceSummary(extractedContent: string): Promise<string> {
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': GEMINI_API_KEY,
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: REDUCE_PROMPT + extractedContent
            }]
          }],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 2048,
          }
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Reduce summary error:', errorText);
      throw new Error('Reduce summary error');
    }

    const result = await response.json();
    const text = result.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const finishReason = result.candidates?.[0]?.finishReason;

    if (finishReason === 'MAX_TOKENS') {
      console.warn('Reduce summary was cut off by maxOutputTokens — consider raising the limit further.');
    }

    return text;
  } catch (error) {
    console.error('Reduce summary error:', error);
    throw error;
  }
}

async function generateSummary(transcript: string): Promise<string> {
  if (!GEMINI_API_KEY) {
    // Fallback to simple bullet point extraction if no API key
    return '[FALLBACK REASON: GEMINI_API_KEY is falsy]\n' + generateSimpleBulletPoints(transcript);
  }

  try {
    // Step 1: Split transcript into chunks
    const chunks = splitIntoChunks(transcript);
    console.log(`Transcript length: ${transcript.length} chars, ${transcript.split(/\s+/).length} words`);
    console.log(`Split transcript into ${chunks.length} chunks`);

    // Step 2: Map - Extract key info from each chunk (with index for debugging)
    const mapResults = await Promise.all(
      chunks.map((chunk, index) => mapChunk(chunk, index))
    );

    const successfulChunks = mapResults.filter(result => result.length > 0).length;
    console.log(`${successfulChunks}/${chunks.length} chunks produced content`);

    const extractedContent = mapResults.filter(result => result.length > 0).join('\n\n');

    console.log('Extracted content length:', extractedContent.length);

    if (extractedContent.length === 0) {
      // If no content extracted, fall back to simple bullet points
      console.warn('No content extracted from any chunk — falling back to simple bullet points');
      return generateSimpleBulletPoints(transcript);
    }

    // Step 3: Reduce - Generate final summary from extracted content
    const summary = await reduceSummary(extractedContent);

    console.log('Generated summary length:', summary.length);
    console.log('Summary preview:', summary.substring(0, 200));

    return summary;
  } catch (error) {
    // TEMP: surface the real error in the response so we can diagnose it
    throw error;
  }
}

function generateSimpleBulletPoints(transcript: string): string {
  // Split transcript into sentences
  const sentences = transcript
    .split(/[.!?]+/)
    .map(s => s.trim())
    .filter(s => s.length > 10);

  // Select key sentences (every 3rd sentence to get main points)
  const keyPoints = sentences
    .filter((_, index) => index % 3 === 0)
    .slice(0, 5);

  // Format as bullet points
  return keyPoints
    .map(point => `• ${point}`)
    .join('\n');
}

function formatAsBulletPoints(text: string): string {
  // If already has bullet points, return as is
  if (text.includes('•') || text.includes('-') || text.includes('*')) {
    return text;
  }

  // Split into sentences and format as bullet points
  const sentences = text
    .split(/[.!?]+/)
    .map(s => s.trim())
    .filter(s => s.length > 10);

  return sentences
    .map(sentence => `• ${sentence}`)
    .join('\n');
}

export async function POST(request: NextRequest) {
  try {
    const { transcript } = await request.json();

    if (!transcript || typeof transcript !== 'string') {
      return NextResponse.json(
        { success: false, error: 'missing_transcript' },
        { status: 400 }
      );
    }

    // Only cap extremely long inputs as a safety net — this is no longer
    // the silent 4000-char truncation that was eating most lectures.
    const truncatedTranscript = transcript.length > MAX_TRANSCRIPT_CHARS
      ? transcript.substring(0, MAX_TRANSCRIPT_CHARS)
      : transcript;

    if (transcript.length > MAX_TRANSCRIPT_CHARS) {
      console.warn(`Transcript truncated from ${transcript.length} to ${MAX_TRANSCRIPT_CHARS} chars`);
    }

    const summary = await generateSummary(truncatedTranscript);

    return NextResponse.json({
      success: true,
      summary: summary,
      _v: 'debug-4'
    });

  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { success: false, error: 'summary_generation_failed', detail: message },
      { status: 500 }
    );
  }
}