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
              text: `You MUST generate comprehensive, actionable lecture notes for college students from this transcript. Follow this EXACT structure without deviation:

## Lecture Title
[Brief title based on content]

## Key Topics
• [Topic 1]
• [Topic 2]
• [Topic 3]

## Important Definitions
**[Term]**: [Clear, concise definition]
**[Term]**: [Clear, concise definition]

## Core Concepts
• [Concept with brief explanation]
• [Concept with brief explanation]
• [Concept with brief explanation]

## Key Takeaways
• [Actionable takeaway 1]
• [Actionable takeaway 2]
• [Actionable takeaway 3]

## Study Questions
1. [Question 1]
2. [Question 2]
3. [Question 3]

CRITICAL: You MUST include ALL sections above. Do not skip any section. Make notes concise, clear, and exam-focused. Use bullet points with • and bold text with ** for emphasis.

Transcript:\n\n${transcript}`
            }]
          }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 800,
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
