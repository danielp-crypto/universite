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
    let context = '';
    if (currentLecture) {
      context = `You are an AI assistant helping a student understand their lecture. Here is the lecture context:

Title: ${currentLecture.title || 'Untitled'}
Date: ${currentLecture.date || 'Unknown'}
Duration: ${currentLecture.duration || 'Unknown'}

Transcript:
${currentLecture.transcription || 'No transcript available'}

Summary:
${currentLecture.summary || 'No summary available'}

Key Concepts:
${currentLecture.keyConcepts?.join(', ') || 'None'}

Answer the student's questions based on this lecture content. If the answer is not in the lecture, say so clearly. Be helpful and educational.`;
    } else {
      context = 'You are an AI assistant helping a student. No lecture context is available. Please ask the student to select a lecture from the dashboard first.';
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
