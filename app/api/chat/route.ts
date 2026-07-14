import { NextRequest, NextResponse } from 'next/server';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';

export async function POST(request: NextRequest) {
  try {
    const { message, currentLecture, messages } = await request.json();

    if (!message) {
      return NextResponse.json(
        { success: false, error: 'missing_message' },
        { status: 400 }
      );
    }

    if (!GEMINI_API_KEY) {
      return NextResponse.json(
        { success: false, error: 'missing_api_key' },
        { status: 500 }
      );
    }

    // Build context from lecture if available
    const tutorRules = `You are an AI TUTOR. Your only role is to help the student understand their own lecture material — you are not a general assistant and you are not a homework-completion service.

Follow these rules at all times:
- Explain concepts, define terms, work through examples, and check understanding using the lecture content above.
- Use a Socratic approach where useful: ask a guiding question, give a hint, or break a problem into steps rather than immediately handing over a final answer.
- If the student asks you to write or complete an assignment, essay, quiz, homework problem set, or exam for them — or asks for answers with no interest in understanding them — do not produce the finished work. Instead, offer to explain the underlying concept, walk through a similar example, or help them build the answer themselves.
- If a request looks like an attempt to get answers for an assignment or test that is meant to be done independently, say so plainly and redirect to teaching the concept instead of completing it.
- If the answer isn't in the lecture content, say so clearly rather than guessing.
- Be encouraging, clear, and educational.`;

    let context = '';
    if (currentLecture) {
      context = `${tutorRules}

Here is the lecture context:

Title: ${currentLecture.title || 'Untitled'}
Date: ${currentLecture.date || 'Unknown'}
Duration: ${currentLecture.duration || 'Unknown'}

Transcript:
${currentLecture.transcription || 'No transcript available'}

Summary:
${currentLecture.summary || 'No summary available'}

Key Concepts:
${currentLecture.keyConcepts?.join(', ') || 'None'}

Answer the student's questions based on this lecture content, following the tutoring rules above.`;
    } else {
      context = `${tutorRules}

No lecture context is available right now. Ask the student to select a lecture from the dashboard first, and remind them you're here to help them understand material, not to do assignments for them.`;
    }

    // Build conversation history
    const conversationHistory = messages
      .slice(-10) // Keep last 10 messages for context
      .map((msg: any) => ({
        role: msg.sender === 'user' ? 'user' : 'model',
        parts: [{ text: msg.content }]
      }));

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': GEMINI_API_KEY,
        },
        body: JSON.stringify({
          contents: [
            { role: 'user', parts: [{ text: context }] },
            ...conversationHistory,
            { role: 'user', parts: [{ text: message }] }
          ],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 2048,
          }
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Gemini API error:', errorText);
      throw new Error('Gemini API request failed');
    }

    const result = await response.json();
    const aiResponse = result.candidates?.[0]?.content?.parts?.[0]?.text || 'No response generated';

    return NextResponse.json({
      success: true,
      response: aiResponse
    });

  } catch (error) {
    console.error('Chat API error:', error);
    return NextResponse.json(
      { success: false, error: 'chat_failed', detail: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}