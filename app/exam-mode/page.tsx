'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiGet, apiPost } from '@/lib/api/client';
import { getSession } from '@/lib/supabase/auth';

export default function ExamModePage() {
  const router = useRouter();
  const [modules, setModules] = useState<any[]>([]);
  const [selectedModule, setSelectedModule] = useState<string | null>(null);
  const [examSessions, setExamSessions] = useState<any[]>([]);
  const [readinessScore, setReadinessScore] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [generatingQuestions, setGeneratingQuestions] = useState(false);
  const [lectures, setLectures] = useState<any[]>([]);

  useEffect(() => {
    loadModules();
    loadExamSessions();
    loadLectures();
  }, []);

  const loadModules = async () => {
    try {
      const session = await getSession();
      if (!session) {
        router.push('/login');
        return;
      }

      const response = await fetch('/api/modules', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });

      if (response.ok) {
        const modulesData = await response.json();
        setModules(modulesData || []);
        if (modulesData && modulesData.length > 0) {
          setSelectedModule(modulesData[0].id);
        }
      }
    } catch (error) {
      console.error('Error loading modules:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadExamSessions = async () => {
    try {
      const session = await getSession();
      if (!session) return;

      const response = await fetch('/api/exam/sessions', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setExamSessions(data.sessions || []);
        
        // Calculate readiness score from recent sessions
        if (data.sessions && data.sessions.length > 0) {
          const recentSessions = data.sessions.slice(0, 5);
          const avgScore = recentSessions.reduce((sum: number, s: any) => sum + (s.readiness_score || 0), 0) / recentSessions.length;
          setReadinessScore(Math.round(avgScore));
        }
      }
    } catch (error) {
      console.error('Error loading exam sessions:', error);
    }
  };

  const loadLectures = async () => {
    try {
      const session = await getSession();
      if (!session) return;

      const response = await fetch('/api/lectures', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });

      if (response.ok) {
        const lecturesData = await response.json();
        setLectures(lecturesData || []);
      }
    } catch (error) {
      console.error('Error loading lectures:', error);
    }
  };

  const getModuleLecturesCount = (moduleId: string) => {
    // Count lectures from the loaded lectures array
    return lectures.filter(lecture => lecture.module_id === moduleId).length;
  };

  const getReadinessLabel = (score: number) => {
    if (score >= 91) return { label: 'Excellent', color: 'emerald' };
    if (score >= 71) return { label: 'Exam Ready', color: 'blue' };
    if (score >= 41) return { label: 'Getting There', color: 'amber' };
    return { label: 'Needs Work', color: 'rose' };
  };

  const startPracticeExam = async () => {
    if (!selectedModule) return;

    try {
      const session = await getSession();
      if (!session) return;

      // Create exam session
      const response = await fetch('/api/exam/sessions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          module_id: selectedModule,
          duration_minutes: 30,
          questions_count: 10
        })
      });

      if (response.ok) {
        const data = await response.json();
        console.log('Exam session created:', data);

        // Generate questions for the session
        const questionsResponse = await fetch('/api/exam/questions/generate', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            exam_session_id: data.exam_session.id,
            question_type: 'mixed',
            difficulty: 'mixed',
            count: 10
          })
        });

        if (questionsResponse.ok) {
          console.log('Questions generated successfully');
          router.push(`/exam-mode/${data.exam_session.id}`);
        } else {
          const errorData = await questionsResponse.json();
          console.error('Failed to generate questions:', errorData);
          alert(`Failed to generate questions: ${errorData.error || 'Unknown error'}`);
        }
      } else {
        const errorData = await response.json();
        console.error('Failed to start exam:', errorData);
        alert(`Failed to start exam: ${errorData.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error starting exam:', error);
      alert('Failed to start exam');
    }
  };

  const generatePracticeQuestions = async () => {
    if (!selectedModule) return;
    
    setGeneratingQuestions(true);
    try {
      const session = await getSession();
      if (!session) return;

      // Create exam session first
      const sessionResponse = await fetch('/api/exam/sessions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          module_id: selectedModule,
          duration_minutes: 0,
          questions_count: 5
        })
      });

      if (sessionResponse.ok) {
        const sessionData = await sessionResponse.json();
        
        // Generate questions
        const questionsResponse = await fetch('/api/exam/questions/generate', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            exam_session_id: sessionData.exam_session.id,
            question_type: 'mixed',
            difficulty: 'mixed',
            count: 5
          })
        });

        if (questionsResponse.ok) {
          router.push(`/exam-mode/${sessionData.exam_session.id}`);
        } else {
          alert('Failed to generate questions');
        }
      } else {
        alert('Failed to create session');
      }
    } catch (error) {
      console.error('Error generating questions:', error);
      alert('Failed to generate questions');
    } finally {
      setGeneratingQuestions(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  const readinessInfo = getReadinessLabel(readinessScore);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      {/* Header */}
      <div className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-4 py-3 sticky top-0 z-10">
        <div className="mx-auto w-full max-w-[430px] md:max-w-[680px] lg:max-w-[800px] flex items-center gap-3">
          <Link href="/dashboard" className="p-1 text-slate-600">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <h1 className="text-xl font-semibold text-slate-800 dark:text-slate-100">Exam Mode</h1>
        </div>
      </div>

      <div className="mx-auto w-full max-w-[430px] md:max-w-[680px] lg:max-w-[800px] px-4 py-6">
        {/* Module Selection */}
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 mb-4">
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">Select Module</h2>
          <div className="space-y-2">
            {modules.map((module) => (
              <button
                key={module.id}
                onClick={() => setSelectedModule(module.id)}
                className={`w-full p-3 rounded-xl text-left transition-all ${
                  selectedModule === module.id
                    ? 'bg-indigo-50 dark:bg-indigo-900/30 border-2 border-indigo-500'
                    : 'bg-slate-50 dark:bg-slate-700 border-2 border-transparent hover:border-slate-300 dark:hover:border-slate-500'
                }`}
              >
                <div className="font-medium text-slate-800 dark:text-slate-100">{module.name}</div>
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  {getModuleLecturesCount(module.id)} lectures
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Exam Readiness Score */}
        <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl p-6 mb-4 text-white">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold">Exam Readiness Score</h2>
            <div className={`px-3 py-1 rounded-full text-xs font-semibold bg-white/20`}>
              {readinessInfo.label}
            </div>
          </div>
          <div className="text-5xl font-bold mb-2">{readinessScore}/100</div>
          <p className="text-indigo-100 text-sm">
            Based on your recent practice exam performance
          </p>
        </div>

        {/* Action Buttons */}
        <div className="space-y-3 mb-6">
          <button
            onClick={startPracticeExam}
            disabled={!selectedModule}
            className="w-full py-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-semibold hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Start Practice Exam
          </button>
          <button
            onClick={generatePracticeQuestions}
            disabled={!selectedModule || generatingQuestions}
            className="w-full py-4 bg-white border-2 border-indigo-600 text-indigo-600 rounded-xl font-semibold hover:bg-indigo-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {generatingQuestions ? 'Generating Questions...' : 'Generate Practice Questions'}
          </button>
        </div>

        {/* Previous Attempts */}
        {examSessions.length > 0 && (
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-4">
            <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">Previous Attempts</h2>
            <div className="space-y-2">
              {examSessions.slice(0, 5).map((session) => (
                <Link
                  key={session.id}
                  href={`/exam-mode/${session.id}`}
                  className="block p-3 bg-slate-50 dark:bg-slate-700 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-600 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium text-slate-800 dark:text-slate-100 text-sm">
                        {new Date(session.created_at).toLocaleDateString()}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        {session.questions_count} questions • {session.duration_minutes} min
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-indigo-600">
                        {session.score ? Math.round(session.score) : 0}%
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        {session.correct_count || 0}/{session.questions_count} correct
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
