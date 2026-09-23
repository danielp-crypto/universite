import { NextRequest, NextResponse } from 'next/server';
import { groq } from '@/lib/groq';

// Force dynamic rendering for API routes with static export
export const dynamic = 'force-dynamic';

// Map-reduce over many chunks (long lectures) plus the Groq reduce call
// can take a while. Vercel Hobby hard-caps function duration at 60s (a
// higher value fails to deploy at all, not just gets silently clamped),
// so this is the max we can set until/unless the project moves to Pro.
export const maxDuration = 60;

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

// Shared preamble/footer used by all three reduce prompts below. Splitting the
// original single REDUCE_PROMPT into independent sections lets them run as
// parallel Gemini calls (Promise.all) instead of one giant sequential call —
// generation time becomes "the slowest section" instead of "the sum of all
// sections", which is the single biggest latency win available in this
// pipeline given Gemini's output token count directly drives call duration.
const REDUCE_PREAMBLE = `You are "Exam Buddy", a South African university tutor with 10 years experience. Your only job: turn 90min rambly lectures (with slides) into notes that help students pass their assessments — whether that's in-class tests, assignments, exams, or presentations.

INPUT: Extracted key content from a South African university lecture, already tagged by type ([DEF], [FORMULA], [SLIDE], [LIST], [CAUSE], [COMPARE], [FLAG], [EXAMPLE]) and cleaned of fluff.

OUTPUT RULES:
1. IGNORE: admin talk, jokes, "can you hear me", registration, assignment dates unless marks are mentioned.
2. FORMAT: Use this exact structure, no deviation:
3. DO NOT include timestamps anywhere in the output.
4. Only produce the section(s) requested below — nothing else, no preamble, no extra commentary before or after.

`;

const REDUCE_FOOTER = `

TONE: Clear, direct English. Short sentences. No "furthermore". No "it is important to note". Suit South African university students.
HALLUCINATION BAN: Everywhere except the Glossary's Definitions section, if info isn't in the transcript, write "Not covered in this lecture" — never invent facts, numbers, or events that didn't happen. EXCEPTION: the Glossary's Definitions section is explicitly allowed (and required, per its own rules) to supply a standard definition for a term that the lecture actually used or referenced, even if the lecturer didn't pause to define it themselves. This is not invention — the term came from the transcript; only its definition is supplemented.
SA CONTEXT: Keep ZAR, South African examples (Eskom, provinces, SA legislation, case studies). Include slide references. Don't convert currency to other units.

CONTEXT: Student is at a South African university. May be at contact or distance education institution. Attends lectures with slides. Needs notes for tests, assignments, and exams. Make every word count. Include slide references since student may not have recorded the lecture visuals.

Extracted content:\n\n`;

const REDUCE_PROMPT_CONCEPTS_GLOSSARY = REDUCE_PREAMBLE + `Produce exactly these two sections, in this order:

## Key Concepts [5-8 one-word terms]
Pick which [DEF]/[FORMULA] items to keep using this priority order, in this order:
  1. Anything whose term also appears in a [FLAG] item — these are confirmed exam-relevant. Always include first.
  2. Terms that show up in [DEF]/[FORMULA] bullets from more than one chunk — repetition means the lecturer kept returning to it.
  3. Foundational terms the rest of the lecture depends on, over one-off mentions.
Return between 5 and 8 terms — as many as are genuinely important, not padded to hit a target. A short or narrow lecture might only have 5 real concepts worth flagging; that's fine. Under-filling is always better than manufacturing extra terms just to reach a number.

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

### Definitions [as many as genuinely warranted]
List every term the lecture actually used or relied on that a student would need defined to follow the material, using this priority order:
  1. Terms the lecturer explicitly defined, in their own words — highest priority, use their specific phrasing/examples.
  2. Subject-specific or technical terms the lecturer used, wrote on a slide, or referenced without stopping to define — write a concise, standard definition for these based on the subject area. This is expected, not optional: a real glossary defines the vocabulary of the lecture, not just the sentences where the lecturer paused to explain something.
There is no target count — a technical, jargon-heavy lecture might warrant 15+ terms, while a short or conversational one might genuinely only have 4 or 5. Do NOT add generic subject-area terms just to pad toward a round number — every term here must trace back to something the lecture actually said or used. Under-filling is always better than inventing filler entries.
- **Term**: Definition
- **Term**: Definition
` + REDUCE_FOOTER;

const REDUCE_PROMPT_NOTES_SUMMARY = REDUCE_PREAMBLE + `Produce exactly these three sections, in this order:

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

## Summary: Pass Guarantee
If you only study these, you'll cover what matters. Each point = 1 sentence, no fluff. Use 5-10 points — as many as the lecture genuinely supports, not padded to reach 10. A dense lecture might need all 10; a narrower one might only have 6 real points. Don't repeat the same point twice just to lengthen the list.
1. [First key point]
2. [Second key point]
3. [Third key point]
...continue for as many points as are genuinely warranted, up to 10.
` + REDUCE_FOOTER;

const REDUCE_PROMPT_TESTS_QUIZ = REDUCE_PREAMBLE + `Produce exactly these two sections, in this order:

## Test Predictor: Exam-Style Questions + Memo
Create 5-10 exam-style questions using Bloom's taxonomy — as many as the lecture's content genuinely supports, not padded to reach 10. Base ONLY on transcript facts. Include a memo/model answer for each question. These are "Test Predictor" questions designed to predict what will appear on actual exams. If the lecture only has enough distinct testable content for 5 or 6 solid questions, stop there — never invent a scenario or fact not grounded in the transcript just to reach a higher count.

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

...continue in this pattern, cycling through Recall/Understand/Apply/Analyze/Evaluate question types, for as many questions as the lecture's content genuinely supports — up to 10, but stop earlier if the material runs out rather than padding.

## Quiz Bank: 10 Multiple Choice Questions
Create exactly 10 multiple-choice questions testing concepts from the lecture, so students can self-test with clickable options instead of only reading model answers. Unlike the Test Predictor above, this section keeps a fixed count of 10 regardless of lecture length, since it powers a scored self-test in the app — pull from the full scope of what was covered (including material beyond the Test Predictor questions if needed) to reach 10 distinct, non-repetitive questions. Base ONLY on transcript facts — never invent facts to fill a slot; if the lecture is genuinely thin, it's fine for some questions to test the same concept from a different angle rather than inventing new facts. Each question needs exactly 4 options (A-D) and exactly one correct answer. Wrong options must be plausible and topic-relevant — things a student who half-understood the lecture might pick — never silly, joke, or obviously-wrong answers.

Format exactly like this for all 10 questions, with no extra commentary before, between, or after them:
MCQ1: [question text]
A) [option text]
B) [option text]
C) [option text]
D) [option text]
CORRECT: [A, B, C, or D]

MCQ2: [question text]
A) [option text]
B) [option text]
C) [option text]
D) [option text]
CORRECT: [A, B, C, or D]

MCQ3: [question text]
A) [option text]
B) [option text]
C) [option text]
D) [option text]
CORRECT: [A, B, C, or D]

MCQ4: [question text]
A) [option text]
B) [option text]
C) [option text]
D) [option text]
CORRECT: [A, B, C, or D]

MCQ5: [question text]
A) [option text]
B) [option text]
C) [option text]
D) [option text]
CORRECT: [A, B, C, or D]

MCQ6: [question text]
A) [option text]
B) [option text]
C) [option text]
D) [option text]
CORRECT: [A, B, C, or D]

MCQ7: [question text]
A) [option text]
B) [option text]
C) [option text]
D) [option text]
CORRECT: [A, B, C, or D]

MCQ8: [question text]
A) [option text]
B) [option text]
C) [option text]
D) [option text]
CORRECT: [A, B, C, or D]

MCQ9: [question text]
A) [option text]
B) [option text]
C) [option text]
D) [option text]
CORRECT: [A, B, C, or D]

MCQ10: [question text]
A) [option text]
B) [option text]
C) [option text]
D) [option text]
CORRECT: [A, B, C, or D]
` + REDUCE_FOOTER;

// Shared Groq call with retry + backoff. Rate limiting (HTTP 429) needs a
// fundamentally different backoff strategy than other transient failures:
// Groq's rate limit resets on a per-minute window, so a 1-4 second
// exponential backoff is pointless against it — by the time you retry,
// you're still in the same rate-limited window. This waits long enough to
// actually clear it.
//
// `deadline` (a Date.now()-style timestamp) is optional but important when
// this is called from generateSummary's own budget-aware flow: rate-limit
// backoff can legitimately want to wait 20s+ per retry, and stacking
// several of those across map+reduce calls can quietly exceed Vercel's
// hard 60s function cap. When that happens Vercel kills the function
// outright and the caller (e.g. the Deepgram webhook, which has its own
// clock already ticking from the nested fetch) sees a raw 504 instead of
// a clean response — which is exactly the failure this deadline exists to
// avoid. Once the deadline is reached, this stops retrying and throws
// immediately so the caller can fall back gracefully instead.
async function callGroq(
  messages: any[],
  context: string,
  maxRetries: number,
  maxTokens: number,
  deadline?: number
): Promise<{ text: string; finishReason?: string }> {
  let retryDelay = 2000;
  let lastError = '';

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    if (deadline && Date.now() >= deadline) {
      throw new Error(`${context}: giving up — internal time budget exceeded before attempt ${attempt + 1}`);
    }

    let wasRateLimited = false;

    try {
      // maxRetries: 0 disables the Groq SDK's OWN internal retry (defaults
      // to 2) — without this, a single call in our loop could silently
      // turn into up to 3 real HTTP attempts with their own backoff,
      // invisible to and uncounted by our deadline logic entirely. timeout
      // hard-caps this one call to whatever's actually left before our
      // deadline, so a single slow generation (this model can be asked for
      // up to 16k output tokens in the reduce step, which can genuinely
      // take a while) can't quietly consume the whole remaining budget on
      // its own — it gets cut off and treated as a retry-worthy failure
      // like any other, same as a 429 would be.
      const remainingMs = deadline ? Math.max(1000, deadline - Date.now()) : 55000;
      const completion = await groq.chat.completions.create(
        {
          model: 'openai/gpt-oss-20b',
          messages,
          temperature: 0.2,
          max_tokens: maxTokens,
        },
        { timeout: remainingMs, maxRetries: 0 }
      );

      const text = completion.choices[0]?.message?.content || '';
      const finishReason = completion.choices[0]?.finish_reason;

      if (text) {
        if (finishReason === 'length') {
          console.warn(`${context}: response was cut off by max_tokens.`);
        }
        return { text, finishReason };
      }

      // Empty text — worth retrying rather than treating as valid
      lastError = `empty response (finishReason: ${finishReason || 'unknown'})`;
    } catch (error: any) {
      if (error?.status === 429) {
        wasRateLimited = true;
        const retryAfterMs = error?.headers?.['retry-after'] ? parseInt(error.headers['retry-after'], 10) * 1000 : NaN;
        retryDelay = !isNaN(retryAfterMs) ? retryAfterMs : Math.max(retryDelay, 20000);
        lastError = `HTTP 429 (rate limited): ${error.message || 'Unknown error'}`;
      } else {
        lastError = error?.message || String(error);
      }
    }

    console.warn(`${context} attempt ${attempt + 1}/${maxRetries} failed: ${lastError}`);

    if (attempt < maxRetries - 1) {
      // Don't wait past the deadline just to make a retry we know we won't
      // have time to use — cap the sleep to whatever's actually left.
      let sleepMs = retryDelay;
      if (deadline) {
        const remaining = deadline - Date.now();
        if (remaining <= 0) {
          throw new Error(`${context}: giving up — internal time budget exceeded after attempt ${attempt + 1}`);
        }
        sleepMs = Math.min(sleepMs, remaining);
      }
      await new Promise(resolve => setTimeout(resolve, sleepMs));
      if (!wasRateLimited) {
        retryDelay *= 2;
      }
    }
  }

  throw new Error(`${context} failed after ${maxRetries} attempts: ${lastError}`);
}

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
// Groq API's requests-per-minute limit on longer transcripts (which can
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
async function mapChunk(chunk: string, index: number, deadline: number): Promise<string> {
  try {
    const { text } = await callGroq(
      [{ role: 'user', content: MAP_PROMPT + chunk }],
      `Map chunk ${index}`,
      3,
      600,
      deadline
    );
    return text;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`mapChunk[${index}] failed, skipping this chunk:`, message);
    return '';
  }
}

// Reduce step: Generate the final summary as THREE independent parallel Groq
// calls instead of one giant sequential one. Each covers a disjoint set of
// sections and gets its own (smaller) max_tokens budget — total wall-clock
// time becomes roughly the slowest of the three, not the sum of all of them.
async function reduceSummary(extractedContent: string, deadline: number): Promise<string> {
  const calls: { prompt: string; context: string; maxTokens: number }[] = [
    { prompt: REDUCE_PROMPT_CONCEPTS_GLOSSARY, context: 'Reduce: Key Concepts + Glossary', maxTokens: 4096 },
    { prompt: REDUCE_PROMPT_NOTES_SUMMARY, context: 'Reduce: Full Notes + Assessment Hints + 10-Bullet Summary', maxTokens: 16384 },
    { prompt: REDUCE_PROMPT_TESTS_QUIZ, context: 'Reduce: Test Predictor + Quiz Bank', maxTokens: 16384 },
  ];

  const results = await Promise.all(
    calls.map(({ prompt, context, maxTokens }) =>
      callGroq(
        [{ role: 'user', content: prompt + extractedContent }],
        context,
        5,
        maxTokens,
        deadline
      )
    )
  );

  // Joined in the same order the original single-call REDUCE_PROMPT produced
  // them, so downstream section-parsing (##(?!#) splits, parseKeyConcepts,
  // etc.) sees an identically structured document.
  return results.map((r) => r.text.trim()).join('\n\n');
}

async function generateSummary(transcript: string): Promise<{ summary: string; degraded: boolean; degradeReason?: string }> {
  if (!process.env.GROQ_API_KEY) {
    console.warn('GROQ_API_KEY is not set — using minimally-structured fallback');
    return { summary: generateFallbackSummary(transcript), degraded: true, degradeReason: 'GROQ_API_KEY is not configured' };
  }

  // This function's own maxDuration is 60s, but when called from the
  // Deepgram webhook (the normal path), that nested fetch counts against
  // the WEBHOOK's clock too — its own DB reads/writes and title generation
  // eat into the same budget before this even starts, and neither of us
  // can see Vercel's own cold-start overhead from inside our code. 35s
  // (not 45s — the first version of this fix still hit real 504s, likely
  // from cold start eating the difference) leaves real margin for all of
  // that, so we hit a clean internal fallback instead of Vercel
  // force-killing the function and the webhook seeing a raw 504 (which
  // used to be exactly what left lectures completed with no summary at
  // all — see deepgram_webhook_logs entries with outcome
  // 'completed_without_summary' and error containing "responded 504").
  const deadline = Date.now() + 35000;
  let degradeReason = 'unknown';

  try {
    // Step 1: Split transcript into chunks
    const chunks = splitIntoChunks(transcript);
    console.log(`Transcript length: ${transcript.length} chars, ${transcript.split(/\s+/).length} words`);
    console.log(`Split transcript into ${chunks.length} chunks`);

    // Step 2: Map - Extract key info from each chunk (with index for debugging).
    // Limited to 3 concurrent requests — kept modest specifically because the
    // reduce step right after this fires 3 more parallel Groq calls of its
    // own, and both draw from the same per-minute quota. A larger
    // map burst was leaving no headroom for the reduce step that follows it.
    const mapResults = await runWithConcurrencyLimit(
      chunks.map((chunk, index) => () => mapChunk(chunk, index, deadline)),
      3
    );

    const successfulChunks = mapResults.filter(result => result.length > 0).length;
    console.log(`${successfulChunks}/${chunks.length} chunks produced content`);

    const extractedContent = mapResults.filter(result => result.length > 0).join('\n\n');

    console.log('Extracted content length:', extractedContent.length);

    if (Date.now() >= deadline) {
      degradeReason = `time budget exhausted after map step (${successfulChunks}/${chunks.length} chunks succeeded)`;
      console.warn(degradeReason + ' — skipping reduce, falling back');
    } else if (extractedContent.length > 0) {
      // Reduce the extracted, tagged content. callGroq now retries with
      // rate-limit-aware backoff (up to 5 attempts per call, waiting out an
      // actual per-minute quota window instead of a token 1-4s delay), so a
      // transient failure here is handled by that retry logic directly rather
      // than by falling through to a second attempt. A second full attempt
      // used to fire 3 more parallel Groq calls immediately after the first
      // 3 had already failed — almost always into the same still-rate-limited
      // window, which made failures worse, not better.
      try {
        const summary = await reduceSummary(extractedContent, deadline);
        console.log('Generated summary length:', summary.length);
        console.log('Summary preview:', summary.substring(0, 200));
        return { summary, degraded: false };
      } catch (reduceError) {
        degradeReason = `reduce step failed: ${reduceError instanceof Error ? reduceError.message : String(reduceError)}`;
        console.error(degradeReason);
      }
    } else {
      // Map step produced nothing usable from any chunk (rare — e.g. a very
      // short/off-topic-heavy transcript). Try once against the raw
      // transcript directly, since there's no extracted content to retry.
      console.warn('No content extracted from any chunk — attempting the raw transcript directly');
      try {
        const summary = await reduceSummary(transcript, deadline);
        console.log('Generated summary from raw transcript, length:', summary.length);
        return { summary, degraded: false };
      } catch (rawError) {
        degradeReason = `map step produced nothing, and raw-transcript attempt also failed: ${rawError instanceof Error ? rawError.message : String(rawError)}`;
        console.error(degradeReason);
      }
    }

    // Last resort: the structured attempt failed even after retries (e.g. a
    // persistent Groq outage, not just a transient rate limit). Return a
    // minimally-structured, clearly-flagged summary so the page still has
    // Key Concepts / Full Lecture Notes sections to render instead of a
    // blank or malformed page.
    return { summary: generateFallbackSummary(transcript), degraded: true, degradeReason };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Summary generation failed entirely, using last-resort fallback:', message);
    return { summary: generateFallbackSummary(transcript), degraded: true, degradeReason: `unhandled exception: ${message}` };
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

const NAIVE_KEYWORD_STOPWORDS = new Set([
  'about', 'after', 'again', 'their', 'there', 'these', 'thing', 'things',
  'think', 'thought', 'which', 'would', 'could', 'should', 'basically',
  'actually', 'really', 'gonna', 'going', 'because', 'right', 'okay',
  'alright', 'lecture', 'student', 'students', 'class', 'today', 'other',
  'where', 'through', 'something', 'someone', 'people', 'first', 'second',
]);

// Very rough keyword picker used only by the last-resort fallback below, so
// the Key Concepts bubbles aren't empty even when Groq is unreachable.
// This is NOT a substitute for the real AI-generated Key Concepts section.
function extractNaiveKeywords(transcript: string, count = 5): string[] {
  const words = transcript
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 4 && !NAIVE_KEYWORD_STOPWORDS.has(w));

  const freq = new Map<string, number>();
  for (const w of words) freq.set(w, (freq.get(w) || 0) + 1);

  return Array.from(freq.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, count)
    .map(([word]) => word.charAt(0).toUpperCase() + word.slice(1));
}

// Last-resort summary used only when both real Groq attempts fail (e.g. a
// persistent outage). Kept in the same "## Heading" / "### Subheading"
// structure the app's section-parsing regex expects, so the page renders
// Key Concepts bubbles and a Full Lecture Notes card instead of blank
// sections — but every part of it clearly says notes should be regenerated.
function generateFallbackSummary(transcript: string): string {
  const bullets = generateSimpleBulletPoints(transcript);
  const keywords = extractNaiveKeywords(transcript);
  const keyConceptsSection = keywords.length > 0
    ? keywords.map(k => `**${k}**: Mentioned in this lecture — AI notes generation failed, please use Regenerate.`).join('\n')
    : '**General**: AI notes generation failed — please use Regenerate.';

  return `## Key Concepts
${keyConceptsSection}

## Glossary

### Formulas
Not covered in this lecture

### Definitions
AI notes generation failed for this lecture — please use the "Regenerate" button to try again.

## Full Lecture Notes
${bullets}

_These are simplified, auto-extracted notes. Full AI-generated notes could not be produced this time — please use "Regenerate" to try again._

## Assessment Hints Detected
Not covered in this lecture.

## Summary: Pass Guarantee
${bullets}

## Test Predictor: Exam-Style Questions + Memo
Not covered in this lecture.

## Quiz Bank: 10 Multiple Choice Questions
Not covered in this lecture.
`;
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

    const { summary, degraded, degradeReason } = await generateSummary(truncatedTranscript);

    return NextResponse.json({
      success: true,
      summary: summary,
      degraded, // true if this is the last-resort fallback, not real AI-generated notes
      degradeReason, // present only when degraded — the actual underlying cause, for diagnosis
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