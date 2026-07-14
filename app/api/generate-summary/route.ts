import { NextRequest, NextResponse } from 'next/server';

// Map-reduce over many chunks (long lectures) plus the Gemini reduce call
// can take a while; make sure Vercel doesn't cut the function off early.
export const maxDuration = 120;

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';

// Safety cap to avoid runaway cost/quota usage on pathological inputs.
// This is generous on purpose — a 90min lecture transcript is typically
// 60k-100k characters. Raise further if you expect longer lectures.
const MAX_TRANSCRIPT_CHARS = 200000;

const MAP_PROMPT = `You are a content extractor for South African university lecture transcripts. Your ONLY job: extract key academic content that will help students prepare for assessments. Ignore everything else.

INPUT: A 10-minute chunk of a South African university lecture transcript. The professor is using slides (PowerPoint, PDF, or similar) as visual aids.

EXTRACT ONLY, and tag each bullet with exactly one of these prefixes so it can be filtered and ranked later:
[DEF] Definitions — term, then "::", then the lecturer's OWN explanation as they actually said it. Do NOT write a generic textbook definition — use their specific wording, numbers, or examples.
[FORMULA] Formulas/equations — write the formula, then "::", then when to use it and any conditions.
[SLIDE] Content explicitly shown on slides — the heading, key points, or visual content from the slide.
[LIST] Enumerated lists or key points (e.g., "three types of...", "five steps to...").
[CAUSE] Cause→effect relationships or mechanisms.
[COMPARE] Comparisons or contrasts (X vs Y, advantages/disadvantages).
[FLAG] Anything said after: "important", "exam", "remember", "test you on", "this always comes up", "won't forget", "key point", "critical". Note which term/topic it was about.
[EXAMPLE] Real-world examples, case studies, South African examples, or scenarios the lecturer provided.

IGNORE:
- Admin talk, jokes, "can you hear me", loadshedding comments, fire drills
- Attendance, assignment submission dates, registration info (unless marks/weightings mentioned)
- "um", "okay so", "right", "you know", filler words
- Lecturer personal anecdotes unrelated to course content
- Off-topic tangents

RULES:
- For [DEF] and [FORMULA], the term must be the actual name of the concept — 1 word MAX, exactly as it would appear in a glossary or index. Never a full sentence or clause.
- For [SLIDE], include what the visual aid showed — if professor points to slide 5, note "Slide 5:" and the content. This helps students review without recording.
- If you're not confident something is a real key concept (vs. the lecturer thinking aloud or a one-off aside), leave it out. Fewer accurate bullets beats more vague ones.
- No explanations, no fluff, no editorializing.
- DO NOT include timestamps.

OUTPUT FORMAT:
One tagged bullet per line. NO timestamps.

Example output:
- [SLIDE] Slide 2: Photosynthesis has two stages — Light Reactions (in thylakoid) and Calvin Cycle (in stroma)
- [DEF] Photosynthesis :: plants convert light energy into chemical energy stored as glucose — lecturer's example: sunflower follows the sun
- [FORMULA] Einstein's E = mc², used to calculate energy release in nuclear reactions
- [FLAG] "This always comes up in the exam" — re: difference between mitosis and meiosis
- [EXAMPLE] SA context: Eskom load shedding affects water treatment plants, which rely on photosynthesis in water bodies for oxygen

Transcript chunk:\n\n`;

const REDUCE_PROMPT = `You are "Exam Buddy", a South African university tutor with 10 years experience. Your only job: turn 90min rambly lectures (with slides) into notes that help students pass their assessments — whether that's in-class tests, assignments, exams, or presentations.

INPUT: Extracted key content from a South African university lecture, already tagged by type ([DEF], [FORMULA], [SLIDE], [LIST], [CAUSE], [COMPARE], [FLAG], [EXAMPLE]) and cleaned of fluff.

OUTPUT RULES:
1. IGNORE: admin talk, jokes, "can you hear me", registration, assignment dates unless marks are mentioned.
2. FORMAT: Use this exact structure, no deviation:
3. DO NOT include timestamps anywhere in the output.

## Key Concepts [exactly 5 one-word terms]
Pick which [DEF]/[FORMULA] items to keep using this priority order, in this order:
  1. Anything whose term also appears in a [FLAG] item — these are confirmed exam-relevant. Always include first.
  2. Terms that show up in [DEF]/[FORMULA] bullets from more than one chunk — repetition means the lecturer kept returning to it.
  3. Foundational terms the rest of the lecture depends on, over one-off mentions.
You MUST return exactly 5 terms. If fewer than 5 meet the importance criteria, pick the next most relevant terms from the lecture content.

Term rules — get this right, it matters most:
- Term = 1 word MAX. The actual name of the concept, as it would appear in a glossary or index. Never a sentence, question, or clause.
- Definition = 1 sentence, using the lecturer's own specific explanation, example, or numbers from the transcript — never a generic textbook definition you already knew. If they gave a specific example or analogy, keep it.
- Format exactly: **Term**: Definition

GOOD: **Mitosis**: Cell splits into two identical daughter cells with the same chromosome number — same example as skin healing after a cut.
BAD: **The process of cell division**: This is when a cell goes through several phases in order to divide into new cells.
(BAD is wrong on two counts: the term is a clause, not a glossary entry, and the definition is generic — it ignores what the lecturer actually said.)

## Glossary
This section is MANDATORY and must always appear with both subheadings below, even for informal, rambling, or discursive lectures where the lecturer never gave a single textbook-style definition. A glossary that teaches real vocabulary is expected regardless of lecture style — do not omit this section and do not skip a subheading just because the transcript was sparse.

### Formulas
List all formulas mentioned in the lecture with when to use them. If no formulas were mentioned anywhere in the lecture, keep this subheading and write exactly one line under it: "No formulas covered in this lecture".
- Formula 1: When to use it
- Formula 2: When to use it

### Definitions [exactly 10 terms]
ALWAYS output exactly 10 terms, using this priority order:
  1. Terms the lecturer explicitly defined, in their own words — highest priority, use their specific phrasing/examples.
  2. Subject-specific or technical terms the lecturer used, wrote on a slide, or referenced without stopping to define — write a concise, standard definition for these based on the subject area. This is expected, not optional: a real glossary defines the vocabulary of the lecture, not just the sentences where the lecturer paused to explain something.
  3. If, even combining 1 and 2, the lecture doesn't yield 10 distinct terms (e.g. a very short or very informal lecture), add foundational terms from the lecture's general subject area that a student would need in order to understand what was taught — still clearly grounded in the actual topic, not arbitrary.
Never leave this section short of 10 terms and never write "Not covered in this lecture" here — that fallback applies elsewhere, not to the glossary.
- **Term**: Definition
- **Term**: Definition

## Full Lecture Notes
Provide comprehensive notes organized by topics. ALWAYS include slide numbers/references when mentioned — this helps students who may not have recorded the visuals. Use bullet points for key information. Include examples and explanations from the lecturer.

Format:
### Topic 1 [Slide X, Y, Z if mentioned]
**Slide Content:**
- Heading/visual from slide
- Key diagram or list shown

**Key Points from Lecture:**
- Key point 1
- Key point 2
- Real example (SA context if given)

### Topic 2 [Slide A, B if mentioned]
**Slide Content:**
- Main content from slide

**Key Points from Lecture:**
- Key point 1
- Key point 2

## Assessment Hints Detected
(Flag anything the lecturer emphasized — these are likely exam/test/assignment questions)
- "This always comes up in the exam" — Topic
- "You'll see this in your assessment" — Concept
- "Repeated X times" — Concept appears strongly emphasized

## Summary: 10-Bullet Pass Guarantee
If you only study 10 things, study these. Each = 1 sentence. No fluff.
1. [First key point]
2. [Second key point]
3. [Third key point]
4. [Fourth key point]
5. [Fifth key point]
6. [Sixth key point]
7. [Seventh key point]
8. [Eighth key point]
9. [Ninth key point]
10. [Tenth key point]

## Test Predictor: 10 Exam-Style Questions + Memo
Create 10 exam-style questions using Bloom's taxonomy. Base ONLY on transcript facts. Include a memo/model answer for each question. These are "Test Predictor" questions designed to predict what will appear on actual exams.

Format:
Q1 [Recall]: What is ___?
A1: [Detailed model answer based on transcript]

Q2 [Understand]: Explain why ___ happens
A2: [Detailed model answer based on transcript]

Q3 [Apply]: If ___, calculate ___
A3: [Detailed model answer based on transcript]

Q4 [Analyze]: Compare X vs Y from lecture
A4: [Detailed model answer based on transcript]

Q5 [Evaluate]: Which is better for ___ and why?
A5: [Detailed model answer based on transcript]

Q6 [Recall]: ___
A6: [Detailed model answer based on transcript]

Q7 [Understand]: ___
A7: [Detailed model answer based on transcript]

Q8 [Apply]: ___
A8: [Detailed model answer based on transcript]

Q9 [Analyze]: ___
A9: [Detailed model answer based on transcript]

Q10 [Evaluate]: ___
A10: [Detailed model answer based on transcript]

4. TONE: Clear, direct English. Short sentences. No "furthermore". No "it is important to note". Suit South African university students.
5. HALLUCINATION BAN: Everywhere except the Glossary's Definitions section, if info isn't in the transcript, write "Not covered in this lecture" — never invent facts, numbers, or events that didn't happen. EXCEPTION: the Glossary's Definitions section is explicitly allowed (and required, per the rules above) to supply a standard definition for a term that the lecture actually used or referenced, even if the lecturer didn't pause to define it themselves. This is not invention — the term came from the transcript; only its definition is supplemented.
6. SA CONTEXT: Keep ZAR, South African examples (Eskom, provinces, SA legislation, case studies). Include slide references. Don't convert currency to other units.

CONTEXT: Student is at a South African university. May be at contact or distance education institution. Attends lectures with slides. Needs notes for tests, assignments, and exams. Make every word count. Include slide references since student may not have recorded the lecture visuals.

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

// Runs async tasks with limited concurrency so we don't blow past the
// Gemini API's requests-per-minute limit on longer transcripts (which can
// produce 15-20+ chunks). Failed/rate-limited calls are handled by the
// caller (mapChunk already catches and returns '' on failure).
async function runWithConcurrencyLimit<T>(
  tasks: (() => Promise<T>)[],
  limit: number
): Promise<T[]> {
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
            maxOutputTokens: 32768,
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

    // Step 2: Map - Extract key info from each chunk (with index for debugging).
    // Limited to 5 concurrent requests to avoid tripping Gemini's rate limit
    // on longer transcripts, which would otherwise silently drop chunks.
    const mapResults = await runWithConcurrencyLimit(
      chunks.map((chunk, index) => () => mapChunk(chunk, index)),
      5
    );

    const successfulChunks = mapResults.filter(result => result.length > 0).length;
    console.log(`${successfulChunks}/${chunks.length} chunks produced content`);

    const extractedContent = mapResults.filter(result => result.length > 0).join('\n\n');

    console.log('Extracted content length:', extractedContent.length);

    if (extractedContent.length === 0) {
      // Map step produced nothing usable from any chunk (rare — e.g. a very
      // short/off-topic-heavy transcript). Rather than falling back to an
      // unstructured bullet list with no Glossary/Key Concepts/etc., feed the
      // raw transcript directly into the Reduce step as a best-effort so the
      // student still gets a full structured summary, glossary included.
      console.warn('No content extracted from any chunk — falling back to summarizing the raw transcript directly');
      try {
        return await reduceSummary(transcript);
      } catch (fallbackError) {
        console.error('Raw-transcript fallback also failed:', fallbackError);
        return generateSimpleBulletPoints(transcript);
      }
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
      summary: summary,
      truncated: transcript.length > MAX_TRANSCRIPT_CHARS,
      transcriptChars: transcript.length
    });

  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { success: false, error: 'summary_generation_failed', detail: message },
      { status: 500 }
    );
  }
}