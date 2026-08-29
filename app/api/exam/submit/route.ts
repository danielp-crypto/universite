import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
export const maxDuration = 60;

const PASS_THRESHOLD = 70;

function extractJson(text: string): any {
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/[\[{][\s\S]*[\]}]/);
    if (match) return JSON.parse(match[0]);
    throw new Error('Could not extract JSON from model response');
  }
}

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
    const { exam_session_id, answers } = body;

    if (!exam_session_id || !answers || !Array.isArray(answers)) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const { data: examSession, error: sessionError } = await supabaseAdmin
      .from('exam_sessions')
      .select(`*, exam_questions (*), modules(*)`)
      .eq('id', exam_session_id)
      .eq('user_id', user.id)
      .single();

    if (sessionError || !examSession) {
      return NextResponse.json({ error: 'Exam session not found' }, { status: 404 });
    }

    if (examSession.status === 'completed') {
      return NextResponse.json({ error: 'This exam has already been submitted' }, { status: 409 });
    }

    const { data: lectures, error: lecturesError } = await supabaseAdmin
      .from('lectures')
      .select('id, title, transcription, summary')
      .eq('module_id', examSession.module_id)
      .not('transcription', 'is', null);

    if (lecturesError) {
      console.error('Error fetching lectures:', lecturesError);
      return NextResponse.json({ error: 'Failed to fetch lectures' }, { status: 500 });
    }

    const lectureContent = (lectures || []).map((lecture: any) => ({
      title: lecture.title,
      summary: lecture.summary,
    }));

    const answerByQuestionId = new Map(answers.map((a: any) => [a.question_id, a.answer]));
    const allQuestions = examSession.exam_questions as any[];

    const mcQuestions = allQuestions.filter((q) => q.question_type === 'multiple_choice');
    const openQuestions = allQuestions.filter((q) => q.question_type !== 'multiple_choice');

    const mcResults = mcQuestions.map((q) => {
      const studentAnswer = (answerByQuestionId.get(q.id) as string) || '';
      const isCorrect = studentAnswer === q.correct_option;
      return {
        question_id: q.id,
        answer: studentAnswer,
        score: isCorrect ? 100 : 0,
        is_correct: isCorrect,
        feedback: isCorrect ? 'Correct!' : `Incorrect. The correct answer is ${q.correct_option}.`,
        missing_concepts: [] as string[],
        suggested_improvements: [] as string[],
        model_answer: q.correct_option,
      };
    });

    // FIX: short/long answers are graded in ONE batched Gemini call instead
    // of one call per question fired in parallel — the same rate-limit
    // failure pattern already root-caused and fixed in generate-summary.
    let openResults: any[] = [];
    if (openQuestions.length > 0) {
      if (!GEMINI_API_KEY) {
        return NextResponse.json({ error: 'GEMINI_API_KEY not configured' }, { status: 500 });
      }

      const gradingItems = openQuestions.map((q) => ({
        id: q.id,
        question: q.question,
        expected_answer: q.expected_answer,
        student_answer: (answerByQuestionId.get(q.id) as string) || '',
      }));

      const prompt = `You are an expert grader. Grade each of these student answers based ONLY on the provided lecture content — never award credit for correct-sounding claims that aren't actually supported by it.

Available lecture content:
${JSON.stringify(lectureContent, null, 2)}

Items to grade:
${gradingItems.map((item, i) => `--- Item ${i + 1} (id: ${item.id}) ---
Question: ${item.question}
Expected answer: ${item.expected_answer}
Student's answer: ${item.student_answer || '(no answer given)'}`).join('\n\n')}

Respond with ONLY a JSON array, no markdown fences, no commentary. One object per item, in the same order, each shaped exactly like:
{
  "id": "...",
  "score": 0-100,
  "is_correct": true/false,
  "feedback": "Detailed, specific feedback on this particular answer",
  "missing_concepts": ["concept the answer should have covered but didn't"],
  "suggested_improvements": ["concrete, actionable suggestion"]
}`;

      // FIX: gemini-pro is deprecated. gemini-2.5-flash matches the rest of the app.
      const aiResponse = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': GEMINI_API_KEY },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.2,
              maxOutputTokens: 8192,
              thinkingConfig: { thinkingBudget: 0 },
              responseMimeType: 'application/json',
            },
          }),
        }
      );

      if (!aiResponse.ok) {
        const errorText = await aiResponse.text().catch(() => '');
        console.error('AI grading error:', aiResponse.status, errorText);
        openResults = openQuestions.map((q) => ({
          question_id: q.id,
          answer: (answerByQuestionId.get(q.id) as string) || '',
          score: 0,
          is_correct: false,
          feedback: 'Unable to grade this answer automatically. Please review manually.',
          missing_concepts: [],
          suggested_improvements: [],
          model_answer: q.expected_answer,
        }));
      } else {
        try {
          const aiData = await aiResponse.json();
          const generatedText = aiData.candidates[0].content.parts[0].text;
          const graded = extractJson(generatedText);
          const gradedById = new Map(graded.map((g: any) => [g.id, g]));

          openResults = openQuestions.map((q) => {
            const g: any = gradedById.get(q.id);
            const score = typeof g?.score === 'number' ? Math.max(0, Math.min(100, g.score)) : 0;
            return {
              question_id: q.id,
              answer: (answerByQuestionId.get(q.id) as string) || '',
              score,
              is_correct: typeof g?.is_correct === 'boolean' ? g.is_correct : score >= PASS_THRESHOLD,
              feedback: g?.feedback || '',
              missing_concepts: Array.isArray(g?.missing_concepts) ? g.missing_concepts : [],
              suggested_improvements: Array.isArray(g?.suggested_improvements) ? g.suggested_improvements : [],
              model_answer: q.expected_answer,
            };
          });
        } catch (parseError) {
          console.error('Error parsing batched grading response:', parseError);
          openResults = openQuestions.map((q) => ({
            question_id: q.id,
            answer: (answerByQuestionId.get(q.id) as string) || '',
            score: 0,
            is_correct: false,
            feedback: 'Unable to parse grading result.',
            missing_concepts: [],
            suggested_improvements: [],
            model_answer: q.expected_answer,
          }));
        }
      }
    }

    const validAnswers = [...mcResults, ...openResults];

    const { error: insertError } = await supabaseAdmin
      .from('student_answers')
      .insert(
        validAnswers.map((a) => ({
          exam_session_id,
          question_id: a.question_id,
          answer: a.answer,
          score: a.score,
          is_correct: a.is_correct,
          feedback: a.feedback,
          missing_concepts: a.missing_concepts,
          suggested_improvements: a.suggested_improvements,
          model_answer: a.model_answer,
        }))
      );

    if (insertError) {
      console.error('Error saving answers:', insertError);
      return NextResponse.json({ error: 'Failed to save answers' }, { status: 500 });
    }

    const totalScore = validAnswers.reduce((sum, a) => sum + (a.score || 0), 0);
    const averageScore = validAnswers.length > 0 ? totalScore / validAnswers.length : 0;
    const correctCount = validAnswers.filter((a) => a.is_correct).length;
    const readinessScore = calculateReadinessScore(averageScore, validAnswers.length, correctCount);

    const { error: updateError } = await supabaseAdmin
      .from('exam_sessions')
      .update({
        status: 'completed',
        score: averageScore,
        readiness_score: readinessScore,
        correct_count: correctCount,
        submitted_at: new Date().toISOString(),
      })
      .eq('id', exam_session_id);

    if (updateError) {
      console.error('Error updating exam session:', updateError);
      return NextResponse.json({ error: 'Failed to update exam session' }, { status: 500 });
    }

    await analyzeWeakTopics(supabaseAdmin, user.id, examSession.module_id, validAnswers, allQuestions, lectureContent);

    return NextResponse.json({
      success: true,
      score: averageScore,
      readiness_score: readinessScore,
      correct_count: correctCount,
      total_questions: validAnswers.length,
      answers: validAnswers,
    });

  } catch (error: any) {
    console.error('Error submitting exam:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

function calculateReadinessScore(averageScore: number, totalQuestions: number, correctCount: number): number {
  let readinessScore = averageScore;
  if (correctCount === totalQuestions && totalQuestions > 0) {
    readinessScore = Math.min(100, readinessScore + 10);
  }
  if (totalQuestions > 0 && correctCount / totalQuestions < 0.3) {
    readinessScore = Math.max(0, readinessScore - 10);
  }
  return Math.round(Math.min(100, Math.max(0, readinessScore)));
}

async function analyzeWeakTopics(
  supabaseAdmin: any,
  userId: string,
  moduleId: string,
  answers: any[],
  questions: any[],
  lectureContent: any[]
) {
  const questionById = new Map(questions.map((q) => [q.id, q]));
  const incorrectAnswers = answers
    .filter((a) => !a.is_correct)
    .map((a) => ({ ...a, question: questionById.get(a.question_id)?.question }));

  if (incorrectAnswers.length === 0) return;
  if (!GEMINI_API_KEY) return;

  const prompt = `Analyze these incorrect exam answers and identify the key topics/concepts the student is struggling with.

Incorrect answers:
${JSON.stringify(incorrectAnswers, null, 2)}

Available lecture content:
${JSON.stringify(lectureContent, null, 2)}

Respond with ONLY JSON, no markdown fences, no commentary, in this exact shape:
{
  "weak_topics": [
    { "topic": "Topic name", "confidence": 0.0-1.0 }
  ]
}`;

  try {
    const aiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': GEMINI_API_KEY },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 2048,
            thinkingConfig: { thinkingBudget: 0 },
            responseMimeType: 'application/json',
          },
        }),
      }
    );

    if (!aiResponse.ok) {
      console.error('AI weak topic analysis error:', aiResponse.status, await aiResponse.text().catch(() => ''));
      return;
    }

    const aiData = await aiResponse.json();
    const generatedText = aiData.candidates[0].content.parts[0].text;
    const analysisResult = extractJson(generatedText);

    for (const weakTopic of analysisResult.weak_topics || []) {
      const { data: existingTopic } = await supabaseAdmin
        .from('weak_topics')
        .select('*')
        .eq('user_id', userId)
        .eq('module_id', moduleId)
        .eq('topic', weakTopic.topic)
        .maybeSingle();

      if (existingTopic) {
        await supabaseAdmin
          .from('weak_topics')
          .update({
            mistake_count: existingTopic.mistake_count + 1,
            confidence: Math.min(1.0, (existingTopic.confidence + weakTopic.confidence) / 2),
            last_practiced_at: new Date().toISOString(),
          })
          .eq('id', existingTopic.id);
      } else {
        await supabaseAdmin.from('weak_topics').insert({
          user_id: userId,
          module_id: moduleId,
          topic: weakTopic.topic,
          mistake_count: 1,
          confidence: weakTopic.confidence || 0.5,
        });
      }
    }
  } catch (error) {
    console.error('Error analyzing weak topics:', error);
  }
}