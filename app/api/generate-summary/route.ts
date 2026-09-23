import { NextRequest, NextResponse } from 'next/server';
import { groq } from '@/lib/groq';

export const dynamic = 'force-dynamic';

// Keep this route within Vercel Hobby's execution window.
// GPT-OSS 20B is extremely fast on Groq, so one long-context call
// is much more practical than the previous 15-20+ request map/reduce pipeline.
export const maxDuration = 60;

/*
 * GPT-OSS 20B currently supports a 131,072-token context window.
 *
 * A 60-90 minute English lecture will commonly produce roughly
 * 9,000-18,000 spoken words, depending on speaking speed.
 *
 * 200,000 characters is deliberately conservative and gives us
 * substantial room for the prompt + transcript + generated notes.
 */
const MAX_TRANSCRIPT_CHARS = 200_000;

const MODEL = 'openai/gpt-oss-20b';

const SYSTEM_PROMPT = `
You are Exam Buddy, an expert university study assistant for South African
university students.

Your task is to transform a COMPLETE university lecture transcript into
high-quality study notes.

The transcript may represent a 60-90 minute lecture and may contain:
- lecturer explanations
- slide references
- definitions
- formulas
- examples
- comparisons
- repeated concepts
- exam hints
- questions from students
- conversational filler
- transcription errors

Your job is to preserve the academic substance while removing noise.

CRITICAL SOURCE RULE:

Everything in the study material must be grounded in the lecture transcript.

Do NOT invent:
- facts
- statistics
- formulas
- examples
- legislation
- dates
- theories
- exam requirements
- lecturer opinions

If something was not covered, say:
"Not covered in this lecture."

You may clean obvious speech-to-text errors when the intended academic
meaning is clear.

You may organize information into a clearer structure than the lecturer used.

You must NOT pretend that the lecturer said something they did not say.

SOUTH AFRICAN CONTEXT:

Preserve South African terminology and examples where they occur.

Examples include:
- ZAR
- South African legislation
- South African institutions
- Eskom
- South African provinces
- South African case studies

Do not unnecessarily convert South African examples into foreign equivalents.

LECTURE SLIDE INFORMATION:

The transcript may contain references such as:
"look at slide 5"
"on this slide"
"the diagram here"
"as you can see on the PowerPoint"

Preserve these references.

Do not invent slide numbers.

If slide content is described in the transcript, include it.

ASSESSMENT EMPHASIS:

Pay particular attention to statements such as:

- "this is important"
- "remember this"
- "this will be in the exam"
- "this always comes up"
- "you need to know this"
- "testable"
- "make sure you understand"
- "you will be asked"
- "critical"
- "key point"

These should be reflected in the Assessment Hints section.

TRANSCRIPTION NOISE:

Ignore:
- "um"
- "uh"
- "okay"
- "right"
- "you know"
- microphone checks
- attendance discussion
- unrelated jokes
- technical problems
- unrelated personal stories
- administrative information

Unless administrative information contains academically relevant
assessment marks, weightings, or requirements.

IMPORTANT:

Do not summarize only the beginning, middle, and end.

Read and use the ENTIRE transcript supplied.

The student should be able to study from your output without needing
to read the original transcript.
`;

const USER_PROMPT = `
Create a complete study package from the lecture transcript below.

Use EXACTLY this structure.

# Key Concepts

List the most important concepts from the lecture.

Use:

**Concept**: explanation

Prefer the actual terminology used by the lecturer.

Include approximately 5-10 concepts, but do not manufacture concepts merely
to reach the number.

Prioritize concepts that:
1. were repeatedly discussed
2. were explicitly defined
3. were emphasized by the lecturer
4. are foundational to understanding other topics
5. were associated with assessment/exam hints


# Glossary

## Formulas

List every formula, equation, calculation method, or mathematical relationship
actually mentioned.

For each:

- **Formula**: formula
  - When to use: explanation
  - Conditions/variables: explanation

If there are no formulas:

No formulas covered in this lecture.


## Definitions

List important technical terms used in the lecture.

Prioritize:
1. terms explicitly defined by the lecturer
2. technical terminology repeatedly used
3. terminology needed to understand the lecture

Use:

- **Term**: definition

Do not add unrelated textbook vocabulary.


# Full Lecture Notes

Create comprehensive notes covering the ENTIRE lecture from beginning to end.

Organize the notes into logical topics.

Use this structure:

## Topic 1: [Topic name]

### Main Ideas
- point
- point
- point

### Explanation
Explain the lecturer's reasoning clearly.

### Examples
Include examples actually given in the lecture.

### Slide References
Include slide references only when the transcript provides them.

Continue for every major topic.

IMPORTANT:

Do not compress an entire 90-minute lecture into 5-10 generic bullets.

The Full Lecture Notes section should preserve the important academic detail
from the complete transcript.


# Assessment Hints Detected

Identify statements or material that the lecturer explicitly emphasized
as important for:

- exams
- tests
- assignments
- presentations
- assessment

For each:

- **Topic/Concept**: what the lecturer emphasized and why it appears
  assessment-relevant according to the transcript.

Do not predict actual exam questions unless the lecturer explicitly
indicated something was likely to be assessed.


# Summary

Provide a concise high-value revision summary.

Use approximately 8-15 numbered points.

Each point should represent a genuinely important idea from the lecture.

Do not repeat information merely to reach the target number.


# Test Predictor: Exam-Style Questions + Memo

Create 5-10 exam-style questions based ONLY on the lecture.

Use a mixture of:

- Recall
- Understand
- Apply
- Analyze
- Evaluate

Do not claim these questions will actually appear in an exam.

They are practice questions based on the lecture material.

Format:

Q1 [Recall]: Question

A1: Model answer grounded in the lecture.

Q2 [Understand]: Question

A2: Model answer grounded in the lecture.

Continue as appropriate.


# Quiz Bank

Create exactly 10 multiple-choice questions.

Each question must have exactly four options.

There must be exactly one correct answer.

Format:

MCQ1: Question

A) Option

B) Option

C) Option

D) Option

CORRECT: A

MCQ2: Question

A) Option

B) Option

C) Option

D) Option

CORRECT: B

Continue through MCQ10.

Questions must cover different parts of the lecture where possible.

Wrong answers must be plausible and related to the topic.

Do not invent facts just to create a question.

---

QUALITY REQUIREMENTS

1. Cover the entire transcript.
2. Preserve important academic detail.
3. Do not hallucinate.
4. Do not use timestamps.
5. Do not mention these instructions.
6. Do not add a preamble before "# Key Concepts".
7. Do not add a conclusion after the Quiz Bank.
8. Use clear English suitable for university students.
9. Keep the lecturer's terminology where possible.
10. Do not turn every sentence of the transcript into a bullet.
11. Remove repetition unless repetition itself is academically meaningful.
12. If the lecturer explains a concept using an analogy, preserve the analogy.
13. If the lecturer gives a South African example, preserve it.
14. If a formula is mentioned, preserve the exact formula as accurately
    as possible.
15. If the transcript contains conflicting statements, do not silently
    resolve them. Present the relevant information cautiously.

LECTURE TRANSCRIPT:

`;

function cleanTranscript(transcript: string): string {
  return transcript
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\n{4,}/g, '\n\n')
    .trim();
}

function truncateSafely(text: string, maxChars: number): {
  text: string;
  truncated: boolean;
} {
  if (text.length <= maxChars) {
    return {
      text,
      truncated: false,
    };
  }

  /*
   * We deliberately DO NOT sample beginning/middle/end.
   *
   * Sampling was one of the problems with the previous implementation:
   * important material in the middle of a lecture could disappear.
   *
   * Instead, this is a hard safety limit. A normal 60-90 minute lecture
   * should remain below it.
   */
  console.warn(
    `Transcript exceeds ${maxChars} characters. ` +
    `Received ${text.length}. Truncating at the safety limit.`
  );

  return {
    text: text.slice(0, maxChars),
    truncated: true,
  };
}

async function generateWithGroq(
  transcript: string
): Promise<{
  summary: string;
  finishReason?: string | null;
}> {
  if (!process.env.GROQ_API_KEY) {
    throw new Error('GROQ_API_KEY is not configured');
  }

  const completion = await groq.chat.completions.create(
    {
      model: MODEL,

      messages: [
        {
          role: 'system',
          content: SYSTEM_PROMPT,
        },
        {
          role: 'user',
          content: USER_PROMPT + transcript,
        },
      ],

      /*
       * Low temperature is intentional.
       *
       * This is a study-notes extraction task, not creative writing.
       */
      temperature: 0.15,

      /*
       * GPT-OSS 20B supports large output limits.
       *
       * We don't actually want 65k output tokens for a lecture summary.
       * 16k gives the model enough room for a detailed 60-90 minute
       * lecture without encouraging it to reproduce the transcript.
       */
      max_tokens: 16_000,

      /*
       * We want the model to focus on the lecture rather than spend a
       * large amount of generation budget on unnecessary reasoning.
       */
      reasoning_effort: 'low',
    },

    {
      /*
       * Do not let the SDK silently perform its own retries.
       * The API route should know exactly how long the request takes.
       */
      maxRetries: 0,

      /*
       * Leave a little room inside the Vercel execution window.
       */
      timeout: 50_000,
    }
  );

  const text = completion.choices?.[0]?.message?.content?.trim() || '';

  if (!text) {
    throw new Error(
      `Groq returned an empty response ` +
      `(finish_reason=${completion.choices?.[0]?.finish_reason || 'unknown'})`
    );
  }

  return {
    summary: text,
    finishReason: completion.choices?.[0]?.finish_reason,
  };
}

function generateTranscriptOnlyFallback(transcript: string): string {
  /*
   * IMPORTANT:
   *
   * This is intentionally NOT pretending to be an AI summary.
   *
   * If Groq is unavailable, the student should still be able to access
   * the transcript rather than seeing fabricated notes.
   */
  const sentences = transcript
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length >= 40)
    .slice(0, 80);

  const bullets = sentences.length
    ? sentences.map((sentence) => `- ${sentence}`).join('\n')
    : '- Transcript is available, but automatic AI notes could not be generated.';

  return `# Key Concepts

AI notes were not generated because the AI summarization service was unavailable.

# Glossary

## Formulas

Not generated because AI summarization was unavailable.

## Definitions

Not generated because AI summarization was unavailable.

# Full Lecture Notes

The lecture transcript was successfully captured, but AI notes generation
could not be completed.

Please use Regenerate when the AI service is available.

## Transcript highlights

${bullets}

# Assessment Hints Detected

Not generated because AI summarization was unavailable.

# Summary

AI summary unavailable. Please regenerate.

# Test Predictor: Exam-Style Questions + Memo

Not generated because AI summarization was unavailable.

# Quiz Bank

Not generated because AI summarization was unavailable.
`;
}

export async function POST(request: NextRequest) {
  const requestStartedAt = Date.now();

  try {
    const body = await request.json();

    const transcript =
      typeof body?.transcript === 'string'
        ? cleanTranscript(body.transcript)
        : '';

    if (!transcript) {
      return NextResponse.json(
        {
          success: false,
          error: 'missing_transcript',
        },
        { status: 400 }
      );
    }

    const {
      text: transcriptForAI,
      truncated,
    } = truncateSafely(
      transcript,
      MAX_TRANSCRIPT_CHARS
    );

    const wordCount = transcriptForAI
      .split(/\s+/)
      .filter(Boolean)
      .length;

    console.log(
      JSON.stringify({
        event: 'summary_generation_started',
        transcriptChars: transcript.length,
        transcriptCharsSentToAI: transcriptForAI.length,
        transcriptWords: wordCount,
        truncated,
        model: MODEL,
      })
    );

    try {
      const result = await generateWithGroq(transcriptForAI);

      const durationMs = Date.now() - requestStartedAt;

      console.log(
        JSON.stringify({
          event: 'summary_generation_completed',
          durationMs,
          summaryChars: result.summary.length,
          finishReason: result.finishReason || null,
          truncated,
        })
      );

      /*
       * If the model stopped because it hit max_tokens, the notes may be
       * incomplete. We still return them because they are useful, but expose
       * the condition so the UI/logging layer can identify it.
       */
      const outputTruncated = result.finishReason === 'length';

      return NextResponse.json({
        success: true,
        summary: result.summary,

        /*
         * `degraded` means the system did not produce the intended
         * full AI-generated result.
         */
        degraded: outputTruncated,

        degradeReason: outputTruncated
          ? 'AI output reached the maximum token limit'
          : undefined,

        truncated,

        transcriptChars: transcript.length,
        transcriptWords: wordCount,

        model: MODEL,

        durationMs,
      });
    } catch (error: any) {
      const message =
        error instanceof Error
          ? error.message
          : String(error);

      console.error(
        JSON.stringify({
          event: 'summary_generation_failed',
          error: message,
          transcriptChars: transcript.length,
          transcriptWords: wordCount,
          durationMs: Date.now() - requestStartedAt,
        })
      );

      /*
       * We return HTTP 200 with degraded=true rather than a 500 here.
       *
       * This is intentional for your existing Deepgram webhook:
       * the transcript has already been successfully saved and should
       * not be turned into a failed lecture merely because Groq is
       * temporarily unavailable.
       */
      return NextResponse.json({
        success: true,
        summary: generateTranscriptOnlyFallback(transcriptForAI),

        degraded: true,

        degradeReason:
          `Groq summarization failed: ${message}`,

        truncated,

        transcriptChars: transcript.length,
        transcriptWords: wordCount,

        model: MODEL,

        durationMs: Date.now() - requestStartedAt,
      });
    }
  } catch (error: any) {
    const message =
      error instanceof Error
        ? error.message
        : String(error);

    console.error('generate-summary unexpected error:', message);

    return NextResponse.json(
      {
        success: false,
        error: 'summary_generation_failed',
        detail: message,
      },
      { status: 500 }
    );
  }
}