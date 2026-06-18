import { NextRequest, NextResponse } from 'next/server';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';

async function generateSummary(transcript: string): Promise<string> {
  if (!GEMINI_API_KEY) {
    // Fallback to simple bullet point extraction if no API key
    return generateSimpleBulletPoints(transcript);
  }

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `You are "Exam Buddy", a Unisa tutor with 10 years experience. Your only job: turn 90min rambly lectures into notes that help a working student pass tomorrow's test.

INPUT: Full transcript of 1 South African university lecture. Audio may have Afrikaans, Zulu, "um", loadshedding cuts, lecturer going off-topic.

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

Transcript:\n\n${transcript}`
            }]
          }],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 1500,
          }
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Gemini API error:', errorText);
      throw new Error('Gemini API error');
    }

    const result = await response.json();
    const summary = result.candidates?.[0]?.content?.parts?.[0]?.text || '';
    
    console.log('Generated summary length:', summary.length);
    console.log('Summary preview:', summary.substring(0, 200));
    
    return summary;
  } catch (error) {
    console.error('Summary generation error:', error);
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

    // Limit transcript length to avoid overwhelming the API
    const truncatedTranscript = transcript.substring(0, 4000);

    const summary = await generateSummary(truncatedTranscript);

    return NextResponse.json({
      success: true,
      summary: summary
    });

  } catch (error) {
    console.error('Summary generation error:', error);
    return NextResponse.json(
      { success: false, error: 'summary_generation_failed' },
      { status: 500 }
    );
  }
}
