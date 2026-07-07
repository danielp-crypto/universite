import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export async function POST(request: NextRequest) {
  try {
    const { transcript } = await request.json();

    if (!transcript) {
      return NextResponse.json({ error: 'Transcript is required' }, { status: 400 });
    }

    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const prompt = `Generate a concise, descriptive title for this lecture transcript. 
The title should be:
- Maximum 8 words
- Professional and academic in tone
- Capture the main topic/theme
- No quotation marks
- No "Lecture" prefix

Transcript:
${transcript.substring(0, 2000)}

Return ONLY the title, nothing else.`;

    const result = await model.generateContent(prompt);
    const title = result.response.text().trim();

    return NextResponse.json({ title });
  } catch (error) {
    console.error('Error generating title:', error);
    return NextResponse.json({ error: 'Failed to generate title' }, { status: 500 });
  }
}
