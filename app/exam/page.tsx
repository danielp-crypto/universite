'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { apiGet, apiPost } from '@/lib/api/client';
import { getSession } from '@/lib/supabase/auth';

const DURATIONS = [
  { minutes: 0, label: 'Untimed', sub: 'Practice at your own pace' },
  { minutes: 15, label: '15 min', sub: 'Quick check' },
  { minutes: 30, label: '30 min', sub: 'Standard' },
  { minutes: 60, label: '60 min', sub: 'Full exam' },
];

const QUESTION_COUNTS = [5, 10, 20];

export default function ExamModePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [modules, setModules] = useState<any[]>([]);
  const [selectedModuleId, setSelectedModuleId] = useState<string | null>(null);
  const [selectedDuration, setSelectedDuration] = useState<number>(30);
  const [selectedCount, setSelectedCount] = useState<number>(10);
  const [starting, setStarting] = useState(false);
  const [startingStep, setStartingStep] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadInitialState();
  }, []);

  const loadInitialState = async () => {
    try {
      const session = await getSession();
      if (!session) {
        router.push('/login');
        return;
      }

      const modulesData = await apiGet('/api/modules').catch(() => []);
      setModules(Array.isArray(modulesData) ? modulesData : []);
      if (Array.isArray(modulesData) && modulesData.length > 0) {
        setSelectedModuleId(searchParams.get('module_id') || modulesData[0].id);
      }
    } catch (err) {
      console.error('Error loading exam mode:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleStart = async () => {
    if (!selectedModuleId) return;

    setStarting(true);
    setError(null);

    try {
      setStartingStep('Setting up your exam...');
      const sessionResult = await apiPost('/api/exam/sessions', {
        module_id: selectedModuleId,
        duration_minutes: selectedDuration,
        questions_count: selectedCount,
      });

      if (!sessionResult.success) {
        setError('Could not start an exam right now. Please try again.');
        setStarting(false);
        return;
      }

      const examSessionId = sessionResult.exam_session.id;

      setStartingStep('Generating questions from your lectures...');
      const questionsResult = await apiPost('/api/exam/questions/generate', {
        exam_session_id: examSessionId,
        count: selectedCount,
        focus_topics: searchParams.get('focus')?.split('|').filter(Boolean),
      });

      if (!questionsResult.success) {
        setError(questionsResult.error || 'Could not generate questions for this module. Try a different module.');
        setStarting(false);
        return;
      }

      router.push(`/exam/${examSessionId}`);
    } catch (err: any) {
      console.error('Error starting exam:', err);
      const apiError = err?.body;
      setError(apiError?.details || apiError?.error || err?.message || 'Something went wrong starting your exam. Please try again.');
      setStarting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600"></div>
      </div>
    );
  }


  return (
    <div className="min-h-screen bg-slate-50">
      <div className="bg-white border-b border-slate-200 px-4 py-4">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <button onClick={() => router.back()} className="text-slate-500 hover:text-slate-700">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-lg font-semibold text-slate-900">Exam Mode</h1>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-8">
        {modules.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center">
            <p className="text-slate-600">You don't have any modules yet. Create one from the dashboard and upload at least one lecture before starting an exam.</p>
          </div>
        ) : starting ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600 mx-auto mb-4"></div>
            <p className="text-slate-700 font-medium">{startingStep}</p>
            <p className="text-slate-400 text-sm mt-1">This can take a moment for longer exams.</p>
          </div>
        ) : (
          <>
            <div className="bg-white rounded-2xl border border-slate-200 p-6 mb-6">
              <h2 className="text-sm font-semibold text-slate-700 mb-3">Which module?</h2>
              <div className="grid grid-cols-1 gap-2">
                {modules.map((m: any) => (
                  <button
                    key={m.id}
                    onClick={() => setSelectedModuleId(m.id)}
                    className={`flex items-center gap-3 p-3 rounded-xl border-2 text-left transition-all ${
                      selectedModuleId === m.id
                        ? 'border-indigo-500 bg-indigo-50'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <span
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: m.color || '#6366f1' }}
                    ></span>
                    <span className="font-medium text-slate-800 text-sm">{m.name}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-6 mb-6">
              <h2 className="text-sm font-semibold text-slate-700 mb-3">Timing</h2>
              <div className="grid grid-cols-2 gap-2">
                {DURATIONS.map((d) => (
                  <button
                    key={d.minutes}
                    onClick={() => setSelectedDuration(d.minutes)}
                    className={`p-3 rounded-xl border-2 text-center transition-all ${
                      selectedDuration === d.minutes
                        ? 'border-indigo-500 bg-indigo-50'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="font-bold text-slate-800">{d.label}</div>
                    <div className="text-xs text-slate-500">{d.sub}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-6 mb-6">
              <h2 className="text-sm font-semibold text-slate-700 mb-3">How many questions?</h2>
              <div className="grid grid-cols-3 gap-2">
                {QUESTION_COUNTS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setSelectedCount(c)}
                    className={`p-3 rounded-xl border-2 text-center font-bold transition-all ${
                      selectedCount === c
                        ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                        : 'border-slate-200 hover:border-slate-300 text-slate-800'
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl p-3 mb-4">
                {error}
              </div>
            )}

            <button
              onClick={handleStart}
              disabled={!selectedModuleId}
              className="w-full py-3.5 px-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-semibold hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Start Exam
            </button>
            <p className="text-xs text-slate-400 text-center mt-3">
              Questions are generated from all completed lectures in this module — mix of multiple choice and open-ended, AI-graded when you submit.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
