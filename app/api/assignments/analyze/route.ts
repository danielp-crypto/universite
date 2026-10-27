import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/client";
import { groq } from "@/lib/groq";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Keeps the request inside Groq's per-minute token limit (the free tier is
// 8,000 tokens/min): ~10,000 characters is roughly 2,900 tokens of
// instructions, plus the prompt and the analysis we ask for.
const MAX_BRIEF_CHARS = 10000;
const MAX_TITLE_CHARS = 150;
const MAX_CODE_CHARS = 40;

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

Return valid JSON only. No markdown, no code fences, no commentary.

The JSON must have exactly this structure:

{
  "what_the_question_is_asking": "2-4 plain sentences",
  "command_words": ["Word: what it asks the student to do in THIS question"],
  "requirements": ["one concrete, checkable requirement per item"],
  "key_concepts": ["short concept names the student must understand"],
  "recommended_approach": ["ordered steps for how to tackle it"],
  "questions_for_the_student": ["guiding questions that make the student think"],
  "common_mistakes": ["mistakes students typically make on this kind of task"],
  "self_check": ["questions the student can use to check their own work"]
}

Rules for the lists:
- At most 8 items per list, each one or two sentences.
- "requirements" must include anything the brief states about marks,
  word count, referencing style, structure or due dates.
- Every "command_words" item must start with the command word, then a colon.
- Use only information from the brief. If something is not stated, do not invent it.

Do not include a completed answer.
`;

type Analysis = {
  what_the_question_is_asking: string;
  command_words: string[];
  requirements: string[];
  key_concepts: string[];
  recommended_approach: string[];
  questions_for_the_student: string[];
  common_mistakes: string[];
  self_check: string[];
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Models sometimes wrap JSON in code fences or add a sentence around it, so
// a plain JSON.parse() on the raw text fails more often than it should.
function extractJson(raw: string): unknown {
  const cleaned = raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start !== -1 && end > start) {
      return JSON.parse(cleaned.slice(start, end + 1));
    }
    throw new Error("No JSON object found in the model response.");
  }
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean)
    .slice(0, 12);
}

function normalizeAnalysis(parsed: unknown): Analysis | null {
  if (!parsed || typeof parsed !== "object") return null;
  const source = parsed as Record<string, unknown>;

  const analysis: Analysis = {
    what_the_question_is_asking:
      typeof source.what_the_question_is_asking === "string"
        ? source.what_the_question_is_asking.trim()
        : "",
    command_words: asStringArray(source.command_words),
    requirements: asStringArray(source.requirements),
    key_concepts: asStringArray(source.key_concepts),
    recommended_approach: asStringArray(source.recommended_approach),
    questions_for_the_student: asStringArray(source.questions_for_the_student),
    common_mistakes: asStringArray(source.common_mistakes),
    self_check: asStringArray(source.self_check),
  };

  const hasContent =
    analysis.what_the_question_is_asking ||
    analysis.requirements.length ||
    analysis.recommended_approach.length;

  return hasContent ? analysis : null;
}

function describeAiError(error: unknown): { status: number; message: string } {
  const status = (error as { status?: number } | null)?.status;

  if (status === 429) {
    return {
      status: 503,
      message: "The AI is busy right now. Please wait a minute and try again.",
    };
  }
  if (status === 413) {
    return {
      status: 413,
      message:
        "This assignment is too long to analyse in one go. Try pasting just the question and the key instructions.",
    };
  }
  return {
    status: 500,
    message:
      "Something went wrong while analysing the assignment. Please try again.",
  };
}

// reasoning_effort "low" matters here: gpt-oss-20b is a reasoning model and
// its hidden reasoning tokens count against the output limit, so at the
// default effort a long JSON answer can be cut off mid-object.
async function runAnalysis(userPrompt: string): Promise<Analysis> {
  let lastProblem = "";

  for (let attempt = 0; attempt < 2; attempt++) {
    const completion = await groq.chat.completions.create({
      model: "openai/gpt-oss-20b",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.3,
      max_completion_tokens: attempt === 0 ? 3000 : 4000,
      reasoning_effort: "low",
      include_reasoning: false,
    });

    const raw = completion.choices[0]?.message?.content?.trim() || "";

    if (!raw) {
      lastProblem = `empty response (finish_reason: ${completion.choices[0]?.finish_reason})`;
      continue;
    }

    try {
      const analysis = normalizeAnalysis(extractJson(raw));
      if (analysis) return analysis;
      lastProblem = "JSON was valid but had no usable content";
    } catch {
      lastProblem = "response was not valid JSON";
      console.error("Invalid JSON returned by Groq:", raw.slice(0, 500));
    }
  }

  throw new Error(`Assignment analysis failed: ${lastProblem}`);
}

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

    const title =
      typeof body.title === "string" ? body.title.trim() : "";
    const assignmentBrief =
      typeof body.assignmentBrief === "string"
        ? body.assignmentBrief.trim()
        : "";
    const moduleId =
      typeof body.moduleId === "string" ? body.moduleId.trim() : "";

    // A plain-text module code (e.g. "ILW1501") is optional. Older versions
    // of the page sent the module's database id in this field, so anything
    // shaped like an id is ignored rather than stored as a "code".
    const rawModuleCode =
      typeof body.moduleCode === "string" ? body.moduleCode.trim() : "";
    const moduleCode =
      rawModuleCode &&
      !UUID_PATTERN.test(rawModuleCode) &&
      rawModuleCode.length <= MAX_CODE_CHARS
        ? rawModuleCode
        : null;

    if (!assignmentBrief) {
      return NextResponse.json(
        {
          success: false,
          error: "Please provide the assignment instructions.",
        },
        { status: 400 }
      );
    }

    if (assignmentBrief.length > MAX_BRIEF_CHARS) {
      return NextResponse.json(
        {
          success: false,
          error: `The instructions are too long (${assignmentBrief.length.toLocaleString()} characters). The limit is ${MAX_BRIEF_CHARS.toLocaleString()}. Paste just the question and key instructions.`,
        },
        { status: 400 }
      );
    }

    if (title.length > MAX_TITLE_CHARS) {
      return NextResponse.json(
        {
          success: false,
          error: `Please keep the title under ${MAX_TITLE_CHARS} characters.`,
        },
        { status: 400 }
      );
    }

    if (!process.env.GROQ_API_KEY) {
      return NextResponse.json(
        { success: false, error: "The AI service is not configured." },
        { status: 500 }
      );
    }

    // The module name comes from the database, not from the client, and the
    // module must belong to this user.
    let linkedModuleId: string | null = null;
    let linkedModuleName: string | null = null;

    if (moduleId) {
      const { data: moduleRow } = await supabaseAdmin
        .from("modules")
        .select("id, name")
        .eq("id", moduleId)
        .eq("user_id", user.id)
        .maybeSingle();

      if (!moduleRow) {
        return NextResponse.json(
          { success: false, error: "That module could not be found." },
          { status: 404 }
        );
      }

      linkedModuleId = moduleRow.id;
      linkedModuleName = moduleRow.name;
    }

    const assignmentTitle = title || "Untitled Assignment";
    const moduleLine =
      [moduleCode, linkedModuleName].filter(Boolean).join(" ") ||
      "Not provided";

    let analysis: Analysis;

    try {
      analysis = await runAnalysis(`
Assignment title:
${assignmentTitle}

Module:
${moduleLine}

Assignment instructions:

${assignmentBrief}

Analyze these instructions for the student.

Do NOT answer the assignment.

Help the student understand exactly what they need to do.
`);
    } catch (aiError) {
      console.error("Assignment analysis error:", aiError);
      const { status, message } = describeAiError(aiError);
      return NextResponse.json(
        {
          success: false,
          error:
            status === 500
              ? "The AI couldn't produce a usable breakdown this time. Please try again."
              : message,
        },
        { status: status === 500 ? 502 : status }
      );
    }

    const { data: assignment, error: insertError } = await supabaseAdmin
      .from("assignments")
      .insert({
        user_id: user.id,
        title: assignmentTitle,
        module_id: linkedModuleId,
        module_code: moduleCode,
        module_name: linkedModuleName,
        assignment_brief: assignmentBrief,
        analysis,
      })
      .select()
      .single();

    if (insertError) {
      console.error("Assignment insert error:", insertError);

      return NextResponse.json(
        { success: false, error: "Could not save assignment." },
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
    const { status, message } = describeAiError(error);

    return NextResponse.json(
      { success: false, error: message },
      { status }
    );
  }
}
