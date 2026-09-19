'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { getAccessToken } from '@/lib/supabase/auth';
import DesktopSidebar from '@/components/DesktopSidebar';
import Link from 'next/link';

interface Assignment {
  id: string;
  title: string;
  brief: string;
  analysis: any;
  student_work: string;
  status: string;
  module_id?: string | null;
  updated_at: string;
}

interface Message {
  id?: string;
  role: 'user' | 'assistant';
  content: string;
  mode?: string;
}

const modes = [
  { id: 'understand', label: 'Understand', description: 'Break down the question and rubric.' },
  { id: 'plan', label: 'Plan', description: 'Build your own step-by-step approach.' },
  { id: 'coach', label: 'Coach me', description: 'Work through concepts with hints and questions.' },
  { id: 'review', label: 'Review my work', description: 'Get feedback on what you have written.' },
];

function listValue(value: any): string[] {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

export default function AssignmentsPage() {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [selected, setSelected] = useState<Assignment | null>(null);
  const [modules, setModules] = useState<any[]>([]);
  const [showNew, setShowNew] = useState(false);
  const [title, setTitle] = useState('');
  const [brief, setBrief] = useState('');
  const [moduleId, setModuleId] = useState('');
  const [studentWork, setStudentWork] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [message, setMessage] = useState('');
  const [mode, setMode] = useState('understand');
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [sending, setSending] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const selectedModuleName = useMemo(() => {
    const module = modules.find((m) => m.id === selected?.module_id);
    return module?.name || '';
  }, [modules, selected]);

  const authHeaders = async () => {
    const token = await getAccessToken();
    if (!token) throw new Error('Please log in again.');
    return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  };

  const loadAssignments = async () => {
    const headers = await authHeaders();
    const response = await fetch('/api/assignments', { headers });
    if (!response.ok) throw new Error('Could not load assignments.');
    const data = await response.json();
    setAssignments(data.assignments || []);
    return data.assignments || [];
  };

  useEffect(() => {
    (async () => {
      try {
        const headers = await authHeaders();
        const [assignmentResponse, moduleResponse] = await Promise.all([
          fetch('/api/assignments', { headers }),
          fetch('/api/modules', { headers }),
        ]);
        if (!assignmentResponse.ok) throw new Error('Could not load assignments.');
        const assignmentData = await assignmentResponse.json();
        setAssignments(assignmentData.assignments || []);
        if (moduleResponse.ok) setModules(await moduleResponse.json());
        if (assignmentData.assignments?.length) setSelected(assignmentData.assignments[0]);
      } catch (err: any) {
        setError(err.message || 'Something went wrong.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!selected) return;
    setStudentWork(selected.student_work || '');
    setMessages([]);
    (async () => {
      try {
        const headers = await authHeaders();
        const response = await fetch(`/api/assignments/messages?assignment_id=${encodeURIComponent(selected.id)}`, { headers });
        if (response.ok) {
          const data = await response.json();
          setMessages(data.messages || []);
        }
      } catch (err) {
        console.error(err);
      }
    })();
  }, [selected?.id]);

  const createAssignment = async (event: React.FormEvent) => {
    event.preventDefault();
    if (brief.trim().length < 20) {
      setError('Paste the full assignment brief/question so the coach can understand the task.');
      return;
    }
    setCreating(true);
    setError('');
    try {
      const headers = await authHeaders();
      const response = await fetch('/api/assignments', {
        method: 'POST',
        headers,
        body: JSON.stringify({ title, brief, module_id: moduleId || null }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not create assignment.');
      setAssignments((current) => [data.assignment, ...current]);
      setSelected(data.assignment);
      setShowNew(false);
      setTitle('');
      setBrief('');
      setModuleId('');
    } catch (err: any) {
      setError(err.message || 'Could not create assignment.');
    } finally {
      setCreating(false);
    }
  };

  const saveWork = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      const headers = await authHeaders();
      const response = await fetch('/api/assignments', {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ id: selected.id, student_work: studentWork }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not save your work.');
      setSelected(data.assignment);
      setAssignments((current) => current.map((a) => a.id === data.assignment.id ? data.assignment : a));
    } catch (err: any) {
      setError(err.message || 'Could not save your work.');
    } finally {
      setSaving(false);
    }
  };

  const sendMessage = async () => {
    if (!selected || !message.trim() || sending) return;
    const text = message.trim();
    setMessage('');
    setMessages((current) => [...current, { role: 'user', content: text, mode }]);
    setSending(true);
    setError('');
    try {
      // Save the latest draft before asking the coach to review it.
      if (mode === 'review') await saveWork();
      const headers = await authHeaders();
      const response = await fetch('/api/assignments/chat', {
        method: 'POST',
        headers,
        body: JSON.stringify({ assignment_id: selected.id, message: text, mode }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'The assignment coach could not respond.');
      setMessages((current) => [...current, { role: 'assistant', content: data.response, mode }]);
    } catch (err: any) {
      setError(err.message || 'The assignment coach could not respond.');
    } finally {
      setSending(false);
    }
  };

  const analysis = selected?.analysis || {};

  return (
    <div className="min-h-screen bg-slate-50 flex">
      <DesktopSidebar />
      <main className="flex-1 min-w-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div>
              <div className="flex items-center gap-2 text-sm text-slate-500 mb-2">
                <Link href="/dashboard" className="hover:text-indigo-600">Dashboard</Link>
                <span>/</span>
                <span>Assignments</span>
              </div>
              <h1 className="text-3xl font-bold text-slate-900">Assignment Coach</h1>
              <p className="text-slate-600 mt-1">Understand the task, build your own answer, and get feedback — without AI writing it for you.</p>
            </div>
            <button onClick={() => setShowNew(true)} className="px-5 py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold shadow-sm hover:shadow-lg transition-all">
              + New Assignment
            </button>
          </div>

          <div className="mb-6 rounded-2xl border border-indigo-100 bg-gradient-to-r from-indigo-50 to-purple-50 p-4 flex gap-3">
            <div className="w-9 h-9 rounded-full bg-white flex items-center justify-center text-indigo-600 font-bold">✓</div>
            <div>
              <p className="font-semibold text-slate-900">Built for learning, not ghostwriting</p>
              <p className="text-sm text-slate-600">Universite will explain concepts, ask guiding questions, help you plan, and critique your work. It will not produce a submission-ready assignment.</p>
            </div>
          </div>

          {error && <div className="mb-5 rounded-xl border border-red-200 bg-red-50 text-red-700 px-4 py-3 text-sm">{error}</div>}

          {loading ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center text-slate-500">Loading your assignments...</div>
          ) : !selected ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-indigo-50 flex items-center justify-center text-2xl mb-4">📝</div>
              <h2 className="text-xl font-bold text-slate-900">Start with the assignment brief</h2>
              <p className="text-slate-600 max-w-xl mx-auto mt-2 mb-6">Paste the exact question or instructions from your UNISA assignment. The coach will turn it into a clear action plan.</p>
              <button onClick={() => setShowNew(true)} className="px-5 py-3 rounded-xl bg-indigo-600 text-white font-semibold">Create Assignment</button>
            </div>
          ) : (
            <div className="grid xl:grid-cols-[280px_minmax(0,1fr)] gap-5">
              <aside className="bg-white rounded-2xl border border-slate-200 p-3 h-fit">
                <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-slate-400">My assignments</div>
                <div className="space-y-1">
                  {assignments.map((assignment) => (
                    <button key={assignment.id} onClick={() => setSelected(assignment)} className={`w-full text-left p-3 rounded-xl transition ${selected.id === assignment.id ? 'bg-indigo-50 text-indigo-700' : 'hover:bg-slate-50 text-slate-700'}`}>
                      <p className="font-medium truncate">{assignment.title}</p>
                      <p className="text-xs text-slate-400 mt-1">{assignment.status === 'completed' ? 'Completed' : 'In progress'}</p>
                    </button>
                  ))}
                </div>
              </aside>

              <section className="space-y-5 min-w-0">
                <div className="bg-white rounded-2xl border border-slate-200 p-5">
                  <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3 mb-4">
                    <div>
                      <p className="text-xs uppercase tracking-wider text-indigo-600 font-semibold">Assignment workspace</p>
                      <h2 className="text-2xl font-bold text-slate-900 mt-1">{selected.title}</h2>
                      {selectedModuleName && <p className="text-sm text-slate-500 mt-1">{selectedModuleName}</p>}
                    </div>
                    <span className="inline-flex w-fit px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-semibold">Student-owned work</span>
                  </div>

                  <div className="grid md:grid-cols-2 gap-5">
                    <div>
                      <h3 className="font-semibold text-slate-900 mb-2">What the question is asking</h3>
                      <ul className="space-y-2 text-sm text-slate-600">{listValue(analysis.what_it_is_asking).map((item, i) => <li key={i} className="flex gap-2"><span className="text-indigo-500">•</span>{item}</li>)}</ul>
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-900 mb-2">Your deliverables</h3>
                      <ul className="space-y-2 text-sm text-slate-600">{listValue(analysis.deliverables).map((item, i) => <li key={i} className="flex gap-2"><span className="text-indigo-500">•</span>{item}</li>)}</ul>
                    </div>
                  </div>

                  {listValue(analysis.action_plan).length > 0 && (
                    <div className="mt-5 pt-5 border-t border-slate-100">
                      <h3 className="font-semibold text-slate-900 mb-3">Your action plan</h3>
                      <div className="grid md:grid-cols-2 gap-3">
                        {analysis.action_plan.map((step: any, i: number) => <div key={i} className="rounded-xl bg-slate-50 p-3"><div className="text-xs font-semibold text-indigo-600">STEP {step.step || i + 1}</div><div className="font-medium text-slate-800 mt-1">{step.title}</div><div className="text-sm text-slate-600 mt-1">{step.task}</div></div>)}
                      </div>
                    </div>
                  )}
                </div>

                <div className="grid lg:grid-cols-[minmax(0,1fr)_360px] gap-5">
                  <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                    <div className="p-4 border-b border-slate-200">
                      <div className="flex gap-2 overflow-x-auto pb-1">
                        {modes.map((item) => <button key={item.id} onClick={() => setMode(item.id)} className={`whitespace-nowrap px-3 py-2 rounded-lg text-sm font-medium ${mode === item.id ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>{item.label}</button>)}
                      </div>
                      <p className="text-xs text-slate-500 mt-2">{modes.find((item) => item.id === mode)?.description}</p>
                    </div>

                    <div className="h-[520px] overflow-y-auto p-4 space-y-4 bg-slate-50/60">
                      {messages.length === 0 && <div className="h-full flex items-center justify-center text-center text-slate-500 px-8"><div><div className="text-3xl mb-3">🎓</div><p className="font-semibold text-slate-700">What do you need help with?</p><p className="text-sm mt-1">Ask me to explain the question, help you plan, test your understanding, or review your own work.</p></div></div>}
                      {messages.map((item, index) => <div key={item.id || index} className={`flex ${item.role === 'user' ? 'justify-end' : 'justify-start'}`}><div className={`max-w-[88%] rounded-2xl px-4 py-3 whitespace-pre-wrap text-sm leading-6 ${item.role === 'user' ? 'bg-indigo-600 text-white rounded-br-sm' : 'bg-white border border-slate-200 text-slate-700 rounded-bl-sm'}`}>{item.content}</div></div>)}
                      {sending && <div className="flex justify-start"><div className="bg-white border border-slate-200 rounded-2xl px-4 py-3 text-sm text-slate-500">Thinking about how to guide you…</div></div>}
                    </div>
                    <div className="p-3 border-t border-slate-200 bg-white">
                      <div className="flex gap-2">
                        <textarea value={message} onChange={(e) => setMessage(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }} placeholder={mode === 'review' ? 'Paste a section of your own work and ask what you should improve…' : 'Ask your assignment coach…'} className="flex-1 min-h-[48px] max-h-32 resize-none rounded-xl border border-slate-200 px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-indigo-200" />
                        <button disabled={sending || !message.trim()} onClick={sendMessage} className="self-end px-4 py-3 rounded-xl bg-indigo-600 text-white font-semibold disabled:opacity-40">Send</button>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-2">Tip: Shift+Enter for a new line. The coach will not write a submission for you.</p>
                    </div>
                  </div>

                  <div className="bg-white rounded-2xl border border-slate-200 p-4 h-fit">
                    <div className="flex items-center justify-between mb-2"><h3 className="font-semibold text-slate-900">My work</h3><button onClick={saveWork} disabled={saving} className="text-sm font-semibold text-indigo-600 disabled:opacity-40">{saving ? 'Saving…' : 'Save'}</button></div>
                    <p className="text-xs text-slate-500 mb-3">Write your own answer here. Use Review my work to get feedback without having AI rewrite it.</p>
                    <textarea value={studentWork} onChange={(e) => setStudentWork(e.target.value)} className="w-full min-h-[330px] resize-y rounded-xl border border-slate-200 p-3 text-sm leading-6 outline-none focus:ring-2 focus:ring-indigo-200" placeholder="Your notes, outline, calculations, or draft…" />
                    <div className="mt-4 pt-4 border-t border-slate-100">
                      <h4 className="text-sm font-semibold text-slate-800 mb-2">Self-check</h4>
                      <ul className="text-xs text-slate-500 space-y-2">{listValue(analysis.self_check).slice(0, 5).map((item, i) => <li key={i}>□ {item}</li>)}</ul>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-2xl border border-slate-200 p-5">
                  <h3 className="font-semibold text-slate-900 mb-3">Keep ownership of the answer</h3>
                  <div className="grid sm:grid-cols-3 gap-3 text-sm">
                    <div className="rounded-xl bg-slate-50 p-3"><b>1. Understand</b><p className="text-slate-500 mt-1">Know exactly what the question asks.</p></div>
                    <div className="rounded-xl bg-slate-50 p-3"><b>2. Build</b><p className="text-slate-500 mt-1">Use your own reasoning, evidence and wording.</p></div>
                    <div className="rounded-xl bg-slate-50 p-3"><b>3. Review</b><p className="text-slate-500 mt-1">Use the coach to find gaps before submitting.</p></div>
                  </div>
                </div>
              </section>
            </div>
          )}
        </div>
      </main>

      {showNew && (
        <div className="fixed inset-0 z-[100] bg-slate-900/40 flex items-center justify-center p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) setShowNew(false); }}>
          <form onSubmit={createAssignment} className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-4 mb-5"><div><h2 className="text-2xl font-bold text-slate-900">New assignment</h2><p className="text-sm text-slate-500 mt-1">Paste the exact instructions from your assignment.</p></div><button type="button" onClick={() => setShowNew(false)} className="text-slate-400 hover:text-slate-700 text-xl">×</button></div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Assignment title</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. MNB1501 Assignment 2" className="w-full rounded-xl border border-slate-200 px-3 py-3 mb-4 outline-none focus:ring-2 focus:ring-indigo-200" />
            <label className="block text-sm font-medium text-slate-700 mb-1">Module (optional)</label>
            <select value={moduleId} onChange={(e) => setModuleId(e.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-3 mb-4 bg-white">
              <option value="">Select a module</option>
              {modules.map((module) => <option key={module.id} value={module.id}>{module.name}</option>)}
            </select>
            <label className="block text-sm font-medium text-slate-700 mb-1">Assignment brief / question</label>
            <textarea required value={brief} onChange={(e) => setBrief(e.target.value)} className="w-full min-h-[260px] rounded-xl border border-slate-200 px-3 py-3 text-sm leading-6 outline-none focus:ring-2 focus:ring-indigo-200" placeholder="Paste the full assignment instructions, including rubric, questions, word count, and referencing instructions if provided…" />
            <div className="mt-4 rounded-xl bg-amber-50 border border-amber-100 p-3 text-xs text-amber-800">For the best coaching, include the full question and rubric. The AI will analyze the requirements, not generate the assignment.</div>
            <div className="flex justify-end gap-3 mt-5"><button type="button" onClick={() => setShowNew(false)} className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700">Cancel</button><button disabled={creating} className="px-5 py-2.5 rounded-xl bg-indigo-600 text-white font-semibold disabled:opacity-50">{creating ? 'Analyzing…' : 'Analyze assignment'}</button></div>
          </form>
        </div>
      )}
    </div>
  );
}
