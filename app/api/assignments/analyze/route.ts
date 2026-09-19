import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/client";
import { groq } from "@/lib/groq";

export const dynamic = "force-dynamic";

const SYSTEM_PROMPT = `
You are Universite Assignment Coach.

You help university students, especially UNISA students, understand
and complete their own assignments.

ACADEMIC INTEGRITY RULE:

You MUST NOT write the student's assignment for them.

You MUST NOT:
- write a submission-ready essay
- write paragraphs they can submit
- generate a complete assignment
- provide a finished answer to an assignment question
- fabricate references or sources
- disguise generated writing as student work

You MAY:
- explain what an assignment question is asking
- identify command words
- explain difficult terminology
- identify concepts the student needs to understand
- convert requirements into a checklist
- suggest a high-level structure
- suggest possible areas to investigate
- ask guiding questions
- explain how to approach a problem
- identify gaps in the student's own reasoning
- review a student's own draft
- explain concepts from their course material

The goal is to help the student learn and produce their own work.

Return valid JSON only.

The JSON must have this structure:

{
  "what_the_question_is_asking": "...",
  "command_words": [],
  "requirements": [],
  "key_concepts": [],
  "recommended_approach": [],
  "questions_for_the_student": [],
  "common_mistakes": [],
  "self_check": []
}

Do not include a completed answer.
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
      title,
      moduleCode,
      moduleName,
      assignmentBrief,
    } = body;

    if (!assignmentBrief?.trim()) {
      return NextResponse.json(
        {
          success: false,
          error: "Please provide the assignment instructions.",
        },
        { status: 400 }
      );
    }

    if (!process.env.GROQ_API_KEY) {
      return NextResponse.json(
        {
          success: false,
          error: "GROQ_API_KEY is not configured.",
        },
        { status: 500 }
      );
    }

    const completion = await groq.chat.completions.create({
      model: "openai/gpt-oss-20b",

      messages: [
        {
          role: "system",
          content: SYSTEM_PROMPT,
        },
        {
          role: "user",
          content: `
Assignment title:
${title || "Untitled Assignment"}

Module:
${moduleCode || "Not provided"} ${moduleName || ""}

Assignment instructions:

${assignmentBrief}

Analyze these instructions for the student.

Do NOT answer the assignment.

Help the student understand exactly what they need to do.
`,
        },
      ],

      temperature: 0.3,
      max_tokens: 2500,
    });

    const raw =
      completion.choices[0]?.message?.content?.trim() || "{}";

    let analysis;

    try {
      analysis = JSON.parse(raw);
    } catch {
      console.error("Invalid JSON returned by Groq:", raw);

      return NextResponse.json(
        {
          success: false,
          error: "The AI returned an invalid analysis. Please try again.",
        },
        { status: 502 }
      );
    }

    const { data: assignment, error: insertError } =
      await supabaseAdmin
        .from("assignments")
        .insert({
          user_id: user.id,
          title: title?.trim() || "Untitled Assignment",
          module_code: moduleCode?.trim() || null,
          module_name: moduleName?.trim() || null,
          assignment_brief: assignmentBrief.trim(),
          analysis,
        })
        .select()
        .single();

    if (insertError) {
      console.error("Assignment insert error:", insertError);

      return NextResponse.json(
        {
          success: false,
          error: "Could not save assignment.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      assignment,
      analysis,
    });
  } catch (error) {
    console.error("Assignment analysis error:", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Assignment analysis failed.",
      },
      { status: 500 }
    );
  }
}