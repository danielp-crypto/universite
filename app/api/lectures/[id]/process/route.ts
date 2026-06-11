import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/client';
import pdf from 'pdf-parse';
import mammoth from 'mammoth';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { success: false, error: 'unauthorized' },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'unauthorized' },
        { status: 401 }
      );
    }

    const { id: lectureId } = await params;

    // Fetch lecture
    const { data: lecture, error: fetchError } = await supabaseAdmin
      .from('lectures')
      .select('*')
      .eq('id', lectureId)
      .eq('user_id', user.id)
      .single();

    if (fetchError || !lecture) {
      return NextResponse.json(
        { success: false, error: 'lecture_not_found' },
        { status: 404 }
      );
    }

    // Extract text from document
    let text = '';
    if (lecture.file_content) {
      const buffer = Buffer.from(lecture.file_content, 'base64');
      
      if (lecture.file_type === 'application/pdf') {
        const data = await pdf(buffer);
        text = data.text;
      } else if (lecture.file_type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
        const result = await mammoth.extractRawText({ buffer });
        text = result.value;
      } else {
        return NextResponse.json(
          { success: false, error: 'unsupported_file_type' },
          { status: 400 }
        );
      }

      // Clean up the extracted text
      text = text
        .replace(/\s+/g, ' ')
        .replace(/\n\s*\n/g, '\n\n')
        .trim();
    }

    // Generate summary using Gemini
    const apiKey = process.env.GEMINI_API_KEY;
    let summary = '';
    if (apiKey) {
      try {
        const prompt = `Please generate a comprehensive summary of the following lecture document. The summary should:
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
        summary = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      } catch (error) {
        console.error('Summary generation error:', error);
      }
    }

    // Generate questions using Gemini
    let questions = null;
    if (apiKey) {
      try {
        const prompt = `Based on the following lecture document text, generate a set of exam questions. Please provide:
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
        const content = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        
        // Parse the JSON response
        try {
          const jsonMatch = content.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            questions = JSON.parse(jsonMatch[0]);
          }
        } catch (e) {
          console.error('Failed to parse questions JSON:', e);
        }
      } catch (error) {
        console.error('Questions generation error:', error);
      }
    }

    // Update lecture with processed data
    const { data: updatedLecture, error: updateError } = await supabaseAdmin
      .from('lectures')
      .update({
        transcription: text,
        summary: summary,
        transcription_status: 'completed',
        has_transcription: true,
        transcription_completed_at: new Date().toISOString(),
        status: 'completed',
        questions: questions
      })
      .eq('id', lectureId)
      .eq('user_id', user.id)
      .select()
      .single();

    if (updateError) {
      console.error('Supabase update error:', updateError);
      return NextResponse.json(
        { success: false, error: 'update_failed' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      lecture: updatedLecture
    });

  } catch (error) {
    console.error('Process lecture error:', error);
    return NextResponse.json(
      { success: false, error: 'processing_failed' },
      { status: 500 }
    );
  }
}
