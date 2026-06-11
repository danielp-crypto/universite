import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/client';

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'unauthorized' },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json(
        { error: 'unauthorized' },
        { status: 401 }
      );
    }

    const { text, documentId } = await request.json();

    if (!text) {
      return NextResponse.json(
        { error: 'No text provided' },
        { status: 400 }
      );
    }

    // Use Gemini API to generate summary
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Gemini API key not configured' },
        { status: 500 }
      );
    }

    const prompt = `Please generate a comprehensive summary of the following document text. The summary should:
1. Capture the main topics and key concepts
2. Highlight important definitions and explanations
3. Organize the information in a clear, structured format
4. Be concise but comprehensive

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
        { error: 'Failed to generate summary' },
        { status: 500 }
      );
    }

    const summary = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

    // Update document with summary in Supabase
    if (documentId) {
      const { error: updateError } = await supabaseAdmin
        .from('documents')
        .update({ summary: summary })
        .eq('id', documentId)
        .eq('user_id', user.id);

      if (updateError) {
        console.error('Supabase update error:', updateError);
      }
    }

    return NextResponse.json({
      success: true,
      summary: summary
    });

  } catch (error) {
    console.error('Summary generation error:', error);
    return NextResponse.json(
      { error: 'Summary generation failed' },
      { status: 500 }
    );
  }
}
