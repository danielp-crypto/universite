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
    const { exam_session_id, answers } = body;

    if (!exam_session_id || !answers || !Array.isArray(answers)) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Get exam session with questions
    const { data: examSession, error: sessionError } = await supabaseAdmin
      .from('exam_sessions')
      .select(`
        *,
        exam_questions (*),
        modules(*)
      `)
      .eq('id', exam_session_id)
      .eq('user_id', user.id)
      .single();

    if (sessionError || !examSession) {
      return NextResponse.json({ error: 'Exam session not found' }, { status: 404 });
    }

    // Get lectures for AI context
    const { data: lectures, error: lecturesError } = await supabaseAdmin
      .from('lectures')
      .select('id, title, transcription, summary')
      .eq('module_id', examSession.module_id)
      .not('transcription', 'is', null);

    if (lecturesError) {
      console.error('Error fetching lectures:', lecturesError);
      return NextResponse.json({ error: 'Failed to fetch lectures' }, { status: 500 });
    }

    const lectureContent = lectures.map(lecture => ({
      title: lecture.title,
      transcription: lecture.transcription,
      summary: lecture.summary
    }));

    // Process each answer with AI marking
    const processedAnswers = await Promise.all(
      examSession.exam_questions.map(async (question: any) => {
        const studentAnswer = answers.find((a: any) => a.question_id === question.id);
        
        if (!studentAnswer) {
          return null;
        }

        // For multiple choice, immediate grading
        if (question.question_type === 'multiple_choice') {
          const isCorrect = studentAnswer.answer === question.correct_option;
          return {
            question_id: question.id,
            answer: studentAnswer.answer,
            score: isCorrect ? 100 : 0,
            is_correct: isCorrect,
            feedback: isCorrect ? 'Correct!' : `Incorrect. The correct answer is ${question.correct_option}.`,
            model_answer: question.expected_answer
          };
        }

        // For short/long answer, use AI for grading
        const prompt = `You are an expert grader. Grade the following student answer based ONLY on the provided lecture content.

Question: ${question.question}
Expected Answer: ${question.expected_answer}
Student Answer: ${studentAnswer.answer}

Available lecture content:
${JSON.stringify(lectureContent, null, 2)}

Provide your response in this JSON format:
{
  "score": 0-100,
  "is_correct": true/false,
  "feedback": "Detailed feedback on the answer",
  "missing_concepts": ["concept1", "concept2"],
  "suggested_improvements": ["suggestion1", "suggestion2"],
  "model_answer": "The model answer based on lecture content"
}

Important:
- Base grading ONLY on the provided lecture content
- Be constructive and educational in feedback
- Identify specific concepts the student missed
- Provide actionable suggestions for improvement
- Return valid JSON only, no additional text`;

        try {
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
            console.error('AI grading error:', aiResponse.statusText);
            // Fallback to basic grading
            return {
              question_id: question.id,
              answer: studentAnswer.answer,
              score: 0,
              is_correct: false,
              feedback: 'Unable to grade answer automatically. Please review manually.',
              model_answer: question.expected_answer
            };
          }

          const aiData = await aiResponse.json();
          const generatedText = aiData.candidates[0].content.parts[0].text;

          // Parse AI response
          let gradingResult;
          try {
            const jsonMatch = generatedText.match(/\{[\s\S]*\}/);
            const jsonString = jsonMatch ? jsonMatch[0] : generatedText;
            gradingResult = JSON.parse(jsonString);
          } catch (parseError) {
            console.error('Error parsing AI grading:', parseError);
            return {
              question_id: question.id,
              answer: studentAnswer.answer,
              score: 0,
              is_correct: false,
              feedback: 'Unable to parse grading result.',
              model_answer: question.expected_answer
            };
          }

          return {
            question_id: question.id,
            answer: studentAnswer.answer,
            score: gradingResult.score || 0,
            is_correct: gradingResult.is_correct || false,
            feedback: gradingResult.feedback || '',
            missing_concepts: gradingResult.missing_concepts || [],
            suggested_improvements: gradingResult.suggested_improvements || [],
            model_answer: gradingResult.model_answer || question.expected_answer
          };

        } catch (error) {
          console.error('Error grading answer:', error);
          return {
            question_id: question.id,
            answer: studentAnswer.answer,
            score: 0,
            is_correct: false,
            feedback: 'Error grading answer.',
            model_answer: question.expected_answer
          };
        }
      })
    );

    // Filter out null answers
    const validAnswers = processedAnswers.filter(a => a !== null);

    // Save answers to database
    const { error: insertError } = await supabaseAdmin
      .from('student_answers')
      .insert(validAnswers);

    if (insertError) {
      console.error('Error saving answers:', insertError);
      return NextResponse.json({ error: 'Failed to save answers' }, { status: 500 });
    }

    // Calculate overall score
    const totalScore = validAnswers.reduce((sum: number, a: any) => sum + (a.score || 0), 0);
    const averageScore = validAnswers.length > 0 ? totalScore / validAnswers.length : 0;
    const correctCount = validAnswers.filter((a: any) => a.is_correct).length;

    // Calculate readiness score
    const readinessScore = calculateReadinessScore(averageScore, examSession.questions_count, correctCount);

    // Update exam session
    const { error: updateError } = await supabaseAdmin
      .from('exam_sessions')
      .update({
        status: 'completed',
        score: averageScore,
        readiness_score: readinessScore,
        correct_count: correctCount,
        submitted_at: new Date().toISOString()
      })
      .eq('id', exam_session_id);

    if (updateError) {
      console.error('Error updating exam session:', updateError);
      return NextResponse.json({ error: 'Failed to update exam session' }, { status: 500 });
    }

    // Analyze weak topics from incorrect answers
    await analyzeWeakTopics(supabaseAdmin, user.id, examSession.module_id, validAnswers, lectureContent);

    return NextResponse.json({
      success: true,
      score: averageScore,
      readiness_score: readinessScore,
      correct_count: correctCount,
      total_questions: validAnswers.length,
      answers: validAnswers
    });

  } catch (error: any) {
    console.error('Error submitting exam:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

function calculateReadinessScore(averageScore: number, totalQuestions: number, correctCount: number): number {
  // Base score from exam performance
  let readinessScore = averageScore;

  // Bonus for completing all questions
  if (correctCount === totalQuestions && totalQuestions > 0) {
    readinessScore = Math.min(100, readinessScore + 10);
  }

  // Penalty for very low completion
  if (correctCount / totalQuestions < 0.3) {
    readinessScore = Math.max(0, readinessScore - 10);
  }

  return Math.round(Math.min(100, Math.max(0, readinessScore)));
}

async function analyzeWeakTopics(supabaseAdmin: any, userId: string, moduleId: string, answers: any[], lectureContent: any[]) {
  const incorrectAnswers = answers.filter((a: any) => !a.is_correct);

  if (incorrectAnswers.length === 0) {
    return;
  }

  // Use AI to identify weak topics from incorrect answers
  const prompt = `Analyze these incorrect answers and identify the key topics/concepts the student is struggling with.

Incorrect answers:
${JSON.stringify(incorrectAnswers, null, 2)}

Available lecture content:
${JSON.stringify(lectureContent, null, 2)}

Provide your response in this JSON format:
{
  "weak_topics": [
    {
      "topic": "Topic name",
      "confidence": 0.0-1.0,
      "recommended_lecture_ids": ["lecture_id1", "lecture_id2"]
    }
  ]
}

Important:
- Identify specific topics from the lecture content
- Provide confidence scores based on how clearly the topic appears in the incorrect answers
- Recommend specific lectures to review for each weak topic
- Return valid JSON only, no additional text`;

  try {
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
      console.error('AI weak topic analysis error:', aiResponse.statusText);
      return;
    }

    const aiData = await aiResponse.json();
    const generatedText = aiData.candidates[0].content.parts[0].text;

    let analysisResult;
    try {
      const jsonMatch = generatedText.match(/\{[\s\S]*\}/);
      const jsonString = jsonMatch ? jsonMatch[0] : generatedText;
      analysisResult = JSON.parse(jsonString);
    } catch (parseError) {
      console.error('Error parsing weak topic analysis:', parseError);
      return;
    }

    // Update weak topics in database
    for (const weakTopic of analysisResult.weak_topics || []) {
      const { data: existingTopic } = await supabaseAdmin
        .from('weak_topics')
        .select('*')
        .eq('user_id', userId)
        .eq('module_id', moduleId)
        .eq('topic', weakTopic.topic)
        .single();

      if (existingTopic) {
        // Update existing weak topic
        await supabaseAdmin
          .from('weak_topics')
          .update({
            mistake_count: existingTopic.mistake_count + 1,
            confidence: Math.min(1.0, (existingTopic.confidence + weakTopic.confidence) / 2),
            last_practiced_at: new Date().toISOString(),
            recommended_lecture_ids: weakTopic.recommended_lecture_ids || existingTopic.recommended_lecture_ids
          })
          .eq('id', existingTopic.id);
      } else {
        // Create new weak topic
        await supabaseAdmin
          .from('weak_topics')
          .insert({
            user_id: userId,
            module_id: moduleId,
            topic: weakTopic.topic,
            mistake_count: 1,
            confidence: weakTopic.confidence || 0.5,
            recommended_lecture_ids: weakTopic.recommended_lecture_ids || []
          });
      }
    }

  } catch (error) {
    console.error('Error analyzing weak topics:', error);
  }
}
