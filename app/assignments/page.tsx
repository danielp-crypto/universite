"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { supabase } from "@/lib/supabase/client";
import DesktopSidebar from "@/components/DesktopSidebar";

// ---------------------------------------------------------------------------
// Types and constants
// ---------------------------------------------------------------------------
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

type AssignmentStatus = "active" | "completed" | "archived";

type Assignment = {
  id: string;
  title: string;
  module_id: string | null;
  module_code: string | null;
  module_name: string | null;
  assignment_brief: string;
  analysis: Analysis | null;
  student_work: string | null;
  status: AssignmentStatus;
  created_at: string;
  updated_at: string;
};

type SourceRef = { type: "lecture" | "material"; label: string };

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  sources?: SourceRef[];
};

type ModuleRow = { id: string; name: string };

type Tab = "breakdown" | "work" | "coach";
type SaveState = "idle" | "unsaved" | "saving" | "saved" | "error";

// These mirror the limits enforced by the API routes.
const MAX_BRIEF_CHARS = 10000;
const MAX_MESSAGE_CHARS = 3000;
const MAX_WORK_CHARS = 50000;

// Assignment file upload. 4 MB is just under Vercel's 4.5 MB request limit.
const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;
const ACCEPTED_EXTENSIONS = [".pdf", ".docx", ".pptx", ".txt", ".md"];

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const modes = [
  {
    id: "understand",
    title: "Understand",
    description: "Break down what the assignment is asking.",
    placeholder: "Ask what any part of the assignment means...",
    starters: [
      "What is this question really asking me to do?",
      "Explain the command words in plain language.",
      "What would a strong answer need to include?",
    ],
  },
  {
    id: "plan",
    title: "Plan",
    description: "Build your own approach and structure.",
    placeholder: "Ask for help structuring your answer...",
    starters: [
      "Help me work out a structure for my answer.",
      "How should I split my time on this assignment?",
      "What sections do I need, and why?",
    ],
  },
  {
    id: "brainstorm",
    title: "Brainstorm",
    description: "Explore possible ideas and angles.",
    placeholder: "Ask for angles, examples or arguments to explore...",
    starters: [
      "What angles could I explore?",
      "What should I look up before I start writing?",
      "What counter-arguments should I think about?",
    ],
  },
  {
    id: "coach",
    title: "Coach me",
    description: "Work through the assignment with guidance.",
    placeholder: "Tell the coach where you are stuck...",
    starters: [
      "Ask me questions to help me get started.",
      "I'm stuck. Where should I begin?",
      "Check my understanding of the key concepts.",
    ],
  },
  {
    id: "review",
    title: "Review my work",
    description: "Get feedback on work you wrote yourself.",
    placeholder: "Ask what could be improved in your work...",
    starters: [
      "Please review my work so far.",
      "Where do I need more evidence?",
      "Is the structure of my answer clear?",
    ],
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function moduleLabel(item: Assignment): string | null {
  // Older assignments stored the module's database id in module_code, so an
  // id-shaped value is never shown to the student.
  const code =
    item.module_code && !UUID_PATTERN.test(item.module_code)
      ? item.module_code
      : null;
  if (code && item.module_name && code !== item.module_name) {
    return `${code} · ${item.module_name}`;
  }
  return item.module_name || code;
}

function wordCount(text: string): number {
  const trimmed = text.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}

function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-ZA", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

// "Assignment_2_Contract_Law.pdf" -> "Assignment 2 Contract Law"
function titleFromFilename(name: string): string {
  return name
    .replace(/\.[^.]+$/, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 150);
}

function splitCommandWord(item: string): { word: string; meaning: string } {
  const index = item.indexOf(":");
  if (index > 0 && index <= 30) {
    return {
      word: item.slice(0, index).trim(),
      meaning: item.slice(index + 1).trim(),
    };
  }
  return { word: item, meaning: "" };
}

const checklistKey = (id: string) => `assignment-checklist:${id}`;

function readChecklist(id: string): Record<number, boolean> {
  try {
    const raw = window.localStorage.getItem(checklistKey(id));
    return raw ? (JSON.parse(raw) as Record<number, boolean>) : {};
  } catch {
    return {};
  }
}

function writeChecklist(id: string, value: Record<number, boolean>) {
  try {
    window.localStorage.setItem(checklistKey(id), JSON.stringify(value));
  } catch {
    // Storage can be unavailable (private mode); ticks just won't persist.
  }
}

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-1";

const markdownComponents = {
  p: ({ children }: { children?: React.ReactNode }) => (
    <p className="mb-2 last:mb-0">{children}</p>
  ),
  ul: ({ children }: { children?: React.ReactNode }) => (
    <ul className="mb-2 list-disc space-y-1 pl-5 last:mb-0">{children}</ul>
  ),
  ol: ({ children }: { children?: React.ReactNode }) => (
    <ol className="mb-2 list-decimal space-y-1 pl-5 last:mb-0">{children}</ol>
  ),
  li: ({ children }: { children?: React.ReactNode }) => <li>{children}</li>,
  strong: ({ children }: { children?: React.ReactNode }) => (
    <strong className="font-semibold text-slate-900">{children}</strong>
  ),
  h1: ({ children }: { children?: React.ReactNode }) => (
    <p className="mb-1 font-semibold text-slate-900">{children}</p>
  ),
  h2: ({ children }: { children?: React.ReactNode }) => (
    <p className="mb-1 font-semibold text-slate-900">{children}</p>
  ),
  h3: ({ children }: { children?: React.ReactNode }) => (
    <p className="mb-1 font-semibold text-slate-900">{children}</p>
  ),
  code: ({ children }: { children?: React.ReactNode }) => (
    <code className="rounded bg-slate-200 px-1 py-0.5 text-xs">{children}</code>
  ),
  blockquote: ({ children }: { children?: React.ReactNode }) => (
    <blockquote className="my-2 border-l-4 border-indigo-300 pl-3 text-slate-600">
      {children}
    </blockquote>
  ),
};

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function AssignmentsPage() {
  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [assignmentsLoading, setAssignmentsLoading] = useState(true);
  const [listFilter, setListFilter] = useState<"active" | "completed">("active");
  const [modules, setModules] = useState<ModuleRow[]>([]);

  const [title, setTitle] = useState("");
  const [selectedModule, setSelectedModule] = useState("");
  const [brief, setBrief] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [uploadedFile, setUploadedFile] = useState<{
    name: string;
    words: number;
    truncated: boolean;
  } | null>(null);

  const [studentWork, setStudentWork] = useState("");
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [workTruncated, setWorkTruncated] = useState(false);

  const [tab, setTab] = useState<Tab>("breakdown");
  const [checked, setChecked] = useState<Record<number, boolean>>({});
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busyAction, setBusyAction] = useState(false);

  const [mode, setMode] = useState("understand");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState("");

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const lastSavedWork = useRef("");
  const studentWorkRef = useRef("");
  const activeIdRef = useRef<string | null>(null);
  const chatScrollRef = useRef<HTMLDivElement | null>(null);
  const messageInputRef = useRef<HTMLTextAreaElement | null>(null);

  // Lets async callbacks (autosave, send) compare against the latest text
  // without being re-created on every keystroke.
  useEffect(() => {
    studentWorkRef.current = studentWork;
  }, [studentWork]);

  const getToken = useCallback(async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    return session?.access_token;
  }, []);

  // -------------------------------------------------------------------------
  // Loading
  // -------------------------------------------------------------------------
  useEffect(() => {
    async function loadAll() {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) return;

        const [assignmentResult, moduleResult] = await Promise.all([
          supabase
            .from("assignments")
            .select("*")
            .eq("user_id", user.id)
            .neq("status", "archived")
            .order("updated_at", { ascending: false }),
          supabase
            .from("modules")
            .select("id, name")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false }),
        ]);

        setAssignments((assignmentResult.data as Assignment[]) || []);
        setModules((moduleResult.data as ModuleRow[]) || []);
      } catch (loadError) {
        console.error("Error loading assignments:", loadError);
        setError("We couldn't load your assignments. Please refresh the page.");
      } finally {
        setAssignmentsLoading(false);
      }
    }

    loadAll();
  }, []);

  // Keep the chat scrolled to the newest message.
  useEffect(() => {
    const el = chatScrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, chatLoading, tab, messagesLoading]);

  // -------------------------------------------------------------------------
  // Autosave for "Your work"
  // -------------------------------------------------------------------------
  const saveWork = useCallback(async (id: string, work: string) => {
    setSaveState("saving");

    const { error: saveError } = await supabase
      .from("assignments")
      .update({ student_work: work })
      .eq("id", id);

    if (saveError) {
      console.error("Error saving work:", saveError);
      setSaveState("error");
      return false;
    }

    lastSavedWork.current = work;
    setAssignments((prev) =>
      prev.map((item) => (item.id === id ? { ...item, student_work: work } : item))
    );
    setSaveState(studentWorkRef.current === work ? "saved" : "unsaved");
    return true;
  }, []);

  const assignmentId = assignment?.id ?? null;

  useEffect(() => {
    if (!assignmentId) return;
    if (studentWork === lastSavedWork.current) return;

    setSaveState("unsaved");
    const timer = setTimeout(() => {
      void saveWork(assignmentId, studentWork);
    }, 1200);

    return () => clearTimeout(timer);
  }, [studentWork, assignmentId, saveWork]);

  // Warn before the tab closes while work is unsaved.
  useEffect(() => {
    if (saveState !== "unsaved" && saveState !== "error") return;

    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [saveState]);

  // -------------------------------------------------------------------------
  // Actions
  // -------------------------------------------------------------------------
  async function openAssignment(item: Assignment) {
    activeIdRef.current = item.id;

    setAssignment(item);
    setSelectedModule(item.module_id || "");
    lastSavedWork.current = item.student_work || "";
    setStudentWork(item.student_work || "");
    setSaveState("idle");
    setWorkTruncated(false);
    setTab("breakdown");
    setChecked(readChecklist(item.id));
    setConfirmDelete(false);
    setChatError("");
    setMessage("");
    setMessages([]);
    setMessagesLoading(true);

    const { data, error: messagesError } = await supabase
      .from("assignment_messages")
      .select("sender, content, created_at")
      .eq("assignment_id", item.id)
      .order("created_at", { ascending: true })
      .limit(200);

    // The student may have opened a different assignment in the meantime.
    if (activeIdRef.current !== item.id) return;

    if (messagesError) {
      console.error("Error loading messages:", messagesError);
    } else {
      setMessages(
        ((data as { sender: string; content: string }[]) || []).map((row) => ({
          role: row.sender === "user" ? "user" : "assistant",
          content: row.content,
        }))
      );
    }
    setMessagesLoading(false);
  }

  async function backToList() {
    if (assignment && studentWork !== lastSavedWork.current) {
      await saveWork(assignment.id, studentWork);
    }
    activeIdRef.current = null;
    setAssignment(null);
    setMessages([]);
    setChatError("");
    setError("");
    setConfirmDelete(false);
  }

  async function analyzeAssignment() {
    const trimmedBrief = brief.trim();

    if (!trimmedBrief) {
      setError("Paste your assignment instructions first.");
      return;
    }
    if (trimmedBrief.length > MAX_BRIEF_CHARS) {
      setError(
        `The instructions are too long. Please keep them under ${MAX_BRIEF_CHARS.toLocaleString()} characters.`
      );
      return;
    }

    setLoading(true);
    setError("");

    try {
      const token = await getToken();

      if (!token) {
        throw new Error("Please sign in again.");
      }

      const response = await fetch("/api/assignments/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: title.trim(),
          moduleId: selectedModule,
          assignmentBrief: trimmedBrief,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || data.error || "Could not analyze assignment.");
      }

      const created = data.assignment as Assignment;
      setAssignments((prev) => [created, ...prev.filter((a) => a.id !== created.id)]);
      setTitle("");
      setBrief("");
      setUploadedFile(null);
      setUploadError("");
      await openAssignment(created);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  async function handleFile(file: File) {
    setUploadError("");

    const lowerName = file.name.toLowerCase();
    const extension = lowerName.includes(".")
      ? lowerName.slice(lowerName.lastIndexOf("."))
      : "";

    if (extension === ".doc") {
      setUploadError(
        "Old Word (.doc) files aren't supported. Save the file as .docx or PDF and try again."
      );
      return;
    }
    if (!ACCEPTED_EXTENSIONS.includes(extension)) {
      setUploadError(
        "That file type isn't supported. Upload a PDF, Word (.docx), PowerPoint (.pptx) or text file, or paste the instructions instead."
      );
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      setUploadError(
        `That file is too large (${(file.size / 1024 / 1024).toFixed(1)} MB). The limit is 4 MB.`
      );
      return;
    }

    setUploading(true);

    try {
      const token = await getToken();

      if (!token) {
        throw new Error("Please sign in again.");
      }

      const body = new FormData();
      body.append("file", file);

      const response = await fetch("/api/assignments/extract", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body,
      });

      // A size rejection from the hosting platform is not JSON.
      let data: {
        success?: boolean;
        error?: string;
        text?: string;
        wordCount?: number;
        truncated?: boolean;
      } | null = null;
      try {
        data = await response.json();
      } catch {
        data = null;
      }

      if (!response.ok || !data?.success) {
        throw new Error(
          data?.error ||
            (response.status === 413
              ? "That file is too large. The limit is 4 MB."
              : "We couldn't read that file. Please try again, or paste the instructions instead.")
        );
      }

      const extracted = data.text || "";

      // Text that is already in the box is kept, with the file added after it.
      setBrief((previous) =>
        previous.trim() ? `${previous.trim()}\n\n${extracted}` : extracted
      );
      setTitle((previous) =>
        previous.trim() ? previous : titleFromFilename(file.name)
      );
      setUploadedFile({
        name: file.name,
        words: data.wordCount ?? wordCount(extracted),
        truncated: Boolean(data.truncated),
      });
      setError("");
    } catch (err) {
      setUploadError(
        err instanceof Error ? err.message : "Something went wrong reading that file."
      );
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function sendMessage(preset?: string) {
    const text = (preset ?? message).trim();

    if (!assignment || !text || chatLoading) return;

    if (text.length > MAX_MESSAGE_CHARS) {
      setChatError(
        `That message is too long. Please keep it under ${MAX_MESSAGE_CHARS.toLocaleString()} characters.`
      );
      return;
    }

    const workSent = studentWork;

    setMessage("");
    setChatError("");
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setChatLoading(true);

    try {
      const token = await getToken();

      if (!token) {
        throw new Error("Please sign in again.");
      }

      const response = await fetch("/api/assignments/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          assignmentId: assignment.id,
          message: text,
          mode,
          studentWork: workSent,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || data.error || "The coach couldn't reply this time.");
      }

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: data.response,
          sources: Array.isArray(data.sources) ? data.sources : [],
        },
      ]);
      setWorkTruncated(Boolean(data.workTruncated));

      // The server saves the draft that was sent along with the message.
      if (workSent.length <= MAX_WORK_CHARS) {
        lastSavedWork.current = workSent;
        setSaveState(studentWorkRef.current === workSent ? "saved" : "unsaved");
      }
    } catch (err) {
      // Take the message back out of the thread and put it back in the box,
      // so nothing the student typed is lost.
      setMessages((prev) => prev.slice(0, -1));
      setMessage(text);
      setChatError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setChatLoading(false);
    }
  }

  function askCoach(text: string) {
    setTab("coach");
    setMessage(text);
    setTimeout(() => messageInputRef.current?.focus(), 50);
  }

  function reviewMyWork() {
    setMode("review");
    setTab("coach");
    void sendMessage("Please review my work so far.");
  }

  function toggleRequirement(index: number) {
    if (!assignment) return;
    const next = { ...checked, [index]: !checked[index] };
    setChecked(next);
    writeChecklist(assignment.id, next);
  }

  async function changeStatus(next: AssignmentStatus) {
    if (!assignment) return;
    setBusyAction(true);

    const { error: statusError } = await supabase
      .from("assignments")
      .update({ status: next })
      .eq("id", assignment.id);

    setBusyAction(false);

    if (statusError) {
      console.error("Error updating status:", statusError);
      setError("Couldn't update the assignment. Please try again.");
      return;
    }

    const updated = { ...assignment, status: next };
    setAssignment(updated);
    setAssignments((prev) =>
      prev.map((item) => (item.id === updated.id ? updated : item))
    );
  }

  async function deleteAssignment() {
    if (!assignment) return;
    setBusyAction(true);

    const { error: deleteError } = await supabase
      .from("assignments")
      .delete()
      .eq("id", assignment.id);

    setBusyAction(false);

    if (deleteError) {
      console.error("Error deleting assignment:", deleteError);
      setError("Couldn't delete the assignment. Please try again.");
      return;
    }

    setAssignments((prev) => prev.filter((item) => item.id !== assignment.id));
    window.localStorage.removeItem(checklistKey(assignment.id));
    activeIdRef.current = null;
    setAssignment(null);
    setConfirmDelete(false);
    setMessages([]);
  }

  // -------------------------------------------------------------------------
  // List view
  // -------------------------------------------------------------------------
  if (!assignment) {
    const visible = assignments.filter((item) => item.status === listFilter);
    const activeCount = assignments.filter((a) => a.status === "active").length;
    const completedCount = assignments.filter((a) => a.status === "completed").length;

    return (
      <div className="flex min-h-screen bg-slate-50 font-sans">
        <DesktopSidebar />

        <div className="flex min-w-0 flex-1 flex-col">
          <div id="app" className="flex flex-1 flex-col pb-20 lg:pb-0">
            <AppHeader title="Assignment Coach" />

            <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 lg:px-8 lg:py-8">
              <p className="mb-6 max-w-2xl text-slate-600">
                Understand what your assignment is asking, plan your own answer and
                get feedback on your own writing, without the AI doing the work for
                you.
              </p>

              <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
                {/* New assignment */}
                <section
                  aria-labelledby="new-assignment-heading"
                  className="order-2 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6 lg:order-1"
                >
                  <h2
                    id="new-assignment-heading"
                    className="text-xl font-semibold text-slate-900"
                  >
                    Start an assignment
                  </h2>
                  <p className="mt-1 text-sm text-slate-600">
                    Paste the question and instructions exactly as your lecturer gave
                    them. Include marks, word count and referencing style if they are
                    stated.
                  </p>

                  <div className="mt-5 grid gap-5">
                    <div>
                      <label
                        htmlFor="assignment-title"
                        className="mb-1.5 block text-sm font-medium text-slate-700"
                      >
                        Title <span className="font-normal text-slate-400">(optional)</span>
                      </label>
                      <input
                        id="assignment-title"
                        value={title}
                        maxLength={150}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="e.g. Assignment 2: Contract law"
                        className={`w-full rounded-lg border border-slate-300 bg-white p-3 ${focusRing}`}
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="assignment-module"
                        className="mb-1.5 block text-sm font-medium text-slate-700"
                      >
                        Module <span className="font-normal text-slate-400">(optional)</span>
                      </label>
                      <select
                        id="assignment-module"
                        value={selectedModule}
                        onChange={(e) => setSelectedModule(e.target.value)}
                        className={`w-full rounded-lg border border-slate-300 bg-white p-3 ${focusRing}`}
                      >
                        <option value="">No module</option>
                        {modules.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.name}
                          </option>
                        ))}
                      </select>
                      <p className="mt-1.5 text-xs text-slate-500">
                        {modules.length === 0 ? (
                          <>
                            You don&apos;t have any modules yet. Create one under{" "}
                            <Link href="/lectures" className="text-indigo-600 underline">
                              Lectures
                            </Link>{" "}
                            to link it here.
                          </>
                        ) : (
                          "Linking a module lets the coach point you to your own lectures and uploaded study material."
                        )}
                      </p>
                    </div>

                    <div>
                      <label
                        htmlFor="assignment-brief"
                        className="mb-1.5 block text-sm font-medium text-slate-700"
                      >
                        Assignment instructions
                      </label>

                      <input
                        ref={fileInputRef}
                        type="file"
                        accept={ACCEPTED_EXTENSIONS.join(",")}
                        className="sr-only"
                        tabIndex={-1}
                        aria-hidden="true"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) void handleFile(file);
                        }}
                      />

                      <div
                        onDragOver={(e) => {
                          e.preventDefault();
                          setDragActive(true);
                        }}
                        onDragLeave={() => setDragActive(false)}
                        onDrop={(e) => {
                          e.preventDefault();
                          setDragActive(false);
                          const file = e.dataTransfer.files?.[0];
                          if (file) void handleFile(file);
                        }}
                        className={`mb-3 flex flex-col items-start gap-3 rounded-xl border-2 border-dashed p-4 sm:flex-row sm:items-center ${
                          dragActive
                            ? "border-indigo-500 bg-indigo-50"
                            : "border-slate-300 bg-slate-50"
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-slate-800">
                            Have the assignment as a file?
                          </p>
                          <p className="mt-0.5 text-xs leading-5 text-slate-500">
                            Upload a PDF, Word, PowerPoint or text file (up to 4 MB) and we&apos;ll
                            read the text for you. You can check and edit it before continuing.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          disabled={uploading}
                          className={`flex shrink-0 items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 ${focusRing}`}
                        >
                          {uploading && <Spinner />}
                          {uploading ? "Reading file..." : "Choose file"}
                        </button>
                      </div>

                      {uploadError && (
                        <div
                          role="alert"
                          className="mb-3 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700"
                        >
                          {uploadError}
                        </div>
                      )}

                      {uploadedFile && (
                        <div
                          role="status"
                          className="mb-3 flex items-start justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800"
                        >
                          <p className="min-w-0">
                            <span className="font-medium break-words">
                              Loaded from {uploadedFile.name}
                            </span>{" "}
                            ({uploadedFile.words.toLocaleString()} words).{" "}
                            {uploadedFile.truncated
                              ? "The file was very long, so only the first part was read. "
                              : ""}
                            Remove anything that isn&apos;t part of the question, like cover pages.
                          </p>
                          <button
                            type="button"
                            onClick={() => setUploadedFile(null)}
                            aria-label="Dismiss"
                            className={`shrink-0 rounded px-1 text-emerald-700 hover:bg-emerald-100 ${focusRing}`}
                          >
                            ×
                          </button>
                        </div>
                      )}

                      <textarea
                        id="assignment-brief"
                        value={brief}
                        onChange={(e) => {
                          setBrief(e.target.value);
                          if (!e.target.value.trim()) setUploadedFile(null);
                        }}
                        placeholder="Paste your assignment question and instructions here..."
                        rows={10}
                        className={`w-full resize-y rounded-lg border bg-white p-4 ${
                          brief.length > MAX_BRIEF_CHARS
                            ? "border-red-400"
                            : "border-slate-300"
                        } ${focusRing}`}
                      />
                      <div className="mt-1.5 flex justify-between text-xs text-slate-500">
                        <span>Paste the instructions only, not your own answer.</span>
                        <span
                          className={brief.length > MAX_BRIEF_CHARS ? "font-medium text-red-600" : ""}
                        >
                          {brief.length.toLocaleString()} / {MAX_BRIEF_CHARS.toLocaleString()}
                        </span>
                      </div>

                      {brief.length > MAX_BRIEF_CHARS && (
                        <div
                          role="alert"
                          className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900"
                        >
                          <p>
                            This is {(brief.length - MAX_BRIEF_CHARS).toLocaleString()} characters
                            over the limit. Delete what isn&apos;t needed (cover pages, rubrics and
                            admin notes are common), or keep only the first{" "}
                            {MAX_BRIEF_CHARS.toLocaleString()} characters.
                          </p>
                          <button
                            type="button"
                            onClick={() => setBrief((previous) => previous.slice(0, MAX_BRIEF_CHARS))}
                            className={`mt-2 rounded-md border border-amber-400 bg-white px-3 py-1.5 font-medium hover:bg-amber-100 ${focusRing}`}
                          >
                            Keep the first {MAX_BRIEF_CHARS.toLocaleString()} characters
                          </button>
                        </div>
                      )}
                    </div>

                    {error && (
                      <div
                        role="alert"
                        className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700"
                      >
                        {error}{" "}
                        {/Premium/.test(error) && (
                          <Link href="/pricing" className="font-medium underline">
                            See plans
                          </Link>
                        )}
                      </div>
                    )}

                    <button
                      onClick={analyzeAssignment}
                      disabled={loading || !brief.trim() || brief.length > MAX_BRIEF_CHARS}
                      className={`flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-indigo-600 to-purple-600 px-5 py-3 font-semibold text-white transition-all hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50 ${focusRing}`}
                    >
                      {loading && <Spinner />}
                      {loading
                        ? "Reading your assignment (about 10 to 20 seconds)..."
                        : "Break down my assignment"}
                    </button>
                  </div>
                </section>

                {/* My assignments */}
                <section
                  aria-labelledby="my-assignments-heading"
                  className="order-1 lg:order-2 lg:sticky lg:top-24"
                >
                  <div className="mb-3 flex items-center justify-between">
                    <h2
                      id="my-assignments-heading"
                      className="text-lg font-semibold text-slate-900"
                    >
                      My assignments
                    </h2>
                    <div
                      role="tablist"
                      aria-label="Filter assignments"
                      className="flex rounded-lg border border-slate-200 bg-white p-0.5 text-sm"
                    >
                      {(
                        [
                          ["active", `In progress (${activeCount})`],
                          ["completed", `Done (${completedCount})`],
                        ] as const
                      ).map(([id, label]) => (
                        <button
                          key={id}
                          role="tab"
                          aria-selected={listFilter === id}
                          onClick={() => setListFilter(id)}
                          className={`rounded-md px-3 py-1.5 ${focusRing} ${
                            listFilter === id
                              ? "bg-indigo-600 text-white"
                              : "text-slate-600 hover:bg-slate-50"
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {assignmentsLoading ? (
                    <div className="grid gap-3" aria-busy="true">
                      {[0, 1, 2].map((i) => (
                        <div
                          key={i}
                          className="h-20 animate-pulse rounded-xl border border-slate-200 bg-white"
                        />
                      ))}
                    </div>
                  ) : visible.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center">
                      <p className="font-medium text-slate-800">
                        {listFilter === "active"
                          ? "No assignments in progress"
                          : "Nothing marked as done yet"}
                      </p>
                      <p className="mt-1 text-sm text-slate-500">
                        {listFilter === "active"
                          ? "Paste an assignment to get started."
                          : "Finished assignments show up here."}
                      </p>
                    </div>
                  ) : (
                    <ul className="grid gap-3">
                      {visible.map((item) => {
                        const words = wordCount(item.student_work || "");
                        const label = moduleLabel(item);

                        return (
                          <li key={item.id}>
                            <button
                              onClick={() => openAssignment(item)}
                              className={`w-full rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-indigo-300 hover:shadow ${focusRing}`}
                            >
                              <div className="font-semibold text-slate-800">{item.title}</div>
                              <div className="mt-0.5 text-sm text-slate-500">
                                {label || "No module"}
                              </div>
                              <div className="mt-2 flex items-center gap-3 text-xs text-slate-500">
                                <span>{formatDate(item.updated_at || item.created_at)}</span>
                                <span aria-hidden="true">·</span>
                                <span>
                                  {words > 0 ? `${words.toLocaleString()} words written` : "Draft not started"}
                                </span>
                              </div>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </section>
              </div>
            </main>

            <BottomNav />
          </div>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Assignment workspace
  // -------------------------------------------------------------------------
  const analysis: Analysis = assignment.analysis || {};
  const requirements = analysis.requirements || [];
  const doneCount = requirements.filter((_, i) => checked[i]).length;
  const activeMode = modes.find((item) => item.id === mode) || modes[0];
  const words = wordCount(studentWork);
  const label = moduleLabel(assignment);

  const saveText: Record<SaveState, string> = {
    idle: "",
    unsaved: "Unsaved changes",
    saving: "Saving...",
    saved: "Saved",
    error: "Couldn't save",
  };

  const leftTab: Tab = tab === "work" ? "work" : "breakdown";

  return (
    <div className="flex min-h-screen bg-slate-50 font-sans">
      <DesktopSidebar />

      <div className="flex min-w-0 flex-1 flex-col">
        <div id="app" className="flex flex-1 flex-col pb-20 lg:pb-0">
          <AppHeader
            title={assignment.title}
            subtitle={[label, formatDate(assignment.created_at)].filter(Boolean).join(" · ")}
            onBack={backToList}
            badge={
              assignment.status === "completed" ? (
                <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700">
                  Completed
                </span>
              ) : (
                <span className="hidden rounded-full border border-slate-300 bg-slate-50 px-3 py-1 text-xs text-slate-700 sm:inline-block">
                  Your work stays yours
                </span>
              )
            }
          />

          {/* Tabs */}
          <div className="sticky top-[57px] z-[9] border-b border-slate-200 bg-white/95 backdrop-blur lg:top-[81px]">
            <div
              role="tablist"
              aria-label="Assignment sections"
              className="mx-auto flex w-full max-w-6xl gap-1 px-4 py-2 lg:px-8"
            >
              {(
                [
                  ["breakdown", "Breakdown", ""],
                  ["work", "My work", ""],
                  ["coach", "Coach", "lg:hidden"],
                ] as const
              ).map(([id, text, extra]) => {
                const selected = id === "coach" ? tab === "coach" : leftTab === id && tab !== "coach";
                return (
                  <button
                    key={id}
                    role="tab"
                    aria-selected={selected}
                    onClick={() => setTab(id)}
                    className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium lg:flex-none ${extra} ${focusRing} ${
                      selected
                        ? "bg-indigo-600 text-white"
                        : "text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    {text}
                  </button>
                );
              })}
            </div>
          </div>

          <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-5 lg:px-8 lg:py-6">
            <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,440px)] lg:items-start lg:gap-6">
              {/* Left column: breakdown or work */}
              <div className={tab === "coach" ? "hidden lg:block" : "block"}>
                {leftTab === "breakdown" ? (
                  <div className="space-y-4">
                    <Card title="What your assignment is asking">
                      <p className="leading-7 text-slate-700">
                        {analysis.what_the_question_is_asking || "Analysis unavailable."}
                      </p>
                    </Card>

                    {!!analysis.command_words?.length && (
                      <Card title="Command words" subtitle="These tell you what kind of answer is expected.">
                        <dl className="grid gap-3 sm:grid-cols-2">
                          {analysis.command_words.map((item, index) => {
                            const { word, meaning } = splitCommandWord(item);
                            return (
                              <div
                                key={index}
                                className="rounded-lg border border-slate-200 bg-slate-50 p-3"
                              >
                                <dt className="font-semibold text-indigo-700">{word}</dt>
                                {meaning && (
                                  <dd className="mt-0.5 text-sm leading-6 text-slate-600">{meaning}</dd>
                                )}
                              </div>
                            );
                          })}
                        </dl>
                      </Card>
                    )}

                    <Card
                      title="Requirements checklist"
                      subtitle={
                        requirements.length
                          ? `${doneCount} of ${requirements.length} covered. Tick them off as you go.`
                          : undefined
                      }
                    >
                      {requirements.length ? (
                        <>
                          <div
                            className="mb-4 h-2 overflow-hidden rounded-full bg-slate-100"
                            role="progressbar"
                            aria-valuenow={doneCount}
                            aria-valuemin={0}
                            aria-valuemax={requirements.length}
                            aria-label="Requirements covered"
                          >
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all"
                              style={{ width: `${(doneCount / requirements.length) * 100}%` }}
                            />
                          </div>
                          <ul className="space-y-2">
                            {requirements.map((item, index) => (
                              <li key={index}>
                                <label className="flex cursor-pointer items-start gap-3 rounded-lg p-2 hover:bg-slate-50">
                                  <input
                                    type="checkbox"
                                    checked={!!checked[index]}
                                    onChange={() => toggleRequirement(index)}
                                    className="mt-1 h-4 w-4 shrink-0 accent-indigo-600"
                                  />
                                  <span
                                    className={`text-sm leading-6 ${
                                      checked[index] ? "text-slate-400 line-through" : "text-slate-700"
                                    }`}
                                  >
                                    {item}
                                  </span>
                                </label>
                              </li>
                            ))}
                          </ul>
                        </>
                      ) : (
                        <EmptyList />
                      )}
                    </Card>

                    {!!analysis.key_concepts?.length && (
                      <Card title="Key concepts to understand">
                        <ul className="flex flex-wrap gap-2">
                          {analysis.key_concepts.map((item, index) => (
                            <li
                              key={index}
                              className="rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-sm text-indigo-800"
                            >
                              {item}
                            </li>
                          ))}
                        </ul>
                      </Card>
                    )}

                    <Card title="Recommended approach">
                      {analysis.recommended_approach?.length ? (
                        <ol className="space-y-3">
                          {analysis.recommended_approach.map((item, index) => (
                            <li key={index} className="flex gap-3">
                              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-semibold text-indigo-700">
                                {index + 1}
                              </span>
                              <span className="text-sm leading-6 text-slate-700">{item}</span>
                            </li>
                          ))}
                        </ol>
                      ) : (
                        <EmptyList />
                      )}
                    </Card>

                    {!!analysis.questions_for_the_student?.length && (
                      <Card
                        title="Questions to think about"
                        subtitle="Tap one to talk it through with the coach."
                      >
                        <ul className="space-y-2">
                          {analysis.questions_for_the_student.map((item, index) => (
                            <li key={index}>
                              <button
                                onClick={() => askCoach(item)}
                                className={`w-full rounded-lg border border-slate-200 p-3 text-left text-sm leading-6 text-slate-700 hover:border-indigo-300 hover:bg-indigo-50 ${focusRing}`}
                              >
                                {item}
                                <span className="mt-1 block text-xs font-medium text-indigo-600">
                                  Discuss with coach →
                                </span>
                              </button>
                            </li>
                          ))}
                        </ul>
                      </Card>
                    )}

                    <Collapsible title="Common mistakes" items={analysis.common_mistakes} />
                    <Collapsible title="Self-check before you submit" items={analysis.self_check} />

                    <details className="group rounded-2xl border border-slate-200 bg-white shadow-sm">
                      <summary className={`cursor-pointer list-none rounded-2xl p-5 font-semibold text-slate-900 ${focusRing}`}>
                        Original instructions
                      </summary>
                      <p className="whitespace-pre-wrap px-5 pb-5 text-sm leading-6 text-slate-600">
                        {assignment.assignment_brief}
                      </p>
                    </details>

                    <Card title="Assignment settings">
                      {error && (
                        <div role="alert" className="mb-3 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700">
                          {error}
                        </div>
                      )}
                      <div className="flex flex-wrap items-center gap-3">
                        <button
                          onClick={() =>
                            changeStatus(assignment.status === "completed" ? "active" : "completed")
                          }
                          disabled={busyAction}
                          className={`rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 ${focusRing}`}
                        >
                          {assignment.status === "completed" ? "Reopen assignment" : "Mark as completed"}
                        </button>

                        {confirmDelete ? (
                          <div className="flex items-center gap-2 text-sm">
                            <span className="text-slate-700">Delete this assignment and its chat?</span>
                            <button
                              onClick={deleteAssignment}
                              disabled={busyAction}
                              className={`rounded-lg bg-red-600 px-3 py-2 font-medium text-white hover:bg-red-700 disabled:opacity-50 ${focusRing}`}
                            >
                              Delete
                            </button>
                            <button
                              onClick={() => setConfirmDelete(false)}
                              className={`rounded-lg px-3 py-2 text-slate-600 hover:bg-slate-100 ${focusRing}`}
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setConfirmDelete(true)}
                            className={`rounded-lg px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 ${focusRing}`}
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </Card>
                  </div>
                ) : (
                  <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h2 className="text-lg font-semibold text-slate-900">My work</h2>
                        <p className="mt-1 text-sm text-slate-600">
                          Write your own answer, outline, calculations or notes here. The coach
                          can give you feedback on it, but it will never rewrite it.
                        </p>
                      </div>
                      <button
                        onClick={reviewMyWork}
                        disabled={!studentWork.trim() || chatLoading}
                        className={`rounded-lg bg-gradient-to-r from-indigo-600 to-purple-600 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50 ${focusRing}`}
                      >
                        Ask coach to review
                      </button>
                    </div>

                    <textarea
                      value={studentWork}
                      onChange={(e) => setStudentWork(e.target.value)}
                      maxLength={MAX_WORK_CHARS}
                      aria-label="Your work"
                      placeholder="Start writing your own work..."
                      className={`mt-4 min-h-[50vh] w-full resize-y rounded-lg border border-slate-300 bg-white p-4 leading-7 ${focusRing}`}
                    />

                    <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
                      <span>{words.toLocaleString()} words</span>
                      <span role="status" aria-live="polite">
                        {saveState === "error" ? (
                          <button
                            onClick={() => void saveWork(assignment.id, studentWork)}
                            className="font-medium text-red-600 underline"
                          >
                            Couldn&apos;t save. Retry
                          </button>
                        ) : (
                          <span className={saveState === "saved" ? "text-emerald-600" : ""}>
                            {saveText[saveState]}
                          </span>
                        )}
                      </span>
                    </div>
                  </section>
                )}
              </div>

              {/* Right column: coach */}
              <section
                aria-label="Assignment Coach"
                className={`flex h-[calc(100dvh-17rem)] min-h-[420px] flex-col rounded-2xl border border-slate-200 bg-white shadow-sm lg:sticky lg:top-[11rem] lg:h-[calc(100vh-13rem)] ${
                  tab === "coach" ? "flex" : "hidden lg:flex"
                }`}
              >
                <div className="border-b border-slate-200 p-4">
                  <div className="flex items-center justify-between">
                    <h2 className="font-semibold text-slate-900">Assignment Coach</h2>
                    <span className="text-xs text-slate-500">Guides, never writes</span>
                  </div>

                  <div
                    role="group"
                    aria-label="Coaching mode"
                    className="-mx-1 mt-3 flex gap-2 overflow-x-auto px-1 pb-1"
                  >
                    {modes.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => setMode(item.id)}
                        aria-pressed={mode === item.id}
                        className={`shrink-0 rounded-full border px-3 py-1.5 text-sm ${focusRing} ${
                          mode === item.id
                            ? "border-transparent bg-gradient-to-r from-indigo-600 to-purple-600 text-white"
                            : "border-slate-300 text-slate-700 hover:bg-slate-50"
                        }`}
                      >
                        {item.title}
                      </button>
                    ))}
                  </div>
                  <p className="mt-2 text-xs text-slate-500">{activeMode.description}</p>
                </div>

                <div
                  ref={chatScrollRef}
                  role="log"
                  aria-live="polite"
                  className="flex-1 space-y-4 overflow-y-auto p-4"
                >
                  {messagesLoading ? (
                    <div className="space-y-3" aria-busy="true">
                      <div className="h-12 w-3/4 animate-pulse rounded-xl bg-slate-100" />
                      <div className="ml-auto h-10 w-1/2 animate-pulse rounded-xl bg-slate-100" />
                    </div>
                  ) : messages.length === 0 ? (
                    <div className="rounded-xl bg-slate-50 p-4">
                      <p className="font-medium text-slate-800">Ready when you are.</p>
                      <p className="mt-1 text-sm leading-6 text-slate-600">
                        I won&apos;t write your assignment, but I can help you understand it,
                        plan it, explore ideas and give feedback on your own writing. Pick a
                        mode above, or start with one of these:
                      </p>
                      <div className="mt-3 flex flex-col gap-2">
                        {activeMode.starters.map((starter) => (
                          <button
                            key={starter}
                            onClick={() => void sendMessage(starter)}
                            disabled={chatLoading}
                            className={`rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-sm text-slate-700 hover:border-indigo-300 hover:bg-indigo-50 disabled:opacity-50 ${focusRing}`}
                          >
                            {starter}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    messages.map((item, index) => (
                      <div
                        key={index}
                        className={item.role === "user" ? "flex justify-end" : "flex"}
                      >
                        <div
                          className={`max-w-[92%] break-words rounded-2xl px-4 py-3 text-sm leading-6 [overflow-wrap:anywhere] ${
                            item.role === "user"
                              ? "whitespace-pre-wrap rounded-br-sm bg-gradient-to-r from-indigo-600 to-purple-600 text-white"
                              : "rounded-bl-sm bg-slate-100 text-slate-800"
                          }`}
                        >
                          {item.role === "user" ? (
                            item.content
                          ) : (
                            <>
                              <ReactMarkdown
                                remarkPlugins={[remarkGfm]}
                                components={markdownComponents}
                              >
                                {item.content}
                              </ReactMarkdown>
                              {!!item.sources?.length && (
                                <div className="mt-3 border-t border-slate-200 pt-2">
                                  <p className="mb-1 text-xs font-medium text-slate-500">
                                    Course material in context
                                  </p>
                                  <div className="flex flex-wrap gap-1.5">
                                    {item.sources.slice(0, 4).map((source, i) => (
                                      <span
                                        key={i}
                                        className="rounded-full bg-white px-2 py-0.5 text-xs text-slate-600 ring-1 ring-slate-200"
                                      >
                                        {source.type === "lecture" ? "Lecture: " : "Upload: "}
                                        {source.label}
                                      </span>
                                    ))}
                                    {item.sources.length > 4 && (
                                      <span className="px-1 text-xs text-slate-500">
                                        +{item.sources.length - 4} more
                                      </span>
                                    )}
                                  </div>
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    ))
                  )}

                  {chatLoading && (
                    <div className="flex">
                      <div className="flex items-center gap-1.5 rounded-2xl rounded-bl-sm bg-slate-100 px-4 py-3">
                        <span className="sr-only">The coach is thinking</span>
                        {[0, 150, 300].map((delay) => (
                          <span
                            key={delay}
                            aria-hidden="true"
                            className="h-2 w-2 animate-bounce rounded-full bg-slate-400"
                            style={{ animationDelay: `${delay}ms` }}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {workTruncated && (
                  <p className="mx-4 mb-2 rounded-lg bg-amber-50 p-2 text-xs text-amber-800">
                    Your draft is long, so the coach only read the first part of it.
                  </p>
                )}

                {chatError && (
                  <div
                    role="alert"
                    className="mx-4 mb-2 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700"
                  >
                    {chatError}{" "}
                    {/Premium/.test(chatError) ? (
                      <Link href="/pricing" className="font-medium underline">
                        See plans
                      </Link>
                    ) : (
                      "Your message is back in the box."
                    )}
                  </div>
                )}

                <div className="border-t border-slate-200 p-3">
                  <div className="flex gap-2">
                    <textarea
                      ref={messageInputRef}
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          void sendMessage();
                        }
                      }}
                      aria-label="Message to the coach"
                      placeholder={activeMode.placeholder}
                      rows={2}
                      className={`flex-1 resize-none rounded-lg border bg-white p-3 text-sm ${
                        message.length > MAX_MESSAGE_CHARS ? "border-red-400" : "border-slate-300"
                      } ${focusRing}`}
                    />
                    <button
                      onClick={() => void sendMessage()}
                      disabled={
                        chatLoading || !message.trim() || message.length > MAX_MESSAGE_CHARS
                      }
                      className={`self-end rounded-lg bg-gradient-to-r from-indigo-600 to-purple-600 px-4 py-3 text-sm font-semibold text-white transition-all hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50 ${focusRing}`}
                    >
                      Send
                    </button>
                  </div>
                  <p className="mt-1.5 flex justify-between text-xs text-slate-500">
                    <span>Enter to send · Shift + Enter for a new line</span>
                    {message.length > MAX_MESSAGE_CHARS - 500 && (
                      <span className={message.length > MAX_MESSAGE_CHARS ? "font-medium text-red-600" : ""}>
                        {message.length.toLocaleString()} / {MAX_MESSAGE_CHARS.toLocaleString()}
                      </span>
                    )}
                  </p>
                </div>
              </section>
            </div>
          </main>

          <BottomNav />
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Small components
// ---------------------------------------------------------------------------
function AppHeader({
  title,
  subtitle,
  onBack,
  badge,
}: {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  badge?: React.ReactNode;
}) {
  return (
    <header className="sticky top-0 z-10 border-b border-slate-200 bg-white px-4 py-3 lg:px-8 lg:py-4">
      <div className="mx-auto flex w-full max-w-6xl items-center gap-3">
        {onBack && (
          <button
            onClick={onBack}
            aria-label="Back to all assignments"
            className={`rounded-lg p-1.5 text-slate-600 hover:bg-slate-100 ${focusRing}`}
          >
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        )}
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg lg:hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img alt="" className="h-6 w-6 object-contain" src="/assets/images/icon-white-removebg.png" />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-semibold text-slate-900 lg:text-2xl">{title}</h1>
          {subtitle && <p className="truncate text-xs text-slate-500 lg:text-sm">{subtitle}</p>}
        </div>
        {badge}
      </div>
    </header>
  );
}

function Card({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
      {subtitle && <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>}
      <div className="mt-3">{children}</div>
    </section>
  );
}

function Collapsible({ title, items }: { title: string; items?: string[] }) {
  if (!items?.length) return null;

  return (
    <details className="group rounded-2xl border border-slate-200 bg-white shadow-sm">
      <summary className={`cursor-pointer list-none rounded-2xl p-5 font-semibold text-slate-900 ${focusRing}`}>
        {title}
        <span className="ml-2 text-sm font-normal text-slate-400">({items.length})</span>
      </summary>
      <ul className="space-y-2 px-5 pb-5">
        {items.map((item, index) => (
          <li key={index} className="flex gap-2 text-sm leading-6 text-slate-700">
            <span className="text-slate-400" aria-hidden="true">•</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </details>
  );
}

function EmptyList() {
  return <p className="text-sm text-slate-500">Nothing identified yet.</p>;
}

function Spinner() {
  return (
    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  );
}

function BottomNav() {
  return (
    <nav
      aria-label="Main"
      className="safe-area-inset-bottom fixed bottom-0 left-0 right-0 z-10 border-t border-slate-200 bg-white lg:hidden"
    >
      <div className="mx-auto w-full max-w-[430px] md:max-w-[680px] lg:max-w-[800px]">
        <div className="flex items-center justify-around py-2">
          <Link href="/dashboard" className="flex flex-col items-center px-4 py-2 text-slate-400 hover:text-slate-600">
            <svg className="mb-1 h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            <span className="text-xs font-medium">Home</span>
          </Link>
          <Link href="/lectures" className="flex flex-col items-center px-4 py-2 text-slate-400 hover:text-slate-600">
            <svg className="mb-1 h-6 w-6" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
              <path d="M7 3a1 1 0 000 2h6a1 1 0 100-2H7zM4 7a1 1 0 011-1h10a1 1 0 110 2H5a1 1 0 01-1-1zM2 11a2 2 0 012-2h12a2 2 0 012 2v4a2 2 0 01-2 2H4a2 2 0 01-2-2v-4z" />
            </svg>
            <span className="text-xs font-medium">Lectures</span>
          </Link>
          <Link href="/assignments" aria-current="page" className="flex flex-col items-center px-4 py-2 text-indigo-600">
            <svg className="mb-1 h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
            </svg>
            <span className="text-xs font-medium">Assignments</span>
          </Link>
          <Link href="/settings" className="flex flex-col items-center px-4 py-2 text-slate-400 hover:text-slate-600">
            <svg className="mb-1 h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span className="text-xs font-medium">Settings</span>
          </Link>
        </div>
      </div>
    </nav>
  );
}
