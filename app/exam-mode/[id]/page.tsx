'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { apiGet, apiPost } from '@/lib/api/client';
import { getSession } from '@/lib/supabase/auth';

export default function ExamTakingPage() {
  const router = useRouter();
  const params = useParams();
  const examSessionId = params.id as string;

  const [examSession, setExamSession] = useState<any>(null);
  const [questions, setQuestions] = useState<any[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [examStarted, setExamStarted] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [results, setResults] = useState<any>(null);
  const [weakTopics, setWeakTopics] = useState<any[]>([]);

  useEffect(() => {
    loadExamSession();
  }, [examSessionId]);

  useEffect(() => {
    if (examStarted && timeRemaining > 0) {
      const timer = setInterval(() => {
        setTimeRemaining(prev => {
          if (prev <= 1) {
            submitExam();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [examStarted, timeRemaining]);

  const loadExamSession = async () => {
    try {
      const session = await getSession();
      if (!session) {
        router.push('/login');
        return;
      }

      const response = await fetch(`/api/exam/sessions/${examSessionId}`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setExamSession(data.session);
        setQuestions(data.session.exam_questions || []);
        
        // Set timer if duration is set
        if (data.session.duration_minutes > 0) {
          setTimeRemaining(data.session.duration_minutes * 60);
        }

        // Check if already completed
        if (data.session.status === 'completed') {
          setShowResults(true);
          setResults(data.session);
        }
      } else {
        alert('Failed to load exam session');
        router.push('/exam-mode');
      }
    } catch (error) {
      console.error('Error loading exam session:', error);
      alert('Failed to load exam session');
      router.push('/exam-mode');
    } finally {
      setLoading(false);
    }
  };

  const startExam = async () => {
    setExamStarted(true);
  };

  const handleAnswerChange = (questionId: string, answer: string) => {
    setAnswers(prev => ({
      ...prev,
      [questionId]: answer
    }));
  };

  const goToNextQuestion = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
    }
  };

  const goToPreviousQuestion = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(prev => prev - 1);
    }
  };

  const submitExam = async () => {
    if (submitting) return;
    setSubmitting(true);

    try {
      const session = await getSession();
      if (!session) return;

      // Prepare answers array
      const answersArray = Object.entries(answers).map(([questionId, answer]) => ({
        question_id: questionId,
        answer
      }));

      const response = await fetch('/api/exam/submit', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          exam_session_id: examSessionId,
          answers: answersArray
        })
      });

      if (response.ok) {
        const data = await response.json();
        setResults(data);
        setShowResults(true);
        
        // Load weak topics
        loadWeakTopics();
      } else {
        alert('Failed to submit exam');
      }
    } catch (error) {
      console.error('Error submitting exam:', error);
      alert('Failed to submit exam');
    } finally {
      setSubmitting(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const loadWeakTopics = async () => {
    try {
      const session = await getSession();
      if (!session || !examSession) return;

      const response = await fetch(`/api/exam/weak-topics?module_id=${examSession.module_id}`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setWeakTopics(data.weak_topics || []);
      }
    } catch (error) {
      console.error('Error loading weak topics:', error);
    }
  };

  const currentQuestion = questions[currentQuestionIndex];
  const progress = ((currentQuestionIndex + 1) / questions.length) * 100;

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (showResults && results) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
        <div className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-4 py-3 sticky top-0 z-10">
          <div className="mx-auto w-full max-w-[430px] md:max-w-[680px] lg:max-w-[800px] flex items-center gap-3">
            <button
              onClick={() => router.push('/exam-mode')}
              className="p-1 text-slate-600 dark:text-slate-400"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h1 className="text-xl font-semibold text-slate-800 dark:text-slate-100">Exam Results</h1>
          </div>
        </div>

        <div className="mx-auto w-full max-w-[430px] md:max-w-[680px] lg:max-w-[800px] px-4 py-6">
          {/* Score Card */}
          <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl p-6 mb-4 text-white">
            <div className="text-center">
              <div className="text-6xl font-bold mb-2">{Math.round(results.score)}%</div>
              <div className="text-indigo-100 mb-4">Overall Score</div>
              <div className="flex justify-center gap-8 text-sm">
                <div>
                  <div className="font-bold text-2xl">{results.correct_count}</div>
                  <div className="text-indigo-100">Correct</div>
                </div>
                <div>
                  <div className="font-bold text-2xl">{results.total_questions - results.correct_count}</div>
                  <div className="text-indigo-100">Incorrect</div>
                </div>
              </div>
            </div>
          </div>

          {/* Readiness Score */}
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 mb-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-slate-800 dark:text-slate-100">Exam Readiness Score</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">Based on your performance</p>
              </div>
              <div className="text-3xl font-bold text-indigo-600">{results.readiness_score}/100</div>
            </div>
          </div>

          {/* Weak Topics Analysis */}
          {weakTopics.length > 0 && (
            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 mb-4">
              <h3 className="font-semibold text-slate-800 dark:text-slate-100 mb-3">Areas to Improve</h3>
              <div className="space-y-3">
                {weakTopics.slice(0, 5).map((topic: any, index: number) => (
                  <div key={topic.id} className="flex items-start gap-3 p-3 bg-rose-50 rounded-xl">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-rose-200 flex items-center justify-center text-rose-700 font-bold text-sm">
                      {index + 1}
                    </div>
                    <div className="flex-1">
                      <div className="font-medium text-slate-800 dark:text-slate-100">{topic.topic}</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        {topic.mistake_count} mistake{topic.mistake_count > 1 ? 's' : ''}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="space-y-3">
            <button
              onClick={() => router.push('/exam-mode')}
              className="w-full py-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-semibold hover:shadow-lg transition-all"
            >
              Back to Exam Mode
            </button>
            <button
              onClick={() => router.push('/dashboard')}
              className="w-full py-4 bg-white dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 rounded-xl font-semibold hover:bg-slate-50 dark:hover:bg-slate-700 transition-all"
            >
              Return to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!examStarted) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
        <div className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-4 py-3 sticky top-0 z-10">
          <div className="mx-auto w-full max-w-[430px] md:max-w-[680px] lg:max-w-[800px] flex items-center gap-3">
            <button
              onClick={() => router.push('/exam-mode')}
              className="p-1 text-slate-600 dark:text-slate-400"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h1 className="text-xl font-semibold text-slate-800 dark:text-slate-100">Practice Exam</h1>
          </div>
        </div>

        <div className="mx-auto w-full max-w-[430px] md:max-w-[680px] lg:max-w-[800px] px-4 py-6">
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-6 text-center">
            <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-indigo-100 flex items-center justify-center">
              <svg className="w-10 h-10 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-2">Ready to Start?</h2>
            <p className="text-slate-600 dark:text-slate-400 mb-6">
              This exam has {questions.length} questions and {examSession?.duration_minutes > 0 ? `${examSession.duration_minutes} minutes` : 'no time limit'}.
            </p>
            <button
              onClick={startExam}
              className="w-full py-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-semibold hover:shadow-lg transition-all"
            >
              Start Exam
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header with Timer */}
      <div className="bg-white border-b border-slate-200 px-4 py-3 sticky top-0 z-10">
        <div className="mx-auto w-full max-w-[430px] md:max-w-[680px] lg:max-w-[800px] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                if (confirm('Are you sure you want to abandon this exam? Your progress will be lost.')) {
                  router.push('/exam-mode');
                }
              }}
              className="p-1 text-slate-600 dark:text-slate-400"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <h1 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Question {currentQuestionIndex + 1}/{questions.length}</h1>
          </div>
          {examSession?.duration_minutes > 0 && (
            <div className={`text-xl font-bold ${timeRemaining < 300 ? 'text-red-600' : 'text-slate-800 dark:text-slate-100'}`}>
              {formatTime(timeRemaining)}
            </div>
          )}
        </div>
        {/* Progress Bar */}
        <div className="mx-auto w-full max-w-[430px] md:max-w-[680px] lg:max-w-[800px] mt-3">
          <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-indigo-600 to-purple-600 transition-all duration-300"
              style={{ width: `${progress}%` }}
            ></div>
          </div>
        </div>
      </div>

      <div className="mx-auto w-full max-w-[430px] md:max-w-[680px] lg:max-w-[800px] px-4 py-6">
        {/* Question Card */}
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-6 mb-4">
          <div className="mb-4">
            <span className="inline-block px-3 py-1 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-700 mb-3">
              {currentQuestion?.difficulty}
            </span>
            <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100 leading-relaxed">
              {currentQuestion?.question}
            </h2>
          </div>

          {currentQuestion?.question_type === 'multiple_choice' && currentQuestion?.options ? (
            <div className="space-y-3">
              {currentQuestion.options.map((option: string, index: number) => {
                const optionLetter = String.fromCharCode(65 + index);
                return (
                  <button
                    key={index}
                    onClick={() => handleAnswerChange(currentQuestion.id, optionLetter)}
                    className={`w-full p-4 rounded-xl text-left transition-all ${
                      answers[currentQuestion.id] === optionLetter
                        ? 'bg-indigo-50 dark:bg-indigo-900/30 border-2 border-indigo-500'
                        : 'bg-slate-50 dark:bg-slate-700 border-2 border-transparent hover:border-slate-300 dark:hover:border-slate-500'
                    }`}
                  >
                    <div className="font-medium text-slate-800 dark:text-slate-100">{option}</div>
                  </button>
                );
              })}
            </div>
          ) : (
            <textarea
              value={answers[currentQuestion.id] || ''}
              onChange={(e) => handleAnswerChange(currentQuestion.id, e.target.value)}
              placeholder="Type your answer here..."
              className="w-full p-4 border-2 border-slate-200 dark:border-slate-600 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none resize-none min-h-[150px] dark:bg-slate-700 dark:text-slate-100"
            />
          )}
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between gap-3">
          <button
            onClick={goToPreviousQuestion}
            disabled={currentQuestionIndex === 0}
            className="flex-1 py-4 bg-white dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 rounded-xl font-semibold hover:bg-slate-50 dark:hover:bg-slate-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Previous
          </button>
          
          {currentQuestionIndex === questions.length - 1 ? (
            <button
              onClick={submitExam}
              disabled={submitting}
              className="flex-1 py-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-semibold hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? 'Submitting...' : 'Submit Exam'}
            </button>
          ) : (
            <button
              onClick={goToNextQuestion}
              className="flex-1 py-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-semibold hover:shadow-lg transition-all"
            >
              Next
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
