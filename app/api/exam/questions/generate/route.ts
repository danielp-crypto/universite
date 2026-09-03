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

    console.log('Question generation request:', { exam_session_id, question_type, difficulty, count });

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
      console.error('Exam session not found:', sessionError);
      return NextResponse.json({ error: 'Exam session not found' }, { status: 404 });
    }

    console.log('Exam session found:', examSession.id, 'Module:', examSession.module_id);

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

    console.log('Lectures found:', lectures?.length || 0);

    if (!lectures || lectures.length === 0) {
      console.log('No lectures found for module:', examSession.module_id);
      return NextResponse.json({ error: 'No lectures with transcriptions available in this module. Please record or upload lectures first.' }, { status: 400 });
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

IMPORTANT: Return ONLY valid JSON. Do not include any markdown formatting, explanations, or additional text. Your response must be a valid JSON array.

Generate questions in the following JSON format:
[
  {
    "question": "The question text",
    "question_type": "multiple_choice|short_answer|long_answer",
    "difficulty": "easy|medium|hard",
    "expected_answer": "The correct answer or model answer",
    "options": ["A) Option 1", "B) Option 2", "C) Option 3", "D) Option 4"],
    "correct_option": "A"
  }
]

Important:
- Questions must be based ONLY on the provided lecture content
- Vary the difficulty levels
- For multiple choice, provide 4 options with exactly one correct answer
- For short/long answer, provide a model answer based on the content
- Return valid JSON only, no markdown, no additional text
- Ensure all strings are properly escaped
- Do not use trailing commas in JSON arrays or objects`;

    // Call AI API (using your existing AI integration) with retry logic
    console.log('Calling AI API...');
    console.log('GEMINI_API_KEY exists:', !!process.env.GEMINI_API_KEY);

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ error: 'GEMINI_API_KEY not configured' }, { status: 500 });
    }

    let aiResponse: Response | null = null;
    let retryCount = 0;
    const maxRetries = 3;
    const baseDelay = 1000; // 1 second

    while (retryCount <= maxRetries) {
      aiResponse = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': process.env.GEMINI_API_KEY,
          },
          body: JSON.stringify({
            contents: [{
              parts: [{
                text: prompt
              }]
            }],
            generationConfig: {
              temperature: 0.7,
              maxOutputTokens: 8192,
              responseMimeType: 'application/json',
            }
          })
        }
      );

      console.log('AI API response status:', aiResponse.status);

      // Check for rate limit error
      if (aiResponse.status === 429 && retryCount < maxRetries) {
        const delay = baseDelay * Math.pow(2, retryCount);
        console.log(`Rate limited. Retrying in ${delay}ms... (Attempt ${retryCount + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        retryCount++;
        continue;
      }

      break;
    }

    if (!aiResponse) {
      return NextResponse.json({ error: 'Failed to get AI response' }, { status: 500 });
    }

    if (!aiResponse.ok) {
      console.error('AI API error:', aiResponse.statusText);
      const errorText = await aiResponse.text();
      console.error('AI API error body:', errorText);

      // Provide user-friendly error message for rate limiting
      if (aiResponse.status === 429) {
        return NextResponse.json({
          error: 'AI service is currently busy due to high demand. Please wait a moment and try again.',
          retryable: true
        }, { status: 429 });
      }

      return NextResponse.json({ error: `AI API error: ${aiResponse.statusText} - ${errorText}` }, { status: 500 });
    }

    const aiData = await aiResponse.json();
    console.log('AI API response data:', JSON.stringify(aiData).substring(0, 500));

    if (!aiData.candidates || !aiData.candidates[0] || !aiData.candidates[0].content || !aiData.candidates[0].content.parts[0]) {
      console.error('Invalid AI response structure:', aiData);
      return NextResponse.json({ error: 'Invalid AI response structure from Gemini API' }, { status: 500 });
    }

    const generatedText = aiData.candidates[0].content.parts[0].text;
    console.log('Generated text length:', generatedText.length);
    console.log('Generated text preview:', generatedText.substring(0, 1000));

    // Parse AI response with multiple fallback strategies
    let questions;
    try {
      const cleanedText = generatedText
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/\s*```$/, '')
        .trim();
      questions = JSON.parse(cleanedText);
    } catch (parseError) {
      console.error('Error parsing AI response:', parseError);
      console.error('Full generated text:', generatedText);

      // Try to fix common JSON issues
      try {
        // Remove common AI artifacts
        const arrayStart = generatedText.indexOf('[');
        const arrayEnd = generatedText.lastIndexOf(']');
        if (arrayStart < 0 || arrayEnd <= arrayStart) throw parseError;
        const cleanedText = generatedText.slice(arrayStart, arrayEnd + 1);

        console.log('Cleaned text:', cleanedText.substring(0, 500));
        questions = JSON.parse(cleanedText);
      } catch (secondParseError) {
        console.error('Second parse attempt failed:', secondParseError);
        return NextResponse.json({
          error: `Failed to parse generated questions. The AI response was not valid JSON.`,
          details: parseError instanceof Error ? parseError.message : 'Unknown error',
          raw_response: generatedText.substring(0, 1000)
        }, { status: 500 });
      }
    }

    if (!Array.isArray(questions) || questions.length === 0) {
      return NextResponse.json({ error: 'The AI returned no valid exam questions. Please try again.' }, { status: 500 });
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

    // FIX: never return the answer key (correct_option / expected_answer)
    // in this response — this route is called right when the exam starts,
    // so returning the full row here would let a student see every correct
    // answer immediately via the network tab, before even seeing a question.
    const safeQuestions = insertedQuestions
      .map((q: any) => ({
        id: q.id,
        exam_session_id: q.exam_session_id,
        question: q.question,
        question_type: q.question_type,
        difficulty: q.difficulty,
        options: q.options,
        order_index: q.order_index,
      }))
      .sort((a: any, b: any) => a.order_index - b.order_index);

    return NextResponse.json({
      success: true,
      questions: safeQuestions
    });

  } catch (error: any) {
    console.error('Error generating questions:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
