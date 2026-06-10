import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { text } = await request.json();

    if (!text) {
      return NextResponse.json(
        { error: 'No text provided' },
        { status: 400 }
      );
    }

    // Use Gemini API to generate exam questions
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Gemini API key not configured' },
        { status: 500 }
      );
    }

    const prompt = `Based on the following document text, generate a set of exam questions. Please provide:
1. 10 multiple choice questions (4 options each, with correct answer marked)
2. 5 short answer questions
3. 3 essay questions

Format the response as JSON with the following structure:
{
  "multipleChoice": [
    {
      "question": "question text",
      "options": ["A", "B", "C", "D"],
      "correctAnswer": "A",
      "explanation": "explanation of why this is correct"
    }
  ],
  "shortAnswer": [
    {
      "question": "question text",
      "answer": "sample answer"
    }
  ],
  "essay": [
    {
      "question": "question text",
      "points": "suggested points to cover"
    }
  ]
}

Document text:
${text.substring(0, 10000)}`;

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: prompt
          }]
        }]
      })
    });

    const data = await response.json();

    if (data.error) {
      console.error('Gemini API error:', data.error);
      return NextResponse.json(
        { error: 'Failed to generate questions' },
        { status: 500 }
      );
    }

    const content = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    
    // Parse the JSON response
    let questions;
    try {
      // Extract JSON from the response (in case there's extra text)
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        questions = JSON.parse(jsonMatch[0]);
      } else {
        questions = JSON.parse(content);
      }
    } catch (e) {
      console.error('Failed to parse questions JSON:', e);
      return NextResponse.json(
        { error: 'Failed to parse generated questions' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      questions: questions
    });

  } catch (error) {
    console.error('Questions generation error:', error);
    return NextResponse.json(
      { error: 'Questions generation failed' },
      { status: 500 }
    );
  }
}
