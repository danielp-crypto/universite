import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);

    if (userError || !user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const body = await request.json();
    const { exam_session_id, question_type, difficulty, count } = body;

    if (!exam_session_id || !count) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Get exam session to verify ownership and get module
    const { data: examSession, error: sessionError } = await supabaseAdmin
      .from('exam_sessions')
      .select('*, modules(*)')
      .eq('id', exam_session_id)
      .eq('user_id', user.id)
      .single();

    if (sessionError || !examSession) {
      return NextResponse.json({ error: 'Exam session not found' }, { status: 404 });
    }

    // Get lectures from the module
    const { data: lectures, error: lecturesError } = await supabaseAdmin
      .from('lectures')
      .select('id, title, transcription, summary')
      .eq('module_id', examSession.module_id)
      .not('transcription', 'is', null);

    if (lecturesError) {
      console.error('Error fetching lectures:', lecturesError);
      return NextResponse.json({ error: 'Failed to fetch lectures' }, { status: 500 });
    }

    if (!lectures || lectures.length === 0) {
      return NextResponse.json({ error: 'No lectures available in this module' }, { status: 400 });
    }

    // Combine lecture content for AI context
    const lectureContent = lectures.map(lecture => ({
      title: lecture.title,
      transcription: lecture.transcription,
      summary: lecture.summary
    }));

    // Generate questions using AI
    const prompt = `You are an expert exam question generator. Generate ${count} exam questions based ONLY on the following lecture content. Do not invent facts outside the provided content.

Question type: ${question_type || 'mixed'}
Difficulty: ${difficulty || 'mixed'}

Available lecture content:
${JSON.stringify(lectureContent, null, 2)}

Generate questions in the following JSON format:
[
  {
    "question": "The question text",
    "question_type": "multiple_choice|short_answer|long_answer",
    "difficulty": "easy|medium|hard",
    "expected_answer": "The correct answer or model answer",
    "options": ["A) Option 1", "B) Option 2", "C) Option 3", "D) Option 4"], // Only for multiple choice
    "correct_option": "A" // Only for multiple choice
  }
]

Important:
- Questions must be based ONLY on the provided lecture content
- Vary the difficulty levels
- For multiple choice, provide 4 options with exactly one correct answer
- For short/long answer, provide a model answer based on the content
- Return valid JSON only, no additional text`;

    // Call AI API (using your existing AI integration)
    const aiResponse = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=' + process.env.GEMINI_API_KEY, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: prompt
          }]
        }]
      })
    });

    if (!aiResponse.ok) {
      console.error('AI API error:', aiResponse.statusText);
      return NextResponse.json({ error: 'Failed to generate questions' }, { status: 500 });
    }

    const aiData = await aiResponse.json();
    const generatedText = aiData.candidates[0].content.parts[0].text;

    // Parse AI response
    let questions;
    try {
      // Extract JSON from response (AI might add markdown formatting)
      const jsonMatch = generatedText.match(/\[[\s\S]*\]/);
      const jsonString = jsonMatch ? jsonMatch[0] : generatedText;
      questions = JSON.parse(jsonString);
    } catch (parseError) {
      console.error('Error parsing AI response:', parseError);
      return NextResponse.json({ error: 'Failed to parse generated questions' }, { status: 500 });
    }

    // Store questions in database
    const questionsToInsert = questions.map((q: any, index: number) => ({
      exam_session_id,
      question: q.question,
      question_type: q.question_type,
      difficulty: q.difficulty,
      expected_answer: q.expected_answer,
      options: q.options || null,
      correct_option: q.correct_option || null,
      order_index: index
    }));

    const { data: insertedQuestions, error: insertError } = await supabaseAdmin
      .from('exam_questions')
      .insert(questionsToInsert)
      .select();

    if (insertError) {
      console.error('Error inserting questions:', insertError);
      return NextResponse.json({ error: 'Failed to save questions' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      questions: insertedQuestions
    });

  } catch (error: any) {
    console.error('Error generating questions:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
