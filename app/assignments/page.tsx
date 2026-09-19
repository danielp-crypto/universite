"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

type Analysis = {
  what_the_question_is_asking?: string;
  command_words?: string[];
  requirements?: string[];
  key_concepts?: string[];
  recommended_approach?: string[];
  questions_for_the_student?: string[];
  common_mistakes?: string[];
  self_check?: string[];
};

type Assignment = {
  id: string;
  title: string;
  module_code: string | null;
  module_name: string | null;
  assignment_brief: string;
  analysis: Analysis | null;
  student_work: string;
};

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

const modes = [
  {
    id: "understand",
    title: "Understand",
    description: "Break down what the assignment is asking.",
  },
  {
    id: "plan",
    title: "Plan",
    description: "Build your own approach and structure.",
  },
  {
    id: "brainstorm",
    title: "Brainstorm",
    description: "Explore possible ideas and angles.",
  },
  {
    id: "coach",
    title: "Coach me",
    description: "Work through the assignment with guidance.",
  },
  {
    id: "review",
    title: "Review my work",
    description: "Get feedback on work you wrote yourself.",
  },
];

export default function AssignmentsPage() {
  const [assignment, setAssignment] = useState<Assignment | null>(
    null
  );

  const [assignments, setAssignments] = useState<Assignment[]>([]);

  const [title, setTitle] = useState("");
  const [moduleCode, setModuleCode] = useState("");
  const [moduleName, setModuleName] = useState("");
  const [brief, setBrief] = useState("");

  const [studentWork, setStudentWork] = useState("");

  const [mode, setMode] = useState("understand");

  const [messages, setMessages] = useState<ChatMessage[]>([]);

  const [message, setMessage] = useState("");

  const [loading, setLoading] = useState(false);
  const [chatLoading, setChatLoading] = useState(false);

  const [error, setError] = useState("");

  useEffect(() => {
    loadAssignments();
  }, []);

  async function getToken() {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    return session?.access_token;
  }

  async function loadAssignments() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;

    const { data } = await supabase
      .from("assignments")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", {
        ascending: false,
      });

    setAssignments(data || []);
  }

  async function analyzeAssignment() {
    if (!brief.trim()) {
      setError("Paste your assignment instructions first.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const token = await getToken();

      if (!token) {
        throw new Error("Please sign in again.");
      }

      const response = await fetch(
        "/api/assignments/analyze",
        {
          method: "POST",

          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },

          body: JSON.stringify({
            title,
            moduleCode,
            moduleName,
            assignmentBrief: brief,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.error || "Could not analyze assignment."
        );
      }

      setAssignment(data.assignment);
      setAssignments((prev) => [
        data.assignment,
        ...prev.filter(
          (a) => a.id !== data.assignment.id
        ),
      ]);

      setStudentWork("");

      setMessages([
        {
          role: "assistant",
          content:
            "I've broken down your assignment. I won't write the assignment for you, but I can help you understand the requirements, plan your approach, brainstorm ideas, and review your own work.",
        },
      ]);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong."
      );
    } finally {
      setLoading(false);
    }
  }

  async function sendMessage() {
    if (!assignment || !message.trim() || chatLoading) {
      return;
    }

    const userMessage = message.trim();

    setMessage("");

    setMessages((prev) => [
      ...prev,
      {
        role: "user",
        content: userMessage,
      },
    ]);

    setChatLoading(true);
    setError("");

    try {
      const token = await getToken();

      if (!token) {
        throw new Error("Please sign in again.");
      }

      const response = await fetch(
        "/api/assignments/chat",
        {
          method: "POST",

          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },

          body: JSON.stringify({
            assignmentId: assignment.id,
            message: userMessage,
            mode,
            studentWork,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.error || "AI coaching failed."
        );
      }

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: data.response,
        },
      ]);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong."
      );
    } finally {
      setChatLoading(false);
    }
  }

  function startNewAssignment() {
    setAssignment(null);
    setTitle("");
    setModuleCode("");
    setModuleName("");
    setBrief("");
    setStudentWork("");
    setMessages([]);
    setError("");
  }

  function selectAssignment(item: Assignment) {
    setAssignment(item);
    setTitle(item.title);
    setModuleCode(item.module_code || "");
    setModuleName(item.module_name || "");
    setBrief(item.assignment_brief);
    setStudentWork(item.student_work || "");

    setMessages([
      {
        role: "assistant",
        content:
          "Welcome back. We can continue working through this assignment together.",
      },
    ]);
  }

  if (!assignment) {
    return (
      <main className="min-h-screen bg-background p-6">
        <div className="mx-auto max-w-5xl">
          <div className="mb-10">
            <h1 className="text-3xl font-bold">
              Assignment Coach
            </h1>

            <p className="mt-2 max-w-2xl text-muted-foreground">
              Get help understanding and working through your
              assignment — without having AI do the work for you.
            </p>
          </div>

          {assignments.length > 0 && (
            <section className="mb-8">
              <h2 className="mb-4 text-xl font-semibold">
                My Assignments
              </h2>

              <div className="grid gap-3">
                {assignments.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => selectAssignment(item)}
                    className="rounded-xl border p-4 text-left transition hover:bg-muted"
                  >
                    <div className="font-semibold">
                      {item.title}
                    </div>

                    <div className="mt-1 text-sm text-muted-foreground">
                      {item.module_code ||
                        item.module_name ||
                        "University assignment"}
                    </div>
                  </button>
                ))}
              </div>
            </section>
          )}

          <section className="rounded-2xl border bg-card p-6 shadow-sm">
            <h2 className="text-xl font-semibold">
              Start an Assignment
            </h2>

            <p className="mt-1 text-sm text-muted-foreground">
              Paste the assignment instructions exactly as your
              lecturer provided them.
            </p>

            <div className="mt-6 grid gap-4">
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Assignment title"
                className="rounded-lg border bg-background p-3 outline-none focus:ring-2"
              />

              <div className="grid gap-4 md:grid-cols-2">
                <input
                  value={moduleCode}
                  onChange={(e) =>
                    setModuleCode(e.target.value)
                  }
                  placeholder="Module code e.g. COS1511"
                  className="rounded-lg border bg-background p-3 outline-none focus:ring-2"
                />

                <input
                  value={moduleName}
                  onChange={(e) =>
                    setModuleName(e.target.value)
                  }
                  placeholder="Module name"
                  className="rounded-lg border bg-background p-3 outline-none focus:ring-2"
                />
              </div>

              <textarea
                value={brief}
                onChange={(e) => setBrief(e.target.value)}
                placeholder="Paste your assignment question and instructions here..."
                rows={12}
                className="resize-y rounded-lg border bg-background p-4 outline-none focus:ring-2"
              />

              {error && (
                <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              <button
                onClick={analyzeAssignment}
                disabled={loading}
                className="rounded-lg bg-primary px-5 py-3 font-semibold text-primary-foreground disabled:opacity-50"
              >
                {loading
                  ? "Understanding assignment..."
                  : "Understand My Assignment"}
              </button>
            </div>
          </section>
        </div>
      </main>
    );
  }

  const analysis = assignment.analysis || {};

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-7xl p-4 md:p-6">
        <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <button
              onClick={startNewAssignment}
              className="mb-3 text-sm text-muted-foreground hover:underline"
            >
              ← All assignments
            </button>

            <h1 className="text-2xl font-bold">
              {assignment.title}
            </h1>

            <p className="text-sm text-muted-foreground">
              {assignment.module_code}
              {assignment.module_name
                ? ` · ${assignment.module_name}`
                : ""}
            </p>
          </div>

          <div className="rounded-full border px-4 py-2 text-sm">
            🎓 Your work stays yours
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
          <div className="space-y-6">
            <section className="rounded-2xl border bg-card p-5">
              <h2 className="text-lg font-semibold">
                What your assignment is asking
              </h2>

              <p className="mt-3 leading-7">
                {analysis.what_the_question_is_asking ||
                  "Analysis unavailable."}
              </p>
            </section>

            <section className="rounded-2xl border bg-card p-5">
              <h2 className="mb-3 text-lg font-semibold">
                Requirements
              </h2>

              <List items={analysis.requirements} />
            </section>

            <section className="rounded-2xl border bg-card p-5">
              <h2 className="mb-3 text-lg font-semibold">
                Key concepts
              </h2>

              <List items={analysis.key_concepts} />
            </section>

            <section className="rounded-2xl border bg-card p-5">
              <h2 className="mb-3 text-lg font-semibold">
                Recommended approach
              </h2>

              <List items={analysis.recommended_approach} />
            </section>

            <section className="rounded-2xl border bg-card p-5">
              <h2 className="mb-3 text-lg font-semibold">
                Self-check
              </h2>

              <List items={analysis.self_check} />
            </section>

            <section className="rounded-2xl border bg-card p-5">
              <h2 className="mb-3 text-lg font-semibold">
                Your Work
              </h2>

              <p className="mb-3 text-sm text-muted-foreground">
                Write your own answer, outline, calculations or
                notes here. The AI can give you feedback on it.
              </p>

              <textarea
                value={studentWork}
                onChange={(e) =>
                  setStudentWork(e.target.value)
                }
                rows={14}
                placeholder="Start writing your own work..."
                className="w-full resize-y rounded-lg border bg-background p-4 outline-none focus:ring-2"
              />
            </section>
          </div>

          <section className="flex min-h-[700px] flex-col rounded-2xl border bg-card">
            <div className="border-b p-4">
              <h2 className="font-semibold">
                Assignment Coach
              </h2>

              <p className="text-sm text-muted-foreground">
                I will guide you, not write your assignment.
              </p>

              <div className="mt-4 flex flex-wrap gap-2">
                {modes.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setMode(item.id)}
                    className={`rounded-lg border px-3 py-2 text-sm ${
                      mode === item.id
                        ? "bg-primary text-primary-foreground"
                        : "hover:bg-muted"
                    }`}
                  >
                    {item.title}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto p-4">
              {messages.map((item, index) => (
                <div
                  key={index}
                  className={`max-w-[90%] whitespace-pre-wrap rounded-xl p-4 ${
                    item.role === "user"
                      ? "ml-auto bg-primary text-primary-foreground"
                      : "bg-muted"
                  }`}
                >
                  {item.content}
                </div>
              ))}

              {chatLoading && (
                <div className="rounded-xl bg-muted p-4 text-sm">
                  Thinking about your assignment...
                </div>
              )}
            </div>

            {error && (
              <div className="mx-4 mb-2 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <div className="border-t p-4">
              <div className="flex gap-2">
                <textarea
                  value={message}
                  onChange={(e) =>
                    setMessage(e.target.value)
                  }
                  onKeyDown={(e) => {
                    if (
                      e.key === "Enter" &&
                      !e.shiftKey
                    ) {
                      e.preventDefault();
                      sendMessage();
                    }
                  }}
                  placeholder={
                    mode === "review"
                      ? "Ask me what could be improved in your work..."
                      : "Ask your Assignment Coach..."
                  }
                  rows={3}
                  className="flex-1 resize-none rounded-lg border bg-background p-3 outline-none focus:ring-2"
                />

                <button
                  onClick={sendMessage}
                  disabled={
                    chatLoading || !message.trim()
                  }
                  className="self-end rounded-lg bg-primary px-5 py-3 font-semibold text-primary-foreground disabled:opacity-50"
                >
                  Send
                </button>
              </div>

              <p className="mt-2 text-xs text-muted-foreground">
                Shift + Enter for a new line.
              </p>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

function List({
  items,
}: {
  items?: string[];
}) {
  if (!items?.length) {
    return (
      <p className="text-sm text-muted-foreground">
        Nothing identified yet.
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {items.map((item, index) => (
        <li
          key={index}
          className="flex gap-2 text-sm leading-6"
        >
          <span>•</span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}