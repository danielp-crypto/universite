import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/client";
import { embedQuery } from "@/lib/documents/embeddings";
import { groq } from "@/lib/groq";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// ---------------------------------------------------------------------------
// Prompt budget
// ---------------------------------------------------------------------------
// Everything below is sized so one request fits inside Groq's per-minute
// token limit. GROQ_TPM_LIMIT should match the "tokens per minute" shown for
// openai/gpt-oss-20b on the Groq limits page (8000 on the free tier). The
// caps scale up automatically when it is raised. Without caps, a long draft
// plus ten history messages plus the brief easily exceeded 8,000 tokens and
// every request was rejected with HTTP 413.
const GROQ_TPM_LIMIT = (() => {
  const parsed = Number(process.env.GROQ_TPM_LIMIT);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 8000;
})();
const TPM_CAP = Math.floor(GROQ_TPM_LIMIT * 0.9);
const SCALE = Math.max(0.5, Math.min(6, (TPM_CAP - 2600) / 4600));

// The page mirrors MAX_MESSAGE_CHARS and MAX_STORED_WORK_CHARS.
const MAX_MESSAGE_CHARS = 3000;
const MAX_STORED_WORK_CHARS = 50000;

const CAPS = {
  brief: Math.floor(2600 * SCALE),
  analysis: Math.floor(1000 * SCALE),
  work: Math.floor(3600 * SCALE),
  history: Math.floor(2600 * SCALE),
  course: Math.floor(2600 * SCALE),
};
const MAX_HISTORY_MESSAGES = 8;
const MAX_LECTURES_IN_CONTEXT = 6;
const MAX_COURSE_CHUNKS = 4;
// gpt-oss-20b spends part of this on hidden reasoning, so it is larger than
// the visible reply needs to be.
const OUTPUT_TOKENS = SCALE >= 2 ? 2500 : 1500;

const clip = (text: string, max: number) =>
  text.length > max ? text.slice(0, max) : text;

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

type Analysis = {
  what_the_question_is_asking?: string;
  command_words?: string[];
  requirements?: string[];
  key_concepts?: string[];
  recommended_approach?: string[];
};

type SourceRef = { type: "lecture" | "material"; label: string };

// A short version of the saved analysis. The full JSON used to be pasted in
// on every message, which cost tokens for information the model already has
// in the brief.
function summariseAnalysis(analysis: Analysis | null): string {
  if (!analysis) return "(none)";

  const lines: string[] = [];
  if (analysis.what_the_question_is_asking) {
    lines.push(`Question means: ${analysis.what_the_question_is_asking}`);
  }
  if (analysis.command_words?.length) {
    lines.push(`Command words: ${analysis.command_words.join("; ")}`);
  }
  if (analysis.requirements?.length) {
    lines.push(`Requirements: ${analysis.requirements.join("; ")}`);
  }
  if (analysis.key_concepts?.length) {
    lines.push(`Key concepts: ${analysis.key_concepts.join(", ")}`);
  }
  return clip(lines.join("\n"), CAPS.analysis);
}

// Lecture summaries start with a "## Key Concepts" section, which is the
// most useful few hundred characters for pointing a student to the right
// lecture.
function lectureSnippet(summary: string | null, maxChars: number): string {
  if (!summary) return "";
  const match = summary.match(/##\s*Key Concepts\s*([\s\S]*?)(?=\n##\s|$)/i);
  return clip((match ? match[1] : summary).trim(), maxChars);
}

// Pulls in the student's own course material for the assignment's module:
// titles and key concepts of their lectures, plus the uploaded-study-material
// passages most relevant to what they just asked. Failure here must never
// break the coach, so every step falls back to "no extra context".
async function loadCourseMaterial(
  moduleId: string,
  userId: string,
  query: string
): Promise<{ block: string; sources: SourceRef[] }> {
  const sources: SourceRef[] = [];
  const sections: string[] = [];
  const lectureBudget = Math.floor(CAPS.course * 0.4);
  const materialBudget = CAPS.course - lectureBudget;

  const [lectureResult, materialResult] = await Promise.allSettled([
    supabaseAdmin
      .from("lectures")
      .select("title, summary")
      .eq("module_id", moduleId)
      .eq("user_id", userId)
      .eq("status", "completed")
      .order("created_at", { ascending: false })
      .limit(MAX_LECTURES_IN_CONTEXT),
    (async () => {
      const queryEmbedding = await embedQuery(query);
      const { data, error } = await supabaseAdmin.rpc(
        "match_study_material_chunks",
        {
          query_embedding: queryEmbedding,
          match_module_id: moduleId,
          match_count: MAX_COURSE_CHUNKS,
        }
      );
      if (error) throw error;
      return (data || []) as {
        study_material_id: string;
        content: string;
      }[];
    })(),
  ]);

  if (lectureResult.status === "fulfilled" && lectureResult.value.data?.length) {
    const lectures = lectureResult.value.data;
    const perLecture = Math.floor(lectureBudget / lectures.length);
    const lines = lectures.map((lecture) => {
      sources.push({ type: "lecture", label: lecture.title || "Untitled lecture" });
      const snippet = lectureSnippet(lecture.summary, Math.max(perLecture - 60, 80));
      return `[Lecture: ${lecture.title || "Untitled"}]\n${snippet}`;
    });
    sections.push(`Lectures in this module:\n${lines.join("\n\n")}`);
  } else if (lectureResult.status === "rejected") {
    console.error("Assignment coach: lecture lookup failed:", lectureResult.reason);
  }

  if (materialResult.status === "fulfilled" && materialResult.value.length) {
    const chunks = materialResult.value;
    const ids = [...new Set(chunks.map((chunk) => chunk.study_material_id))];

    const titleById = new Map<string, string>();
    const { data: materialRows } = await supabaseAdmin
      .from("study_materials")
      .select("id, title")
      .in("id", ids)
      .eq("user_id", userId);
    for (const row of materialRows || []) titleById.set(row.id, row.title);

    let used = 0;
    const excerpts: string[] = [];
    for (const chunk of chunks) {
      const title = titleById.get(chunk.study_material_id) || "Uploaded study material";
      const text = clip(chunk.content, 700);
      if (used + text.length > materialBudget && excerpts.length > 0) break;
      used += text.length;
      excerpts.push(`[Study material: ${title}]\n${text}`);
      if (!sources.some((s) => s.type === "material" && s.label === title)) {
        sources.push({ type: "material", label: title });
      }
    }
    sections.push(`Relevant excerpts from the student's uploaded study materials:\n${excerpts.join("\n\n")}`);
  } else if (materialResult.status === "rejected") {
    console.error("Assignment coach: study material retrieval failed:", materialResult.reason);
  }

  return { block: sections.join("\n\n"), sources };
}

function describeAiError(error: unknown): { status: number; message: string } {
  const status = (error as { status?: number } | null)?.status;

  if (status === 429) {
    return {
      status: 503,
      message: "The coach is busy right now. Please wait a moment and send that again.",
    };
  }
  if (status === 413) {
    return {
      status: 413,
      message: "That message plus your draft is too long for the coach. Try a shorter message or a shorter draft.",
    };
  }
  return {
    status: 500,
    message: "The coach couldn't reply this time. Please try again.",
  };
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

    const assignmentId =
      typeof body.assignmentId === "string" ? body.assignmentId : "";
    const message =
      typeof body.message === "string" ? body.message.trim() : "";
    const mode = typeof body.mode === "string" ? body.mode : "coach";
    const studentWork =
      typeof body.studentWork === "string" ? body.studentWork : "";

    if (!assignmentId || !message) {
      return NextResponse.json(
        {
          success: false,
          error: "Assignment and message are required.",
        },
        { status: 400 }
      );
    }

    if (message.length > MAX_MESSAGE_CHARS) {
      return NextResponse.json(
        {
          success: false,
          error: `That message is too long (${message.length.toLocaleString()} characters). Please keep it under ${MAX_MESSAGE_CHARS.toLocaleString()}.`,
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
        .limit(MAX_HISTORY_MESSAGES);

    // Newest first, so the budget is spent on the most recent turns, then
    // flipped back into chronological order.
    let historyChars = 0;
    const history: { role: "user" | "assistant"; content: string }[] = [];
    for (const msg of previousMessages || []) {
      const content = clip(msg.content as string, 900);
      if (historyChars + content.length > CAPS.history && history.length > 0) break;
      historyChars += content.length;
      history.push({
        role: msg.sender === "user" ? "user" : "assistant",
        content,
      });
    }
    history.reverse();

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

    const safeMode = mode in modeInstructions ? mode : "coach";
    const modeInstruction = modeInstructions[safeMode];

    // Course material is only available when the assignment is linked to a
    // module (older assignments created before module linking are not).
    let courseBlock = "";
    let sources: SourceRef[] = [];
    if (assignment.module_id) {
      const course = await loadCourseMaterial(
        assignment.module_id,
        user.id,
        `${assignment.title}. ${message}`
      );
      courseBlock = course.block;
      sources = course.sources;
    }

    const workForPrompt = studentWork.trim();
    const workTruncated = workForPrompt.length > CAPS.work;
    const workText = workForPrompt
      ? clip(workForPrompt, CAPS.work) +
        (workTruncated
          ? `\n\n[The student's work is longer than can be shown here. Only the first ${CAPS.work.toLocaleString()} characters are included. Tell the student if this limits your feedback.]`
          : "")
      : "(The student has not written anything yet.)";

    const conversation = [
      {
        role: "system" as const,
        content: `
${SYSTEM_PROMPT}

CURRENT MODE:
${modeInstruction}

REPLY STYLE:
- Use short markdown: bold key terms and use bullet lists where they help.
- Keep replies focused, usually under 250 words, unless the student asks for more.
- End with one question or one concrete next step for the student.

COURSE MATERIAL:
${courseBlock || "(No course material is linked to this assignment.)"}

When you use course material, say which lecture or uploaded study material it
comes from. Use it to point the student to relevant concepts and to explain
them. Never paste it as a finished answer, and never invent a source that is
not listed above.

ASSIGNMENT:

Title:
${assignment.title}

Module:
${assignment.module_name || assignment.module_code || ""}

Assignment instructions:
${clip(assignment.assignment_brief as string, CAPS.brief)}

Summary of the earlier analysis:
${summariseAnalysis(assignment.analysis as Analysis | null)}

STUDENT'S CURRENT WORK:

${workText}
`,
      },

      ...history,

      {
        role: "user" as const,
        content: message,
      },
    ];

    // reasoning_effort "low": gpt-oss-20b is a reasoning model and its hidden
    // reasoning tokens count against the output limit. At the default effort
    // a reply could be consumed entirely by reasoning and come back empty,
    // which surfaced as "No response was generated".
    let response = "";
    try {
      for (let attempt = 0; attempt < 2 && !response; attempt++) {
        const completion = await groq.chat.completions.create({
          model: "openai/gpt-oss-20b",
          messages: conversation,
          temperature: 0.5,
          max_completion_tokens:
            attempt === 0 ? OUTPUT_TOKENS : Math.ceil(OUTPUT_TOKENS * 1.5),
          reasoning_effort: "low",
          include_reasoning: false,
        });

        response = completion.choices[0]?.message?.content?.trim() || "";
      }
    } catch (aiError) {
      console.error("Assignment chat AI error:", aiError);
      const { status, message: friendly } = describeAiError(aiError);
      return NextResponse.json(
        { success: false, error: friendly },
        { status }
      );
    }

    if (!response) {
      return NextResponse.json(
        {
          success: false,
          error: "The coach couldn't reply this time. Please try again.",
        },
        { status: 502 }
      );
    }

    const { error: saveMessagesError } = await supabaseAdmin
      .from("assignment_messages")
      .insert([
        {
          assignment_id: assignmentId,
          user_id: user.id,
          sender: "user",
          mode: safeMode,
          content: message,
        },
        {
          assignment_id: assignmentId,
          user_id: user.id,
          sender: "assistant",
          mode: safeMode,
          content: response,
        },
      ]);

    if (saveMessagesError) {
      console.error("Error saving assignment messages:", saveMessagesError);
    }

    // The draft is also autosaved by the page; this keeps it in step when a
    // message is sent. It is only written when it actually changed.
    if (
      studentWork !== (assignment.student_work || "") &&
      studentWork.length <= MAX_STORED_WORK_CHARS
    ) {
      const { error: saveWorkError } = await supabaseAdmin
        .from("assignments")
        .update({ student_work: studentWork })
        .eq("id", assignmentId)
        .eq("user_id", user.id);

      if (saveWorkError) {
        console.error("Error saving student work:", saveWorkError);
      }
    }

    return NextResponse.json({
      success: true,
      response,
      sources,
      workTruncated,
    });
  } catch (error) {
    console.error("Assignment chat error:", error);
    const { status, message } = describeAiError(error);

    return NextResponse.json(
      { success: false, error: message },
      { status }
    );
  }
}