'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { apiGet, apiPost } from '@/lib/api/client';

function formatTime(totalSeconds: number): string {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

// Options come back pre-labeled from the generator, e.g. "A) Paris" — this
// pulls just the letter out so it can be compared against correct_option
// (which is stored as a bare letter) and used as the student's answer value.
function optionLetter(option: string): string {
  const match = option.match(/^([A-D])\)/);
  return match ? match[1] : option;
}

export default function ExamSessionPage() {
  const params = useParams();
  const sessionId = params.sessionId as string;

  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<any>(null);
  const [questions, setQuestions] = useState<any[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [secondsRemaining, setSecondsRemaining] = useState<number | null>(null);
  const [isUntimed, setIsUntimed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [results, setResults] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const submittedRef = useRef(false);

  useEffect(() => {
    loadSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  const loadSession = async () => {
    try {
      const result = await apiGet(`/api/exam/sessions/${sessionId}`);
      if (!result.success) {
        setError('Could not load this exam.');
        setLoading(false);
        return;
      }

      const s = result.session;
      setSession(s);
      setQuestions((s.exam_questions || []).slice().sort((a: any, b: any) => a.order_index - b.order_index));

      if (s.status === 'completed') {
        setResults({
          score: s.score,
          readiness_score: s.readiness_score,
          correct_count: s.correct_count,
          total_questions: s.questions_count,
          answers: s.student_answers || [],
        });
      } else if (s.duration_minutes === 0) {
        setIsUntimed(true);
      } else {
        // The session is created before AI question generation. Starting
        // from created_at would charge the student for generation time.
        setSecondsRemaining(s.duration_minutes * 60);
      }
    } catch (err) {
      console.error('Error loading exam session:', err);
      setError('Could not load this exam.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = useCallback(async () => {
    if (submittedRef.current) return;
    submittedRef.current = true;
    setSubmitting(true);

    try {
      const answerPayload = questions.map((q) => ({
        question_id: q.id,
        answer: answers[q.id] || '',
      }));

      const result = await apiPost('/api/exam/submit', {
        exam_session_id: sessionId,
        answers: answerPayload,
      });

      if (result.success) {
        setResults(result);
      } else {
        setError('Failed to submit your exam. Please try again.');
        submittedRef.current = false;
      }
    } catch (err) {
      console.error('Error submitting exam:', err);
      setError('Failed to submit your exam. Please try again.');
      submittedRef.current = false;
    } finally {
      setSubmitting(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questions, answers, sessionId]);

  // Countdown timer — only runs when the exam is timed. Auto-submits at zero.
  useEffect(() => {
    if (isUntimed || secondsRemaining === null || results) return;

    if (secondsRemaining <= 0) {
      handleSubmit();
      return;
    }

    const interval = setInterval(() => {
      setSecondsRemaining((prev) => (prev !== null ? prev - 1 : null));
    }, 1000);

    return () => clearInterval(interval);
  }, [secondsRemaining, results, isUntimed, handleSubmit]);

  // Warn before leaving mid-exam — answers aren't saved until final submission.
  useEffect(() => {
    if (results) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [results]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (error && !results) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-8 max-w-md w-full text-center">
          <p className="text-slate-600 mb-4">{error}</p>
          <Link href="/exam" className="text-indigo-600 font-semibold text-sm">Back to Exam Mode</Link>
        </div>
      </div>
    );
  }

  // ===== RESULTS VIEW =====
  if (results) {
    const overallScore = results.score ?? 0;
    const correctCount = results.correct_count ?? 0;
    const questionsCount = results.total_questions ?? questions.length;
    const readinessScore = results.readiness_score ?? Math.round(overallScore);
    const answersByQuestionId = new Map((results.answers || []).map((a: any) => [a.question_id, a]));

    return (
      <div className="min-h-screen bg-slate-50">
        <div className="bg-white border-b border-slate-200 px-4 py-4">
          <div className="max-w-2xl mx-auto flex items-center gap-3">
            <Link href="/dashboard" className="text-slate-500 hover:text-slate-700">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <h1 className="text-lg font-semibold text-slate-900">Exam Results</h1>
          </div>
        </div>

        <div className="max-w-2xl mx-auto px-4 py-8">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 mb-6 text-center">
            <div className="text-5xl font-bold text-indigo-600 mb-1">{Math.round(overallScore)}%</div>
            <p className="text-slate-500 text-sm mb-4">Overall score</p>
            <div className="flex items-center justify-center gap-6 text-sm">
              <div>
                <div className="font-bold text-slate-800">{correctCount}/{questionsCount}</div>
                <div className="text-slate-400 text-xs">Correct</div>
              </div>
              <div className="w-px h-8 bg-slate-200"></div>
              <div>
                <div className="font-bold text-slate-800">{readinessScore}%</div>
                <div className="text-slate-400 text-xs">Readiness</div>
              </div>
            </div>
          </div>

          <h2 className="text-sm font-semibold text-slate-700 mb-3">Question breakdown</h2>
          <div className="space-y-3">
            {questions.map((q: any, i: number) => {
              const a = answersByQuestionId.get(q.id) || {} as any;
              return (
                <div key={q.id} className={`bg-white rounded-2xl border p-4 ${a.is_correct ? 'border-emerald-200' : 'border-red-200'}`}>
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <p className="text-sm font-medium text-slate-800 flex-1">
                      {i + 1}. {q.question}
                    </p>
                    <span className={`flex-shrink-0 text-xs font-bold px-2 py-1 rounded-full ${
                      a.is_correct ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
                    }`}>
                      {Math.round(a.score ?? 0)}%
                    </span>
                  </div>

                  <div className="text-sm text-slate-600 mb-1">
                    <span className="font-medium text-slate-500">Your answer: </span>
                    {a.answer || <span className="italic text-slate-400">No answer given</span>}
                  </div>

                  {q.question_type === 'multiple_choice' ? (
                    !a.is_correct && (
                      <div className="text-sm text-emerald-700 mb-1">
                        <span className="font-medium">Correct answer: </span>{q.correct_option}
                      </div>
                    )
                  ) : (
                    (a.model_answer || q.expected_answer) && (
                      <div className="text-sm text-slate-600 mb-1">
                        <span className="font-medium text-slate-500">Model answer: </span>{a.model_answer || q.expected_answer}
                      </div>
                    )
                  )}

                  {a.feedback && (
                    <p className="text-sm text-slate-700 bg-slate-50 rounded-lg px-3 py-2 mt-2">{a.feedback}</p>
                  )}

                  {a.missing_concepts?.length > 0 && (
                    <div className="text-xs text-amber-700 mt-2">
                      <span className="font-semibold">Missing: </span>{a.missing_concepts.join(', ')}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <Link
            href="/exam"
            className="block w-full text-center py-3.5 px-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-semibold hover:shadow-lg transition-all mt-6"
          >
            Take Another Exam
          </Link>
        </div>
      </div>
    );
  }

  // ===== EXAM-TAKING VIEW =====
  const currentQuestion = questions[currentIndex];
  const isLastQuestion = currentIndex === questions.length - 1;
  const answeredCount = Object.values(answers).filter((a) => a && a.trim().length > 0).length;

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      <div className="bg-white border-b border-slate-200 px-4 py-3 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-sm font-semibold text-slate-900">{session?.modules?.name}</h1>
            <p className="text-xs text-slate-500">Question {currentIndex + 1} of {questions.length} · {answeredCount} answered</p>
          </div>
          {isUntimed ? (
            <span className="px-3 py-1.5 rounded-full text-sm font-bold bg-slate-100 text-slate-600">
              Untimed
            </span>
          ) : (
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-bold ${
              secondsRemaining !== null && secondsRemaining < 60
                ? 'bg-red-50 text-red-600'
                : 'bg-indigo-50 text-indigo-600'
            }`}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {secondsRemaining !== null ? formatTime(secondsRemaining) : '--:--'}
            </div>
          )}
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6">
        {currentQuestion && (
          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">
                {currentQuestion.difficulty}
              </span>
              <span className="text-slate-300">·</span>
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">
                {currentQuestion.question_type === 'multiple_choice' ? 'Multiple Choice' : currentQuestion.question_type === 'long_answer' ? 'Long Answer' : 'Short Answer'}
              </span>
            </div>

            <p className="text-base font-medium text-slate-900 mb-5">{currentQuestion.question}</p>

            {currentQuestion.question_type === 'multiple_choice' ? (
              <div className="space-y-2">
                {(currentQuestion.options || []).map((option: string) => {
                  const letter = optionLetter(option);
                  const isSelected = answers[currentQuestion.id] === letter;
                  return (
                    <button
                      key={option}
                      onClick={() => setAnswers((prev) => ({ ...prev, [currentQuestion.id]: letter }))}
                      className={`w-full text-left p-3 rounded-xl border-2 transition-all ${
                        isSelected ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <span className="text-sm text-slate-700">{option}</span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <textarea
                value={answers[currentQuestion.id] || ''}
                onChange={(e) => setAnswers((prev) => ({ ...prev, [currentQuestion.id]: e.target.value }))}
                placeholder="Write your answer..."
                rows={6}
                className="w-full border-2 border-slate-200 rounded-xl p-3 text-sm text-slate-800 outline-none focus:border-indigo-500 transition-all resize-none"
              />
            )}
          </div>
        )}

        <div className="flex items-center justify-center gap-1.5 mt-4 flex-wrap">
          {questions.map((q, i) => (
            <button
              key={q.id}
              onClick={() => setCurrentIndex(i)}
              className={`w-2.5 h-2.5 rounded-full transition-all ${
                i === currentIndex
                  ? 'bg-indigo-600 w-6'
                  : answers[q.id]
                  ? 'bg-emerald-400'
                  : 'bg-slate-200'
              }`}
              title={`Question ${i + 1}`}
            />
          ))}
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 px-4 py-3">
        <div className="max-w-2xl mx-auto flex gap-2">
          <button
            onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
            disabled={currentIndex === 0}
            className="px-4 py-2.5 bg-slate-100 text-slate-700 rounded-xl font-medium text-sm disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Previous
          </button>
          {isLastQuestion ? (
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="flex-1 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-semibold text-sm disabled:opacity-50"
            >
              {submitting ? 'Grading your exam...' : 'Submit Exam'}
            </button>
          ) : (
            <button
              onClick={() => setCurrentIndex((i) => Math.min(questions.length - 1, i + 1))}
              className="flex-1 py-2.5 bg-indigo-600 text-white rounded-xl font-semibold text-sm"
            >
              Next
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
