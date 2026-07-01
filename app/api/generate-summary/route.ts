import { NextRequest, NextResponse } from 'next/server';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';

// Safety cap to avoid runaway cost/quota usage on pathological inputs.
// This is generous on purpose — a 90min lecture transcript is typically
// 60k-100k characters. Raise further if you expect longer lectures.
const MAX_TRANSCRIPT_CHARS = 200000;

const MAP_PROMPT = `You are a content extractor for lecture transcripts. Your ONLY job: extract key academic content. Ignore everything else.

INPUT: A 10-minute chunk of a South African university lecture transcript.

EXTRACT ONLY, and tag each bullet with exactly one of these prefixes so it can be filtered and ranked later:
[DEF] Definitions — term, then "::", then the lecturer's OWN explanation as they actually said it. Do NOT write a generic textbook definition — use their specific wording, numbers, or examples.
[FORMULA] Formulas — equation, then "::", then when to use it.
[LIST] Enumerated lists.
[CAUSE] Cause→effect relationships.
[COMPARE] Comparisons (X vs Y).
[FLAG] Anything said after: "important", "exam", "remember", "test you on", "this always comes up". Note which term/topic it was about.

IGNORE:
- Admin talk, jokes, "can you hear me"
- Registration, assignment dates (unless marks mentioned)
- "um", "okay so", "right", filler words
- Loadshedding interruptions
- Lecturer going off-topic

RULES:
- For [DEF] and [FORMULA], the term must be the actual name of the concept — 1 to 4 words, exactly as it would appear in a glossary or index. Never a full sentence or clause.
- If you're not confident something is a real key concept (vs. the lecturer thinking aloud or a one-off aside), leave it out. Fewer accurate bullets beats more vague ones.
- No explanations, no fluff, no editorializing.

OUTPUT FORMAT:
One tagged bullet per line. Include approximate timestamp if mentioned.

Example output:
- [DEF] Photosynthesis :: plants convert light energy into chemical energy stored as glucose — lecturer's example was a sunflower turning toward the sun [12:34]
- [FORMULA] Newton's Second Law :: F = ma, used when calculating force from mass and acceleration [15:20]
- [FLAG] "This will always come up" — re: difference between mitosis and meiosis [23:45]

Transcript chunk:\n\n`;

const REDUCE_PROMPT = `You are "Exam Buddy", a Unisa tutor with 10 years experience. Your only job: turn 90min rambly lectures into notes that help a working student pass tomorrow's test.

INPUT: Extracted key content from a South African university lecture, already tagged by type ([DEF], [FORMULA], [LIST], [CAUSE], [COMPARE], [FLAG]) and cleaned of fluff.

OUTPUT RULES:
1. IGNORE: admin talk, jokes, "can you hear me", registration, assignment dates unless marks are mentioned.
2. FORMAT: Use this exact structure, no deviation:

## Key Concepts [one-word terms]
Pick which [DEF]/[FORMULA] items to keep using this priority order, in this order:
  1. Anything whose term also appears in a [FLAG] item — these are confirmed exam-relevant. Always include first.
  2. Terms that show up in [DEF]/[FORMULA] bullets from more than one chunk — repetition means the lecturer kept returning to it.
  3. Foundational terms the rest of the lecture depends on, over one-off mentions.
Skip anything mentioned only once in passing with no other signal of importance. If fewer than 3 terms meet this bar, it's fine to return fewer than 5 — never pad with filler to hit the count.

Term rules — get this right, it matters most:
- Term = 1 word MAX. The actual name of the concept, as it would appear in a glossary or index. Never a sentence, question, or clause.
- Definition = 1 sentence, using the lecturer's own specific explanation, example, or numbers from the transcript — never a generic textbook definition you already knew. If they gave a specific example or analogy, keep it.
- Format exactly: **Term**: Definition. [timestamp]

GOOD: **Mitosis**: Cell splits into two identical daughter cells with the same chromosome number — same example as skin healing after a cut. [14:02]
BAD: **The process of cell division**: This is when a cell goes through several phases in order to divide into new cells. [14:02]
(BAD is wrong on two counts: the term is a clause, not a glossary entry, and the definition is generic — it ignores what the lecturer actually said.)

## Full Notes with Slide References
Provide comprehensive notes organized by topics. Include slide numbers if mentioned in the transcript. Use bullet points for key information. Include examples and explanations from the lecturer.

Format:
### Topic 1 [Slide X if mentioned]
- Key point 1 [timestamp]
- Key point 2 [timestamp]
- Example from lecturer [timestamp]

### Topic 2 [Slide Y if mentioned]
- Key point 1 [timestamp]
- Key point 2 [timestamp]

## Exam Hints Detected
- "He said 'this always comes up' at 23:14"
- "Repeated 3x: difference between X and Y" [12:03, 45:22, 78:01]

## Summary: 5-Bullet Pass Guarantee
1. If you only study 5 things, study these. Each = 1 sentence. No fluff.

## Exam-Style Questions (10 Questions) + Memo
Create 10 exam-style questions using Bloom's taxonomy. Base ONLY on transcript facts. Include a memo/model answer for each question.

Format:
Q1 [Recall]: What is ___? [timestamp]
A1: [Detailed model answer based on transcript]

Q2 [Understand]: Explain why ___ happens [timestamp]
A2: [Detailed model answer based on transcript]

Q3 [Apply]: If ___, calculate ___ [timestamp]
A3: [Detailed model answer based on transcript]

Q4 [Analyze]: Compare X vs Y from lecture [timestamp]
A4: [Detailed model answer based on transcript]

Q5 [Evaluate]: Which is better for ___ and why? [timestamp]
A5: [Detailed model answer based on transcript]

Q6 [Recall]: ___ [timestamp]
A6: [Detailed model answer based on transcript]

Q7 [Understand]: ___ [timestamp]
A7: [Detailed model answer based on transcript]

Q8 [Apply]: ___ [timestamp]
A8: [Detailed model answer based on transcript]

Q9 [Analyze]: ___ [timestamp]
A9: [Detailed model answer based on transcript]

Q10 [Evaluate]: ___ [timestamp]
A10: [Detailed model answer based on transcript]

## Cheat Sheet

### Formulas
List all formulas mentioned in the lecture with when to use them:
- Formula 1: When to use it [timestamp]
- Formula 2: When to use it [timestamp]

### Glossary of Definitions
List ALL definitions mentioned in the lecture (not just the key concepts):
- **Term**: Definition [timestamp]
- **Term**: Definition [timestamp]

3. TONE: 8th grade English. Short sentences. No "furthermore". No "it is important to note".
4. HALLUCINATION BAN: If info not in transcript, write "Not covered in this lecture". Never invent.
5. SA CONTEXT: Keep ZAR, Unisa module codes, South African examples. Don't convert to USD.

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
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent`,
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
            maxOutputTokens: 600,
            thinkingConfig: {
              thinkingBudget: 0
            }
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
    const message = error instanceof Error ? error.message : String(error);
    console.error(`mapChunk[${index}] failed, skipping this chunk:`, message);
    return '';
  }
}

// Reduce step: Generate final summary from extracted content
async function reduceSummary(extractedContent: string): Promise<string> {
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent`,
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
            maxOutputTokens: 8192,
            thinkingConfig: {
              thinkingBudget: 0
            }
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
    console.warn('GEMINI_API_KEY is not set — using simple bullet point fallback');
    return generateSimpleBulletPoints(transcript);
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
    const message = error instanceof Error ? error.message : String(error);
    console.error('Summary generation failed, using simple bullet point fallback:', message);
    return generateSimpleBulletPoints(transcript);
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
      summary: summary
    });

  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { success: false, error: 'summary_generation_failed', detail: message },
      { status: 500 }
    );
  }
}