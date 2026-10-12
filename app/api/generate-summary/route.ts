import { NextRequest, NextResponse } from 'next/server';
import { groq } from '@/lib/groq';

// Force dynamic rendering for API routes with static export
export const dynamic = 'force-dynamic';

// Vercel Hobby hard-caps function duration at 60s (a higher value fails to
// deploy at all, not just gets silently clamped), so this is the max we can
// set until/unless the project moves to Pro.
export const maxDuration = 60;

// Safety cap to avoid runaway cost/quota usage on pathological inputs.
// This is generous on purpose — a 90min lecture transcript is typically
// 60k-100k characters. Raise further if you expect longer lectures.
const MAX_TRANSCRIPT_CHARS = 200000;

// ---------------------------------------------------------------------------
// Groq budget configuration
// ---------------------------------------------------------------------------
// GROQ_TPM_LIMIT must match the "tokens per minute" shown for openai/gpt-oss-20b
// on https://console.groq.com/settings/limits (it is also returned on every
// API response as the x-ratelimit-limit-tokens header, which callGroq logs if
// it disagrees with this value). It defaults to 8000, the documented free-tier
// limit. All request sizing below is derived from it, so moving to a higher
// tier only needs this env var changed — no code edits.
const GROQ_TPM_LIMIT = (() => {
  const parsed = Number(process.env.GROQ_TPM_LIMIT);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 8000;
})();

// Groq checks a request's input tokens PLUS its max_completion_tokens against
// the per-minute limit up front, so we plan against 90% of it.
const TPM_SAFETY_FACTOR = 0.9;
const CHARS_PER_TOKEN = 3.5; // conservative for spoken English + markdown
const estimateTokens = (text: string): number => Math.ceil(text.length / CHARS_PER_TOKEN);

// Whole-pipeline wall-clock budget. When called from the Deepgram webhook this
// fetch counts against the WEBHOOK's 60s clock too (its own DB work, title
// generation and cold start all share it), so we stop at 35s and fall back
// cleanly rather than letting Vercel kill the function and the webhook see a
// raw 504 (which used to leave lectures completed with no summary at all).
const TOTAL_BUDGET_MS = 35000;
// The map phase gets its OWN deadline so it can never starve the reduce step.
// Previously both shared one deadline: a slow/rate-limited map phase left no
// time for reduce, which then threw away every chunk it HAD extracted and
// returned the generic fallback.
const MAP_PHASE_MS = 18000;
const MIN_REDUCE_MS = 8000;

const MAP_MAX_TOKENS = 800;
const MAP_MAX_TOKENS_CEILING = 1600;
const REDUCE_MAX_OUTPUT_TOKENS = 7000;
const REDUCE_MIN_OUTPUT_TOKENS = 3500;
const REDUCE_MAX_CONTENT_TOKENS = 40000;
const REDUCE_MIN_CONTENT_TOKENS = 1000;
// Short transcripts skip the map step entirely: one call over the raw text is
// faster and better than extract-then-summarize for ~10 minutes of speech.
const SINGLE_PASS_MAX_TOKENS = 3000;

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

// Shared preamble/footer used by the reduce prompt below.
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

// A single combined reduce prompt, not three parallel ones. The 3-way split
// (still visible in git history) was tuned for Gemini, where output token
// count driving call duration was the bottleneck to optimize around — see
// the now-removed comment that said exactly that. On Groq that reasoning is
// backwards: openai/gpt-oss-20b generates around 1,000 tokens/sec, so
// generation speed was never the constraint here. The real constraint is
// Groq's free-tier rate limit for this model — confirmed directly from
// https://console.groq.com/docs/rate-limits: 8,000 TPM (tokens per minute,
// input AND output combined). Three concurrent calls each independently
// paying the full input-token cost of the extracted content, with two of
// them requesting up to 16,384 output tokens each, was requesting several
// times the entire per-minute budget in one burst — a near-guaranteed 429
// regardless of retry logic. One sequential call pays that input cost once
// and keeps output capped well under the ceiling.
const REDUCE_PROMPT = REDUCE_PREAMBLE + `Produce exactly these seven sections, in this order:

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

## Test Predictor: Exam-Style Questions + Memo
Create 5-8 exam-style questions using Bloom's taxonomy — as many as the lecture's content genuinely supports, not padded to reach 8. Base ONLY on transcript facts. Include a memo/model answer for each question. These are "Test Predictor" questions designed to predict what will appear on actual exams. If the lecture only has enough distinct testable content for 5 or 6 solid questions, stop there — never invent a scenario or fact not grounded in the transcript just to reach a higher count.

Format:
Q1 [Recall]: What is ___?
A1: [Concise model answer based on transcript]

Q2 [Understand]: Explain why ___ happens
A2: [Concise model answer based on transcript]

Q3 [Apply]: If ___, calculate ___
A3: [Concise model answer based on transcript]

Q4 [Analyze]: Compare X vs Y from lecture
A4: [Concise model answer based on transcript]

Q5 [Evaluate]: Which is better for ___ and why?
A5: [Concise model answer based on transcript]

...continue in this pattern, cycling through Recall/Understand/Apply/Analyze/Evaluate question types, for as many questions as the lecture's content genuinely supports — up to 8, but stop earlier if the material runs out rather than padding. Keep each model answer to 1-2 sentences — this section shares a token budget with the rest of the notes, so concise, correct answers matter more than long ones.

## Quiz Bank: 8 Multiple Choice Questions
Create exactly 8 multiple-choice questions testing concepts from the lecture, so students can self-test with clickable options instead of only reading model answers. Unlike the Test Predictor above, this section keeps a fixed count regardless of lecture length, since it powers a scored self-test in the app — pull from the full scope of what was covered (including material beyond the Test Predictor questions if needed) to reach 8 distinct, non-repetitive questions. Base ONLY on transcript facts — never invent facts to fill a slot; if the lecture is genuinely thin, it's fine for some questions to test the same concept from a different angle rather than inventing new facts. Each question needs exactly 4 options (A-D) and exactly one correct answer. Wrong options must be plausible and topic-relevant — things a student who half-understood the lecture might pick — never silly, joke, or obviously-wrong answers.

Format exactly like this for all 8 questions, with no extra commentary before, between, or after them:
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

...continue this pattern through MCQ8.
` + REDUCE_FOOTER;

// Compact variant of REDUCE_PROMPT (~1/3 the size) with the SAME seven "##"
// headings and the same Key Concepts / MCQ formats the page parses. It exists
// for one reason: on a small TPM limit (Groq free tier = 8,000/min) the full
// ~2,700-token prompt leaves room for only ~1,000 tokens of transcript. This
// one leaves room for roughly 12-13 minutes of speech in a single call.
const REDUCE_PROMPT_COMPACT = `You are "Exam Buddy", a South African university tutor. Turn the lecture transcript below into concise exam-prep notes. Output ONLY the seven sections below, in this order, with these exact "##" headings. No preamble, no timestamps. Clear, direct English, short sentences. Use only facts from the transcript; if something is not in it, write "Not covered in this lecture". Keep ZAR and South African examples. Include slide references if mentioned.

## Key Concepts
5-8 lines, format exactly: **Term**: one-sentence definition using the lecturer's own wording or example. Term = ONE word, the glossary name of the concept, never a phrase.

## Glossary
### Formulas
One line per formula: "- Formula: when to use it". If there are none, write exactly: No formulas covered in this lecture
### Definitions
"- **Term**: Definition" for every technical term the lecture used. Prefer the lecturer's own wording; a concise standard definition is allowed for a term the lecture used but did not define. Only terms that appear in the lecture.

## Full Lecture Notes
Notes by topic. For each: "### Topic [Slide X if mentioned]", then "**Slide Content:**" bullets (only if slides were mentioned), then "**Key Points from Lecture:**" bullets including the lecturer's examples.

## Assessment Hints Detected
Bullets for anything the lecturer said would be tested or stressed as important.

## Summary: Pass Guarantee
Numbered list of 5-10 one-sentence points covering what matters most.

## Test Predictor: Exam-Style Questions + Memo
4-6 questions cycling through Bloom levels, format:
Q1 [Recall]: question
A1: 1-2 sentence model answer

## Quiz Bank: 8 Multiple Choice Questions
Exactly 8 questions and no other text, in exactly this format:
MCQ1: question text
A) option
B) option
C) option
D) option
CORRECT: [A, B, C, or D]

Exactly one correct answer each; wrong options must be plausible and on-topic. Base everything only on the transcript.

Transcript:\n\n`;

// ---------------------------------------------------------------------------
// Budget planning
// ---------------------------------------------------------------------------
interface ReduceBudget {
  cap: number; // usable tokens per minute
  promptTokens: number; // fixed cost of the reduce prompt template
  outputTokens: number; // max_completion_tokens for the reduce call (includes reasoning tokens)
  contentTokens: number; // how much extracted content the reduce call may carry
}

// Sizes the reduce call so promptTokens + contentTokens + outputTokens fits
// inside one minute of TPM. The old code requested a fixed 6,500 output tokens
// on top of a ~2,400-token prompt and an unbounded extracted-content payload:
// on an 8,000 TPM limit that is rejected up front (HTTP 413, which the retry
// loop then retried 5 more times) no matter how long it waits.
function planReduceBudget(prompt: string = REDUCE_PROMPT, fixedOutputTokens?: number): ReduceBudget {
  const cap = Math.floor(GROQ_TPM_LIMIT * TPM_SAFETY_FACTOR);
  const promptTokens = estimateTokens(prompt);
  const room = Math.max(0, cap - promptTokens);
  const outputTokens =
    fixedOutputTokens ??
    Math.min(REDUCE_MAX_OUTPUT_TOKENS, Math.max(REDUCE_MIN_OUTPUT_TOKENS, room - REDUCE_MIN_CONTENT_TOKENS));
  const contentTokens = Math.max(
    REDUCE_MIN_CONTENT_TOKENS,
    Math.min(REDUCE_MAX_CONTENT_TOKENS, room - outputTokens)
  );
  return { cap, promptTokens, outputTokens, contentTokens };
}

// ---------------------------------------------------------------------------
// Groq call with retry + backoff
// ---------------------------------------------------------------------------
interface CallGroqOptions {
  context: string;
  maxRetries: number;
  maxTokens: number;
  // If a response comes back empty because reasoning ate the whole token
  // budget (finish_reason 'length'), retries raise max tokens up to this.
  maxTokensCeiling?: number;
  deadline?: number;
}

let warnedAboutTpmMismatch = false;

// openai/gpt-oss-20b is a REASONING model: its hidden reasoning tokens count
// against max_completion_tokens. At the default reasoning effort ('medium') a
// 600-token budget can be consumed entirely by reasoning, returning empty
// content with finish_reason 'length' — which the old loop retried three times
// with the same budget before dropping the chunk. reasoning_effort 'low' keeps
// reasoning short for these extraction/formatting tasks.
//
// Rate limiting (HTTP 429) needs a different backoff than other transient
// failures: Groq's limit resets on a per-minute window, so we honour the
// retry-after header. NOTE: groq-sdk errors expose headers as a web `Headers`
// object, so it must be read with .get() — the old `headers['retry-after']`
// was always undefined and every 429 slept a flat 20s regardless of what
// Groq asked for.
//
// `deadline` (a Date.now()-style timestamp) stops retries once the caller's
// time budget is spent so we fall back gracefully instead of Vercel killing
// the function.
async function callGroq(
  messages: { role: 'user'; content: string }[],
  options: CallGroqOptions
): Promise<{ text: string; finishReason?: string }> {
  const { context, maxRetries, deadline } = options;
  let maxTokens = options.maxTokens;
  let retryDelay = 2000;
  let lastError = '';

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    if (deadline && Date.now() >= deadline) {
      throw new Error(`${context}: giving up — internal time budget exceeded before attempt ${attempt + 1}`);
    }

    let wasRateLimited = false;

    try {
      // maxRetries: 0 disables the Groq SDK's OWN internal retry (defaults to
      // 2), which would otherwise be invisible to our deadline logic. timeout
      // hard-caps this one call to what's left of the budget.
      const remainingMs = deadline ? Math.max(1000, deadline - Date.now()) : 55000;
      const { data: completion, response } = await groq.chat.completions
        .create(
          {
            model: 'openai/gpt-oss-20b',
            messages,
            temperature: 0.2,
            max_completion_tokens: maxTokens,
            reasoning_effort: 'low',
            include_reasoning: false,
          },
          { timeout: remainingMs, maxRetries: 0 }
        )
        .withResponse();

      if (!warnedAboutTpmMismatch) {
        const headerLimit = Number(response.headers.get('x-ratelimit-limit-tokens'));
        if (Number.isFinite(headerLimit) && headerLimit > 0 && headerLimit !== GROQ_TPM_LIMIT) {
          warnedAboutTpmMismatch = true;
          console.warn(
            `Groq reports a ${headerLimit} TPM limit but GROQ_TPM_LIMIT is ${GROQ_TPM_LIMIT}. ` +
              `Set GROQ_TPM_LIMIT=${headerLimit} so request sizes are planned correctly.`
          );
        }
      }

      const text = completion.choices[0]?.message?.content || '';
      const finishReason = completion.choices[0]?.finish_reason;

      if (text) {
        if (finishReason === 'length') {
          console.warn(`${context}: response was cut off by max tokens (${maxTokens}).`);
        }
        return { text, finishReason };
      }

      // Empty text — usually reasoning consumed the whole budget. Give the
      // next attempt more room if the caller allowed any.
      lastError = `empty response (finishReason: ${finishReason || 'unknown'})`;
      if (finishReason === 'length' && options.maxTokensCeiling && maxTokens < options.maxTokensCeiling) {
        maxTokens = Math.min(Math.ceil(maxTokens * 1.5), options.maxTokensCeiling);
      }
    } catch (caught: unknown) {
      const error = caught as { status?: number; message?: string; headers?: Headers } | null;
      const status = error?.status;
      if (status === 429) {
        wasRateLimited = true;
        const retryAfterHeader =
          typeof error?.headers?.get === 'function' ? error.headers.get('retry-after') : null;
        const retryAfterMs = retryAfterHeader ? Math.ceil(parseFloat(retryAfterHeader) * 1000) : NaN;
        retryDelay = !isNaN(retryAfterMs) && retryAfterMs > 0 ? retryAfterMs : Math.max(retryDelay, 10000);
        lastError = `HTTP 429 (rate limited): ${error?.message || 'Unknown error'}`;
      } else if (status && status >= 400 && status < 500 && status !== 408) {
        // 400/401/403/413/422: the same request will fail identically every
        // time (413 = "request too large" for the TPM limit). Retrying only
        // burns the time budget, so fail immediately with the real reason.
        throw new Error(`${context}: non-retryable HTTP ${status}: ${error?.message || 'Unknown error'}`);
      } else {
        lastError = error?.message || String(caught);
      }
    }

    console.warn(`${context} attempt ${attempt + 1}/${maxRetries} failed: ${lastError}`);

    if (attempt < maxRetries - 1) {
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
// Average spoken English is roughly 130-150 words/minute, so ~1000-1500 words
// covers a 10-minute chunk.
function splitIntoChunks(transcript: string, wordsPerChunk: number = 1000): string[] {
  const words = transcript.split(/\s+/).filter(Boolean);
  const chunks: string[] = [];

  for (let i = 0; i < words.length; i += wordsPerChunk) {
    const chunk = words.slice(i, i + wordsPerChunk).join(' ');
    chunks.push(chunk);
  }

  return chunks;
}

// Runs async tasks with limited concurrency so we don't blow past Groq's
// per-minute limits on longer transcripts (which can produce 15-20+ chunks).
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

// Map step: extract key info from one chunk. Returns '' on failure or when the
// map-phase deadline has passed (the caller counts how many chunks succeeded).
async function mapChunk(chunk: string, index: number, mapDeadline: number): Promise<string> {
  if (Date.now() >= mapDeadline) {
    console.warn(`mapChunk[${index}] skipped: map-phase time budget exhausted`);
    return '';
  }
  try {
    const { text } = await callGroq([{ role: 'user', content: MAP_PROMPT + chunk }], {
      context: `Map chunk ${index}`,
      maxRetries: 3,
      maxTokens: MAP_MAX_TOKENS,
      maxTokensCeiling: MAP_MAX_TOKENS_CEILING,
      deadline: mapDeadline,
    });
    return text;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`mapChunk[${index}] failed, skipping this chunk:`, message);
    return '';
  }
}

// Lower number = more valuable to a student, kept first when content has to be
// trimmed to fit the token budget.
const TAG_PRIORITY: Record<string, number> = {
  FLAG: 0,
  DEF: 1,
  FORMULA: 2,
  LIST: 3,
  CAUSE: 4,
  COMPARE: 5,
  EXAMPLE: 6,
  SLIDE: 7,
};

// Trims extracted map output to maxTokens by dropping the lowest-priority
// tagged bullets first (SLIDE/EXAMPLE before FLAG/DEF/FORMULA), keeping the
// survivors in their original lecture order.
function trimExtractedContent(content: string, maxTokens: number): string {
  if (estimateTokens(content) <= maxTokens) return content;

  const lines = content.split('\n').filter(line => line.trim().length > 0);
  let currentPriority = Object.keys(TAG_PRIORITY).length;
  const ranked = lines.map((line, index) => {
    const tag = line.match(/^\s*[-*•]?\s*\[([A-Z]+)\]/)?.[1];
    if (tag && tag in TAG_PRIORITY) currentPriority = TAG_PRIORITY[tag];
    return { index, priority: currentPriority, tokens: estimateTokens(line) + 1 };
  });

  ranked.sort((a, b) => a.priority - b.priority || a.index - b.index);

  const keep = new Set<number>();
  let used = 0;
  for (const item of ranked) {
    if (used + item.tokens > maxTokens) continue;
    keep.add(item.index);
    used += item.tokens;
  }

  if (keep.size === 0) return content.slice(0, Math.floor(maxTokens * CHARS_PER_TOKEN));
  return lines.filter((_, index) => keep.has(index)).join('\n');
}

// Reduce step: ONE call that turns the extracted (or raw, for short
// transcripts) content into the full seven-section notes. Output budget comes
// from planReduceBudget() so the request actually fits the TPM limit.
async function reduceSummary(
  prompt: string,
  content: string,
  outputTokens: number,
  deadline: number
): Promise<{ text: string; finishReason?: string }> {
  const { text, finishReason } = await callGroq(
    [{ role: 'user', content: prompt + content }],
    {
      context: 'Reduce: full notes',
      maxRetries: 4,
      maxTokens: outputTokens,
      deadline,
    }
  );
  return { text: text.trim(), finishReason };
}

interface SummaryResult {
  summary: string;
  degraded: boolean;
  degradeReason?: string;
  // The model hit its output limit, so trailing sections (usually the Quiz
  // Bank) may be shortened or missing.
  incomplete?: boolean;
  // Present on the map-reduce path: how many transcript chunks made it into
  // the notes. processed < total means some of the lecture is not covered.
  chunksProcessed?: number;
  chunksTotal?: number;
}

async function generateSummary(transcript: string): Promise<SummaryResult> {
  if (!process.env.GROQ_API_KEY) {
    console.warn('GROQ_API_KEY is not set — using minimally-structured fallback');
    return { summary: generateFallbackSummary(transcript), degraded: true, degradeReason: 'GROQ_API_KEY is not configured' };
  }

  const startedAt = Date.now();
  const deadline = startedAt + TOTAL_BUDGET_MS;
  const mapDeadline = startedAt + MAP_PHASE_MS;
  const budget = planReduceBudget();
  let degradeReason = 'unknown';

  try {
    const transcriptTokens = estimateTokens(transcript);
    console.log(
      `Transcript: ${transcript.length} chars (~${transcriptTokens} tokens). ` +
        `Budget @ ${GROQ_TPM_LIMIT} TPM: reduce prompt ~${budget.promptTokens}, ` +
        `content <= ${budget.contentTokens}, output <= ${budget.outputTokens}`
    );

    let reduceInput: string;
    let reducePrompt = REDUCE_PROMPT;
    let reduceOutputTokens = budget.outputTokens;
    let chunksProcessed: number | undefined;
    let chunksTotal: number | undefined;

    // The compact notes need ~3,000 output tokens plus low-effort reasoning, so
    // pin the output at 3,800 and give the transcript everything that's left.
    const compactBudget = planReduceBudget(REDUCE_PROMPT_COMPACT, 3800);

    if (transcriptTokens <= Math.min(budget.contentTokens, SINGLE_PASS_MAX_TOKENS)) {
      // Short lecture: skip map-reduce, summarize the transcript directly.
      reduceInput = transcript;
    } else if (budget.cap < 40000 && transcriptTokens <= compactBudget.contentTokens) {
      // Small TPM limit and a short lecture: map-reduce can't fit in one
      // minute, but a single call with the compact prompt can.
      console.log('Using single-pass compact prompt (small TPM limit, short lecture)');
      reducePrompt = REDUCE_PROMPT_COMPACT;
      reduceOutputTokens = compactBudget.outputTokens;
      reduceInput = transcript;
    } else {
      // Step 1: split, then Step 2: map (extract key info from each chunk).
      const chunks = splitIntoChunks(transcript, 1000);
      chunksTotal = chunks.length;
      console.log(`Split transcript into ${chunks.length} chunks`);

      // 2 concurrent calls on small TPM limits; more when the limit is large.
      const concurrency = budget.cap >= 40000 ? 4 : 2;
      const mapResults = await runWithConcurrencyLimit(
        chunks.map((chunk, index) => () => mapChunk(chunk, index, mapDeadline)),
        concurrency
      );

      const extractedChunks = mapResults.filter(result => result.length > 0);
      chunksProcessed = extractedChunks.length;
      console.log(`${chunksProcessed}/${chunks.length} chunks produced content`);

      if (extractedChunks.length > 0) {
        // Even if the map phase ran out of time or some chunks failed, keep
        // what we extracted and reduce it — partial notes beat the fallback.
        reduceInput = trimExtractedContent(extractedChunks.join('\n\n'), budget.contentTokens);
        if (chunksProcessed < chunksTotal) {
          reduceInput =
            `COVERAGE NOTE: only ${chunksProcessed} of ${chunksTotal} parts of this lecture could be processed in time. ` +
            `Work only from the content below and do not write "Not covered in this lecture" for topics that may simply be in the missing parts.\n\n` +
            reduceInput;
        }
      } else {
        // Map produced nothing usable. Try once against the start of the raw
        // transcript (capped to the budget so the request is valid).
        console.warn('No content extracted from any chunk — attempting the raw transcript directly');
        const maxChars = Math.floor(budget.contentTokens * CHARS_PER_TOKEN);
        reduceInput = transcript.length > maxChars ? transcript.slice(0, maxChars) : transcript;
        if (transcript.length > maxChars) {
          reduceInput =
            `COVERAGE NOTE: only the first part of this lecture is included below. ` +
            `Do not write "Not covered in this lecture" for topics that may simply be in the missing part.\n\n` +
            reduceInput;
        }
      }
    }

    if (deadline - Date.now() < MIN_REDUCE_MS) {
      degradeReason = `time budget exhausted before reduce step (${chunksProcessed ?? 0}/${chunksTotal ?? 0} chunks succeeded)`;
      console.warn(degradeReason + ' — falling back');
      return { summary: generateFallbackSummary(transcript), degraded: true, degradeReason, chunksProcessed, chunksTotal };
    }

    try {
      const { text, finishReason } = await reduceSummary(reducePrompt, reduceInput, reduceOutputTokens, deadline);
      if (!/##\s*Key Concepts/i.test(text)) {
        console.warn('Reduce output is missing the "## Key Concepts" heading — the page may render empty sections');
      }
      console.log('Generated summary length:', text.length);
      return {
        summary: text,
        degraded: false,
        incomplete: finishReason === 'length',
        chunksProcessed,
        chunksTotal,
      };
    } catch (reduceError) {
      degradeReason = `reduce step failed: ${reduceError instanceof Error ? reduceError.message : String(reduceError)}`;
      console.error(degradeReason);
    }

    // Last resort: the structured attempt failed even after retries. Return a
    // minimally-structured, clearly-flagged summary so the page still has
    // Key Concepts / Full Lecture Notes sections to render.
    return { summary: generateFallbackSummary(transcript), degraded: true, degradeReason, chunksProcessed, chunksTotal };
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

// Last-resort summary used only when the Groq reduce step fails (e.g. a
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

## Quiz Bank: 8 Multiple Choice Questions
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

    const { summary, degraded, degradeReason, incomplete, chunksProcessed, chunksTotal } =
      await generateSummary(truncatedTranscript);

    return NextResponse.json({
      success: true,
      summary: summary,
      degraded, // true if this is the last-resort fallback, not real AI-generated notes
      degradeReason, // present only when degraded — the actual underlying cause, for diagnosis
      incomplete: !!incomplete, // true if the model hit its output limit (trailing sections may be short/missing)
      chunksProcessed, // map-reduce only: chunks that made it into the notes
      chunksTotal, // map-reduce only: total chunks; processed < total means partial coverage
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