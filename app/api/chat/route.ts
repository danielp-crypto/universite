import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/client';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';

// Cap how many extra lectures can be folded in as context alongside the
// primary one. Gemini 2.5 Flash's context window can handle far more than
// this, but a sane ceiling keeps prompt size, latency, and free-tier token
// usage predictable as students add whole modules at once.
const MAX_ADDITIONAL_LECTURES = 12;

function formatLectureBlock(lecture: any, { fullTranscript }: { fullTranscript: boolean }): string {
  const parts = [
    `Title: ${lecture.title || 'Untitled'}`,
    `Date: ${lecture.date || 'Unknown'}`,
  ];

  if (lecture.duration) {
    parts.push(`Duration: ${lecture.duration}`);
  }

  if (lecture.keyConcepts?.length) {
    parts.push(`Key Concepts: ${lecture.keyConcepts.join(', ')}`);
  }

  parts.push(`Summary:\n${lecture.summary || 'No summary available'}`);
  if (lecture.slides_text) {
    parts.push(`Lecture slides:\n${lecture.slides_text}`);
  }

  // Only the primary (currently open) lecture gets its full transcript included —
  // additional lectures pulled in from a module contribute their summary and key
  // concepts only, so adding a whole module doesn't blow out the prompt size.
  if (fullTranscript) {
    parts.push(`Transcript:\n${lecture.transcription || 'No transcript available'}`);
  }

  return parts.join('\n');
}

export async function POST(request: NextRequest) {
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

    const { data: studentProfile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('major, year, learning_style')
      .eq('user_id', user.id)
      .maybeSingle();

    if (profileError) {
      console.error('Error loading student profile for tutor:', profileError);
    }

    const { message, currentLecture, additionalLectures, weakTopics, messages } = await request.json();

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

    // Persist the student's message right away, before calling Gemini, so it's
    // saved even if generation fails downstream. Only possible when chatting
    // in the context of a specific lecture — there's nothing to key it to otherwise.
    if (currentLecture?.id) {
      const { error: insertUserMsgError } = await supabaseAdmin
        .from('chat_messages')
        .insert({
          user_id: user.id,
          lecture_id: currentLecture.id,
          sender: 'user',
          content: message,
        });

      if (insertUserMsgError) {
        console.error('Error saving user chat message:', insertUserMsgError);
      }
    }

    const extraLectures: any[] = Array.isArray(additionalLectures)
      ? additionalLectures
          .filter((l: any) => l && l.id !== currentLecture?.id)
          .slice(0, MAX_ADDITIONAL_LECTURES)
      : [];
    const practiceWeakTopics = Array.isArray(weakTopics)
      ? weakTopics
          .filter((topic: unknown): topic is string => typeof topic === 'string')
          .map((topic) => topic.replace(/\s+/g, ' ').trim())
          .filter((topic) => topic.length > 0 && topic.length <= 100)
          .slice(0, 8)
      : [];

    const personalization = studentProfile
      ? `Student profile for personalization:
- Major/field of study: ${studentProfile.major || 'not provided'}
- Year of study: ${studentProfile.year || 'not provided'}
- Learning style: ${studentProfile.learning_style || 'not provided'}

Personalization guidance:
- Adjust terminology and examples to the student's academic level and major when relevant.
- Match explanations to the stated learning style where possible (for example, use structured steps for reading/writing learners, verbal explanations for auditory learners, and practical examples for kinesthetic learners).
- Do not stereotype or assume ability from the profile; ask a brief clarifying question when the preferred approach is unclear.`
      : 'No student profile information is available. Use clear, adaptable explanations and ask how the student prefers to learn when useful.';

    // Build context from lecture if available
    const tutorRules = `You are an AI TUTOR. Your only role is to help the student understand their own lecture material — you are not a general assistant and you are not a homework-completion service.

Follow these rules at all times:
- Explain concepts, define terms, work through examples, and check understanding using the lecture content above.
- Use a Socratic approach where useful: ask a guiding question, give a hint, or break a problem into steps rather than immediately handing over a final answer.
- If the student asks you to write or complete an assignment, essay, quiz, homework problem set, or exam for them — or asks for answers with no interest in understanding them — do not produce the finished work. Instead, offer to explain the underlying concept, walk through a similar example, or help them build the answer themselves.
- If a request looks like an attempt to get answers for an assignment or test that is meant to be done independently, say so plainly and redirect to teaching the concept instead of completing it.
- If the answer isn't in the lecture content, say so clearly rather than guessing.
- When multiple lectures are provided, draw on whichever ones are relevant and mention the lecture title you're referencing if it helps the student place the information — don't assume every answer relates to the primary lecture just because it's listed first.
- Be encouraging, clear, and educational.`;

    let context = '';
    const weakTopicPracticeContext = practiceWeakTopics.length > 0
      ? `\n\nWeak-area practice context:\nThe student recently missed questions related to: ${practiceWeakTopics.join(', ')}. Prioritize these concepts throughout this conversation. Teach one idea at a time, use a brief example based on the lecture material, then check understanding with a short practice question. Do not claim a topic was mastered without the student's answer demonstrating it.`
      : '';
    if (currentLecture) {
      const lectureBlocks = [formatLectureBlock(currentLecture, { fullTranscript: true })];

      if (extraLectures.length > 0) {
        lectureBlocks.push(
          ...extraLectures.map((lecture) => formatLectureBlock(lecture, { fullTranscript: false }))
        );
      }

      const lectureCountNote = extraLectures.length > 0
        ? `The student is currently viewing "${currentLecture.title || 'Untitled'}" and has also brought in ${extraLectures.length} additional lecture(s) for context.`
        : `The student is currently viewing "${currentLecture.title || 'Untitled'}".`;

      context = `${tutorRules}

${personalization}

${lectureCountNote}

${lectureBlocks.map((block, i) => `--- Lecture ${i + 1} ---\n${block}`).join('\n\n')}

Answer the student's questions based on this lecture content, following the tutoring rules above.${weakTopicPracticeContext}`;
    } else {
      context = `${tutorRules}

${personalization}

No lecture context is available right now. Ask the student to select a lecture from the dashboard first, and remind them you're here to help them understand material, not to do assignments for them.${weakTopicPracticeContext}`;
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

    if (currentLecture?.id) {
      const { error: insertBotMsgError } = await supabaseAdmin
        .from('chat_messages')
        .insert({
          user_id: user.id,
          lecture_id: currentLecture.id,
          sender: 'bot',
          content: aiResponse,
        });

      if (insertBotMsgError) {
        console.error('Error saving bot chat message:', insertBotMsgError);
      }
    }

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
