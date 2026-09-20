"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";
import DesktopSidebar from "@/components/DesktopSidebar";

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
  const [selectedModule, setSelectedModule] = useState<string | null>(null);
  const [modules, setModules] = useState<any[]>([]);
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
    loadModules();
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

  async function loadModules() {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      const { data } = await supabase
        .from("modules")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      setModules(data || []);
    } catch (error) {
      console.error("Error loading modules:", error);
    }
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
            moduleCode: selectedModule || "",
            moduleName: modules.find(m => m.id === selectedModule)?.name || "",
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
    setSelectedModule(null);
    setBrief("");
    setStudentWork("");
    setMessages([]);
    setError("");
  }

  function selectAssignment(item: Assignment) {
    setAssignment(item);
    setTitle(item.title);
    setSelectedModule(null);
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
      <div className="bg-slate-50 min-h-screen font-sans flex">
        {/* Desktop Sidebar */}
        <DesktopSidebar />

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col lg:ml-0">
          <div id="app" className="flex-1 flex flex-col pb-20 lg:pb-0">
            {/* Header - Mobile Only */}
            <div className="lg:hidden bg-white border-b border-slate-200 px-4 py-3 md:py-4 sticky top-0 z-10">
              <div className="mx-auto w-full max-w-[430px] md:max-w-[680px] lg:max-w-[800px] flex items-center gap-3">
                <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg">
                  <img alt="Universite logo" className="w-6 h-6 md:w-7 md:h-7 object-contain" src="/assets/images/icon-white-removebg.png" />
                </div>
                <h1 className="text-lg md:text-xl font-semibold text-slate-800">Assignment Coach</h1>
              </div>
            </div>

            {/* Desktop Header */}
            <div className="hidden lg:block bg-white border-b border-slate-200 px-8 py-4 sticky top-0 z-10">
              <div className="flex items-center justify-between">
                <h1 className="text-2xl font-semibold text-slate-900">Assignment Coach</h1>
              </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 mx-auto w-full max-w-[430px] md:max-w-[680px] lg:max-w-[800px] px-4 py-6">
              <div className="mb-8">
                <p className="text-slate-600">
                  Get help understanding and working through your assignment — without having AI do the work for you.
                </p>
              </div>

              {assignments.length > 0 && (
                <section className="mb-8">
                  <h2 className="mb-4 text-xl font-semibold text-slate-900">
                    My Assignments
                  </h2>

                  <div className="grid gap-3">
                    {assignments.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => selectAssignment(item)}
                        className="rounded-xl border border-slate-200 bg-white p-4 text-left transition hover:bg-slate-50 shadow-sm"
                      >
                        <div className="font-semibold text-slate-800">
                          {item.title}
                        </div>

                        <div className="mt-1 text-sm text-slate-500">
                          {item.module_code ||
                            item.module_name ||
                            "University assignment"}
                        </div>
                      </button>
                    ))}
                  </div>
                </section>
              )}

              <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="text-xl font-semibold text-slate-900">
                  Start an Assignment
                </h2>

                <p className="mt-1 text-sm text-slate-600">
                  Paste the assignment instructions exactly as your lecturer provided them.
                </p>

                <div className="mt-6 grid gap-4">
                  <input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Assignment title"
                    className="rounded-lg border border-slate-300 bg-white p-3 outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Module</label>
                    <select
                      value={selectedModule || ""}
                      onChange={(e) => setSelectedModule(e.target.value || null)}
                      className="w-full rounded-lg border border-slate-300 bg-white p-3 outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    >
                      <option value="">Select a module (optional)</option>
                      {modules.map((module) => (
                        <option key={module.id} value={module.id}>
                          {module.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <textarea
                    value={brief}
                    onChange={(e) => setBrief(e.target.value)}
                    placeholder="Paste your assignment question and instructions here..."
                    rows={12}
                    className="resize-y rounded-lg border border-slate-300 bg-white p-4 outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />

                  {error && (
                    <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700">
                      {error}
                    </div>
                  )}

                  <button
                    onClick={analyzeAssignment}
                    disabled={loading}
                    className="rounded-lg bg-gradient-to-r from-indigo-600 to-purple-600 px-5 py-3 font-semibold text-white disabled:opacity-50 hover:shadow-md transition-all"
                  >
                    {loading
                      ? "Understanding assignment..."
                      : "Understand My Assignment"}
                  </button>
                </div>
              </section>
            </div>

            {/* Bottom Navigation - Mobile Only */}
            <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 safe-area-inset-bottom z-10">
              <div className="mx-auto w-full max-w-[430px] md:max-w-[680px] lg:max-w-[800px]">
                <div className="flex items-center justify-around py-2">
                  <Link href="/dashboard" className="flex flex-col items-center py-2 px-4 text-slate-400 hover:text-slate-600">
                    <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                    </svg>
                    <span className="text-xs font-medium">Home</span>
                  </Link>
                  <Link href="/lectures" className="flex flex-col items-center py-2 px-4 text-slate-400 hover:text-slate-600">
                    <svg className="w-6 h-6 mb-1" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M7 3a1 1 0 000 2h6a1 1 0 100-2H7zM4 7a1 1 0 011-1h10a1 1 0 110 2H5a1 1 0 01-1-1zM2 11a2 2 0 012-2h12a2 2 0 012 2v4a2 2 0 01-2 2H4a2 2 0 01-2-2v-4z" />
                    </svg>
                    <span className="text-xs font-medium">Lectures</span>
                  </Link>
                  <Link href="/assignments" className="flex flex-col items-center py-2 px-4 text-indigo-600">
                    <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                    </svg>
                    <span className="text-xs font-medium">Assignments</span>
                  </Link>
                  <Link href="/settings" className="flex flex-col items-center py-2 px-4 text-slate-400 hover:text-slate-600">
                    <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <span className="text-xs font-medium">Settings</span>
                  </Link>
                </div>
              </div>
            </nav>
          </div>
        </div>
      </div>
    );
  }

  const analysis = assignment.analysis || {};

  return (
    <div className="bg-slate-50 min-h-screen font-sans flex">
      {/* Desktop Sidebar */}
      <DesktopSidebar />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col lg:ml-0">
        <div id="app" className="flex-1 flex flex-col pb-20 lg:pb-0">
          {/* Header - Mobile Only */}
          <div className="lg:hidden bg-white border-b border-slate-200 px-4 py-3 md:py-4 sticky top-0 z-10">
            <div className="mx-auto w-full max-w-[430px] md:max-w-[680px] lg:max-w-[800px] flex items-center gap-3">
              <button
                onClick={startNewAssignment}
                className="p-1 text-slate-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg">
                <img alt="Universite logo" className="w-6 h-6 md:w-7 md:h-7 object-contain" src="/assets/images/icon-white-removebg.png" />
              </div>
              <h1 className="text-lg md:text-xl font-semibold text-slate-800 flex-1 truncate">{assignment.title}</h1>
            </div>
          </div>

          {/* Desktop Header */}
          <div className="hidden lg:block bg-white border-b border-slate-200 px-8 py-4 sticky top-0 z-10">
            <div className="flex items-center justify-between">
              <div>
                <button
                  onClick={startNewAssignment}
                  className="mb-2 text-sm text-slate-600 hover:text-slate-900 hover:underline"
                >
                  ← All assignments
                </button>
                <h1 className="text-2xl font-semibold text-slate-900">
                  {assignment.title}
                </h1>
                <p className="text-sm text-slate-600">
                  {assignment.module_code}
                  {assignment.module_name
                    ? ` · ${assignment.module_name}`
                    : ""}
                </p>
              </div>
              <div className="rounded-full border border-slate-300 bg-slate-50 px-4 py-2 text-sm text-slate-700">
                🎓 Your work stays yours
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1 mx-auto w-full max-w-[430px] md:max-w-[680px] lg:max-w-[800px] px-4 py-6">

            <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
              <div className="space-y-6">
                <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <h2 className="text-lg font-semibold text-slate-900">
                    What your assignment is asking
                  </h2>

                  <p className="mt-3 leading-7 text-slate-700">
                    {analysis.what_the_question_is_asking ||
                      "Analysis unavailable."}
                  </p>
                </section>

                <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <h2 className="mb-3 text-lg font-semibold text-slate-900">
                    Requirements
                  </h2>

                  <List items={analysis.requirements} />
                </section>

                <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <h2 className="mb-3 text-lg font-semibold text-slate-900">
                    Key concepts
                  </h2>

                  <List items={analysis.key_concepts} />
                </section>

                <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <h2 className="mb-3 text-lg font-semibold text-slate-900">
                    Recommended approach
                  </h2>

                  <List items={analysis.recommended_approach} />
                </section>

                <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <h2 className="mb-3 text-lg font-semibold text-slate-900">
                    Self-check
                  </h2>

                  <List items={analysis.self_check} />
                </section>

                <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <h2 className="mb-3 text-lg font-semibold text-slate-900">
                    Your Work
                  </h2>

                  <p className="mb-3 text-sm text-slate-600">
                    Write your own answer, outline, calculations or notes here. The AI can give you feedback on it.
                  </p>

                  <textarea
                    value={studentWork}
                    onChange={(e) =>
                      setStudentWork(e.target.value)
                    }
                    rows={14}
                    placeholder="Start writing your own work..."
                    className="w-full resize-y rounded-lg border border-slate-300 bg-white p-4 outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </section>
              </div>

              <section className="flex min-h-[700px] flex-col rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="border-b border-slate-200 p-4">
                  <h2 className="font-semibold text-slate-900">
                    Assignment Coach
                  </h2>

                  <p className="text-sm text-slate-600">
                    I will guide you, not write your assignment.
                  </p>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {modes.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => setMode(item.id)}
                        className={`rounded-lg border px-3 py-2 text-sm ${
                          mode === item.id
                            ? "bg-gradient-to-r from-indigo-600 to-purple-600 text-white border-transparent"
                            : "border-slate-300 text-slate-700 hover:bg-slate-50"
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
                          ? "ml-auto bg-gradient-to-r from-indigo-600 to-purple-600 text-white"
                          : "bg-slate-100 text-slate-800"
                      }`}
                    >
                      {item.content}
                    </div>
                  ))}

                  {chatLoading && (
                    <div className="rounded-xl bg-slate-100 p-4 text-sm text-slate-600">
                      Thinking about your assignment...
                    </div>
                  )}
                </div>

                {error && (
                  <div className="mx-4 mb-2 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700">
                    {error}
                  </div>
                )}

                <div className="border-t border-slate-200 p-4">
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
                      className="flex-1 resize-none rounded-lg border border-slate-300 bg-white p-3 outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    />

                    <button
                      onClick={sendMessage}
                      disabled={
                        chatLoading || !message.trim()
                      }
                      className="self-end rounded-lg bg-gradient-to-r from-indigo-600 to-purple-600 px-5 py-3 font-semibold text-white disabled:opacity-50 hover:shadow-md transition-all"
                    >
                      Send
                    </button>
                  </div>

                  <p className="mt-2 text-xs text-slate-500">
                    Shift + Enter for a new line.
                  </p>
                </div>
              </section>
            </div>

            {/* Bottom Navigation - Mobile Only */}
            <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 safe-area-inset-bottom z-10">
              <div className="mx-auto w-full max-w-[430px] md:max-w-[680px] lg:max-w-[800px]">
                <div className="flex items-center justify-around py-2">
                  <Link href="/dashboard" className="flex flex-col items-center py-2 px-4 text-slate-400 hover:text-slate-600">
                    <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                    </svg>
                    <span className="text-xs font-medium">Home</span>
                  </Link>
                  <Link href="/lectures" className="flex flex-col items-center py-2 px-4 text-slate-400 hover:text-slate-600">
                    <svg className="w-6 h-6 mb-1" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M7 3a1 1 0 000 2h6a1 1 0 100-2H7zM4 7a1 1 0 011-1h10a1 1 0 110 2H5a1 1 0 01-1-1zM2 11a2 2 0 012-2h12a2 2 0 012 2v4a2 2 0 01-2 2H4a2 2 0 01-2-2v-4z" />
                    </svg>
                    <span className="text-xs font-medium">Lectures</span>
                  </Link>
                  <Link href="/assignments" className="flex flex-col items-center py-2 px-4 text-indigo-600">
                    <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                    </svg>
                    <span className="text-xs font-medium">Assignments</span>
                  </Link>
                  <Link href="/settings" className="flex flex-col items-center py-2 px-4 text-slate-400 hover:text-slate-600">
                    <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <span className="text-xs font-medium">Settings</span>
                  </Link>
                </div>
              </div>
            </nav>
          </div>
        </div>
      </div>
    </div>
  );
}

function List({
  items,
}: {
  items?: string[];
}) {
  if (!items?.length) {
    return (
      <p className="text-sm text-slate-500">
        Nothing identified yet.
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {items.map((item, index) => (
        <li
          key={index}
          className="flex gap-2 text-sm leading-6 text-slate-700"
        >
          <span className="text-slate-400">•</span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}