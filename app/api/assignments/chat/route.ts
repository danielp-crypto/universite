import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/client";
import { groq } from "@/lib/groq";

export const dynamic = "force-dynamic";

const SYSTEM_PROMPT = `
You are Universite Assignment Coach.

You are an academic support tutor for university students,
especially UNISA students.

Your purpose is to HELP THE STUDENT DO THEIR OWN WORK.

==================================================
ACADEMIC INTEGRITY
==================================================

NEVER write or complete an assignment for the student.

NEVER provide:
- a submission-ready essay
- a submission-ready paragraph
- a completed assignment
- a finished discussion answer
- a finished reflective answer
- a finished case study
- a finished report
- answers intended to be copied into the student's submission

Do not rewrite the student's draft into polished submission-ready
language.

Do not pretend AI-generated writing is the student's own work.

==================================================
WHAT YOU CAN DO
==================================================

You CAN:

1. Explain the assignment question.

2. Explain command words such as:
   - discuss
   - evaluate
   - critically analyze
   - compare
   - contrast
   - explain
   - describe
   - justify
   - assess

3. Help the student brainstorm ideas.

4. Help the student identify relevant concepts.

5. Help the student create a HIGH-LEVEL outline.

6. Ask Socratic questions.

7. Break difficult concepts into simpler explanations.

8. Explain calculations and problem-solving methods.

9. Give a similar worked example when appropriate.

10. Review the student's own work.

11. Identify:
   - missing arguments
   - weak reasoning
   - unsupported claims
   - logical gaps
   - unclear structure
   - misunderstanding of the question
   - citation problems

12. Suggest what the student should investigate next.

13. Point the student toward concepts in their course material.

==================================================
WHEN THE STUDENT ASKS FOR THE ANSWER
==================================================

If the student says:

"Write this for me"

"Give me the answer"

"Do my assignment"

"Write my essay"

"Give me a paragraph I can submit"

Respond by refusing the completion request briefly.

Then immediately offer useful help.

For example:

"I can't write the submission for you, but I can help you build
the answer yourself. Let's start by identifying the main argument
you want to make."

Then ask a useful question.

==================================================
REVIEW MODE
==================================================

When reviewing student work:

DO NOT rewrite it.

Instead provide:

- What is working
- What is unclear
- What is missing
- What needs evidence
- What concept needs clarification
- Questions the student should answer
- Specific improvements the student can make

==================================================
STYLE
==================================================

Be encouraging but not overly casual.

Use clear university-level language.

Do not shame the student.

Prefer teaching over answering.

When appropriate, use Socratic questions.

Never invent sources.

If you don't know something, say so.

==================================================
CONTEXT
==================================================

You will receive:

- the assignment instructions
- the student's own work
- the selected coaching mode
- recent conversation history

Use these to help the student.

Never turn this context into a finished assignment.
`;

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");

    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json(
        { success: false, error: "unauthorized" },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);

    const {
      data: { user },
      error: authError,
    } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: "unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();

    const {
      assignmentId,
      message,
      mode = "coach",
      studentWork = "",
    } = body;

    if (!assignmentId || !message?.trim()) {
      return NextResponse.json(
        {
          success: false,
          error: "Assignment and message are required.",
        },
        { status: 400 }
      );
    }

    const { data: assignment, error: assignmentError } =
      await supabaseAdmin
        .from("assignments")
        .select("*")
        .eq("id", assignmentId)
        .eq("user_id", user.id)
        .single();

    if (assignmentError || !assignment) {
      return NextResponse.json(
        {
          success: false,
          error: "Assignment not found.",
        },
        { status: 404 }
      );
    }

    const { data: previousMessages } =
      await supabaseAdmin
        .from("assignment_messages")
        .select("sender, content, mode")
        .eq("assignment_id", assignmentId)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(10);

    const history = (previousMessages || [])
      .reverse()
      .map((msg) => ({
        role:
          msg.sender === "user"
            ? ("user" as const)
            : ("assistant" as const),
        content: msg.content,
      }));

    const modeInstructions: Record<string, string> = {
      understand: `
The student wants to UNDERSTAND the assignment.

Focus on:
- what the question means
- command words
- requirements
- concepts
- what the student needs to research
`,

      plan: `
The student wants help PLANNING their assignment.

Help them create:
- a high-level structure
- sections
- arguments they could investigate
- evidence they should look for
- questions each section should answer

Do not write the sections for them.
`,

      coach: `
The student wants COACHING.

Ask useful questions and guide their reasoning.

Do not immediately give them the final answer.
`,

      review: `
The student wants you to REVIEW THEIR WORK.

Analyze their own work.

Identify:
- strengths
- gaps
- unclear reasoning
- unsupported claims
- missing concepts
- structure problems

Do NOT rewrite it.
`,

      brainstorm: `
The student wants to BRAINSTORM.

Help them generate possible:
- angles
- arguments
- examples
- concepts
- questions to investigate

Keep these as ideas rather than finished prose.
`,
    };

    const modeInstruction =
      modeInstructions[mode] || modeInstructions.coach;

    const conversation = [
      {
        role: "system" as const,
        content: `
${SYSTEM_PROMPT}

CURRENT MODE:
${modeInstruction}

ASSIGNMENT:

Title:
${assignment.title}

Module:
${assignment.module_code || ""}
${assignment.module_name || ""}

Assignment instructions:
${assignment.assignment_brief}

AI analysis:
${JSON.stringify(assignment.analysis || {}, null, 2)}

STUDENT'S CURRENT WORK:

${studentWork || "(The student has not written anything yet.)"}
`,
      },

      ...history,

      {
        role: "user" as const,
        content: message.trim(),
      },
    ];

    const completion = await groq.chat.completions.create({
      model: "openai/gpt-oss-20b",
      messages: conversation,
      temperature: 0.5,
      max_tokens: 1800,
    });

    const response =
      completion.choices[0]?.message?.content?.trim();

    if (!response) {
      return NextResponse.json(
        {
          success: false,
          error: "No response was generated.",
        },
        { status: 502 }
      );
    }

    await supabaseAdmin
      .from("assignment_messages")
      .insert({
        assignment_id: assignmentId,
        user_id: user.id,
        sender: "user",
        mode,
        content: message.trim(),
      });

    await supabaseAdmin
      .from("assignment_messages")
      .insert({
        assignment_id: assignmentId,
        user_id: user.id,
        sender: "assistant",
        mode,
        content: response,
      });

    if (studentWork !== undefined) {
      await supabaseAdmin
        .from("assignments")
        .update({
          student_work: studentWork,
        })
        .eq("id", assignmentId)
        .eq("user_id", user.id);
    }

    return NextResponse.json({
      success: true,
      response,
    });
  } catch (error) {
    console.error("Assignment chat error:", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Assignment coaching failed.",
      },
      { status: 500 }
    );
  }
}