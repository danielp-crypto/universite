'use client';

import React, { useEffect, useState, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { apiGet } from '@/lib/api/client';
import { getSession } from '@/lib/supabase/auth';
import { useRouter } from 'next/navigation';

function LectureDetailPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const lectureId = searchParams.get('id');

  const [currentLecture, setCurrentLecture] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'transcript' | 'summary' | 'questions'>('transcript');

  const downloadDocument = async () => {
    if (!currentLecture || !currentLecture.file_content) return;
    try {
      const buffer = Buffer.from(currentLecture.file_content, 'base64');
      const blob = new Blob([buffer], { type: currentLecture.file_type });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = currentLecture.file_name || 'document';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Error downloading document:', error);
      alert('Error downloading document');
    }
  };

  const loadLecture = async (id: string) => {
    try {
      const session = await getSession();
      if (!session) {
        router.push('/login');
        return;
      }

      const lecture = await apiGet(`/api/lectures/${id}`);
      if (lecture) {
        setCurrentLecture(lecture);
      }
    } catch (err: any) {
      console.error('Error loading lecture:', err);
    }
  };

  useEffect(() => {
    if (lectureId) {
      loadLecture(lectureId);
    }
  }, [lectureId]);

  const handleReprocessDocument = async () => {
    if (!currentLecture) return;
    try {
      const session = await getSession();
      if (!session) {
        router.push('/login');
        return;
      }

      await fetch(`/api/lectures/${currentLecture.id}/process`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });
      
      loadLecture(currentLecture.id);
      alert('Document reprocessed successfully!');
    } catch (error) {
      console.error('Error reprocessing document:', error);
      alert('Failed to reprocess document');
    }
  };

  return (
    <div className="bg-slate-50 min-h-screen font-sans flex flex-col justify-between">
      <div id="app" className="flex-1 flex flex-col pb-20">
        {/* Header */}
        <div className="bg-white border-b border-slate-200 px-4 py-3 md:py-4 sticky top-0 z-10">
          <div className="mx-auto w-full max-w-[430px] md:max-w-[680px] lg:max-w-[800px] flex items-center gap-3">
            <Link href="/lectures" className="p-1 text-slate-600">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg">
              <img alt="Universite logo" className="w-6 h-6 md:w-7 md:h-7 object-contain" src="/assets/images/icon-white-removebg.png" />
            </div>
            <h1 className="text-lg md:text-xl font-semibold text-slate-800 flex-1">Lecture Details</h1>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 mx-auto w-full max-w-[430px] md:max-w-[680px] lg:max-w-[800px] px-4 py-4">
          {currentLecture ? (
            <>
              {/* Lecture Card */}
              <div className="bg-white border border-slate-200 rounded-2xl p-4 md:p-5 mb-4 shadow-sm">
                <h2 className="text-xl font-bold text-slate-800 mb-2">{currentLecture.title}</h2>
                <div className="flex items-center gap-3 text-sm text-slate-500 mb-4">
                  <span>{new Date(currentLecture.created_at).toLocaleDateString()}</span>
                  <span>•</span>
                  <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full text-xs font-medium">
                    {currentLecture.status === 'processing' ? 'Processing...' : 'Completed'}
                  </span>
                  {currentLecture.file_name && (
                    <>
                      <span>•</span>
                      <span>{currentLecture.file_name}</span>
                    </>
                  )}
                </div>

                {/* Primary Actions */}
                <div className="flex gap-2 mb-4">
                  <Link
                    href={`/assistant?lecture=${currentLecture.id}`}
                    className="flex-1 px-4 py-3 bg-gradient-to-br from-indigo-500 to-purple-600 text-white rounded-xl font-semibold text-center hover:shadow-lg transition-all text-sm active:scale-95"
                  >
                    Chat with Lecture
                  </Link>
                  <button
                    onClick={downloadDocument}
                    className="px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold text-center hover:shadow-lg transition-all text-sm active:scale-95"
                    title="Download"
                  >
                    <svg className="w-5 h-5 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                  </button>
                </div>

                {/* Reprocess Button */}
                <div className="pt-4 border-t border-slate-100">
                  <button
                    onClick={handleReprocessDocument}
                    className="w-full px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl text-xs font-semibold active:scale-95 transition-transform"
                  >
                    Reprocess Document
                  </button>
                </div>
              </div>

              {/* Tabs Menu */}
              <div className="mb-4">
                <div className="flex gap-2 border-b border-slate-200">
                  <button
                    onClick={() => setActiveTab('transcript')}
                    className={`px-4 py-2 text-sm font-semibold transition-colors ${
                      activeTab === 'transcript' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    Transcript
                  </button>
                  <button
                    onClick={() => setActiveTab('summary')}
                    className={`px-4 py-2 text-sm font-semibold transition-colors ${
                      activeTab === 'summary' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    Summary
                  </button>
                  <button
                    onClick={() => setActiveTab('questions')}
                    className={`px-4 py-2 text-sm font-semibold transition-colors ${
                      activeTab === 'questions' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    Questions
                  </button>
                </div>
              </div>

              {/* Tab Contents */}
              {activeTab === 'transcript' && (
                <div className="bg-white border border-slate-200 rounded-2xl p-4 md:p-6 shadow-sm animate-fade-in">
                  <h3 className="text-base font-semibold text-slate-800 mb-3">Extracted Text</h3>
                  {currentLecture.transcription ? (
                    <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">{currentLecture.transcription}</p>
                  ) : (
                    <div className="text-center py-6">
                      <p className="text-slate-500 text-sm">No text extracted yet. Click "Reprocess Document" to extract text.</p>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'summary' && (
                <div className="bg-white border border-slate-200 rounded-2xl p-4 md:p-6 shadow-sm animate-fade-in">
                  <h3 className="text-base font-semibold text-slate-800 mb-3">Lecture Notes</h3>
                  {currentLecture.summary ? (
                    <div className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">
                      {currentLecture.summary}
                    </div>
                  ) : (
                    <div className="text-center py-6">
                      <p className="text-slate-500 text-sm">No summary available yet. Click "Reprocess Document" to generate summary.</p>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'questions' && (
                <div className="bg-white border border-slate-200 rounded-2xl p-4 md:p-6 shadow-sm animate-fade-in">
                  <h3 className="text-base font-semibold text-slate-800 mb-3">Generated Questions</h3>
                  {currentLecture.questions ? (
                    <div className="space-y-4">
                      {currentLecture.questions.multipleChoice && (
                        <div>
                          <h4 className="text-sm font-semibold text-slate-700 mb-2">Multiple Choice Questions</h4>
                          {currentLecture.questions.multipleChoice.map((q: any, idx: number) => (
                            <div key={idx} className="mb-3 p-3 bg-slate-50 rounded-lg">
                              <p className="text-sm font-medium text-slate-800 mb-2">{q.question}</p>
                              <div className="space-y-1">
                                {q.options.map((opt: string, optIdx: number) => (
                                  <p key={optIdx} className="text-xs text-slate-600">
                                    {String.fromCharCode(65 + optIdx)}. {opt} {q.correctAnswer === String.fromCharCode(65 + optIdx) && '✓'}
                                  </p>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      {currentLecture.questions.shortAnswer && (
                        <div>
                          <h4 className="text-sm font-semibold text-slate-700 mb-2">Short Answer Questions</h4>
                          {currentLecture.questions.shortAnswer.map((q: any, idx: number) => (
                            <div key={idx} className="mb-3 p-3 bg-slate-50 rounded-lg">
                              <p className="text-sm font-medium text-slate-800 mb-1">{q.question}</p>
                              <p className="text-xs text-slate-600">Answer: {q.answer}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-6">
                      <p className="text-slate-500 text-sm">No questions generated yet. Click "Reprocess Document" to generate questions.</p>
                    </div>
                  )}
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-4 border-indigo-600 border-t-transparent mx-auto"></div>
              <p className="text-slate-500 mt-4 text-sm">Loading lecture...</p>
            </div>
          )}
        </div>

        {/* Bottom Navigation */}
        <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 safe-area-inset-bottom z-10">
          <div className="mx-auto w-full max-w-[430px] md:max-w-[680px] lg:max-w-[800px]">
            <div className="flex items-center justify-around py-2">
              <Link href="/home" className="flex flex-col items-center py-2 px-4 text-slate-400 hover:text-slate-600">
                <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
                <span className="text-xs font-medium">Home</span>
              </Link>
              <Link href="/lectures" className="flex flex-col items-center py-2 px-4 text-indigo-600">
                <svg className="w-6 h-6 mb-1" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M7 3a1 1 0 000 2h6a1 1 0 100-2H7zM4 7a1 1 0 011-1h10a1 1 0 110 2H5a1 1 0 01-1-1zM2 11a2 2 0 012-2h12a2 2 0 012 2v4a2 2 0 01-2 2H4a2 2 0 01-2-2v-4z" />
                </svg>
                <span className="text-xs font-medium">Lectures</span>
              </Link>
              <Link href="/assistant" className="flex flex-col items-center py-2 px-4 text-slate-400 hover:text-slate-600">
                <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                </svg>
                <span className="text-xs font-medium">Chat</span>
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
  );
}

export default function LectureDetailPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-4 border-indigo-600 border-t-transparent"></div>
      </div>
    }>
      <LectureDetailPageContent />
    </Suspense>
  );
}
