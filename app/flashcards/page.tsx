'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getSession } from '@/lib/supabase/auth';
import { apiPost } from '@/lib/api/client';

function FlashcardsPageContent() {
  const router = useRouter();
  const [flashcards, setFlashcards] = useState<any[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [loading, setLoading] = useState(true);

  // Tracks which cards have been viewed this session so we can log a
  // "self_test" study-analytics event the first time the user completes a
  // full pass through the deck (fires once per session, not per card).
  const viewedIndices = useRef<Set<number>>(new Set());
  const hasLoggedCompletion = useRef(false);

  useEffect(() => {
    loadFlashcards();
  }, []);

  useEffect(() => {
    if (flashcards.length === 0 || hasLoggedCompletion.current) return;

    viewedIndices.current.add(currentIndex);

    if (viewedIndices.current.size >= flashcards.length) {
      hasLoggedCompletion.current = true;
      apiPost('/api/analytics/event', {
        event_type: 'self_test',
        metadata: { card_count: flashcards.length },
      }).catch((error) => {
        // Don't let analytics logging interrupt studying
        console.error('Error logging self-test completion:', error);
      });
    }
  }, [currentIndex, flashcards.length]);

  const loadFlashcards = async () => {
    try {
      const session = await getSession();
      if (!session) {
        router.push('/login');
        return;
      }

      // Load from localStorage
      const storedFlashcards = localStorage.getItem('universite_flashcards');
      if (storedFlashcards) {
        setFlashcards(JSON.parse(storedFlashcards));
      }
    } catch (error) {
      console.error('Error loading flashcards:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePrevious = () => {
    setIsFlipped(false);
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : flashcards.length - 1));
  };

  const handleNext = () => {
    setIsFlipped(false);
    setCurrentIndex((prev) => (prev < flashcards.length - 1 ? prev + 1 : 0));
  };

  const handleFlip = () => {
    setIsFlipped(!isFlipped);
  };

  if (loading) {
    return (
      <div className="bg-slate-50 min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-4 border-indigo-600 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="bg-slate-50 min-h-screen font-sans flex flex-col justify-between">
      <div id="app" className="flex-1 flex flex-col pb-20">
        {/* Header */}
        <div className="bg-white border-b border-slate-200 px-4 py-3 md:py-4 sticky top-0 z-10">
          <div className="mx-auto w-full max-w-[430px] md:max-w-[680px] lg:max-w-[800px] flex items-center gap-3">
            <Link href="/dashboard" className="p-1 text-slate-600">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg">
              <img alt="Universite logo" className="w-6 h-6 md:w-7 md:h-7 object-contain" src="/assets/images/icon-white-removebg.png" />
            </div>
            <h1 className="text-lg md:text-xl font-semibold text-slate-800 flex-1">Flashcards</h1>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 mx-auto w-full max-w-[430px] md:max-w-[680px] lg:max-w-[800px] px-4 py-4">
          {flashcards.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">📚</div>
              <h2 className="text-xl font-semibold text-slate-800 mb-2">No flashcards yet</h2>
              <p className="text-slate-600 mb-6">Generate flashcards from your lectures to start studying.</p>
              <Link
                href="/dashboard"
                className="px-6 py-3 bg-gradient-to-br from-indigo-500 to-purple-600 text-white rounded-xl font-semibold inline-block"
              >
                Go to Dashboard
              </Link>
            </div>
          ) : (
            <div className="flex flex-col items-center">
              {/* Progress */}
              <div className="w-full mb-4">
                <div className="flex justify-between text-sm text-slate-600 mb-2">
                  <span>Card {currentIndex + 1} of {flashcards.length}</span>
                  <span>{Math.round(((currentIndex + 1) / flashcards.length) * 100)}%</span>
                </div>
                <div className="w-full bg-slate-200 rounded-full h-2">
                  <div
                    className="bg-gradient-to-r from-indigo-500 to-purple-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${((currentIndex + 1) / flashcards.length) * 100}%` }}
                  ></div>
                </div>
              </div>

              {/* Flashcard */}
              <div
                className="w-full aspect-[3/2] bg-white border border-slate-200 rounded-2xl shadow-lg cursor-pointer perspective-1000 mb-6"
                onClick={handleFlip}
              >
                <div
                  className={`w-full h-full relative transition-transform duration-500 transform-style-3d ${isFlipped ? 'rotate-y-180' : ''}`}
                  style={{ transformStyle: 'preserve-3d', transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)' }}
                >
                  {/* Front */}
                  <div
                    className="absolute w-full h-full backface-hidden flex flex-col items-center justify-center p-6"
                    style={{ backfaceVisibility: 'hidden', transform: 'rotateY(0deg)' }}
                  >
                    <div className="text-4xl mb-4">❓</div>
                    <p className="text-lg font-semibold text-slate-800 text-center">
                      {flashcards[currentIndex]?.question || 'No question'}
                    </p>
                    <p className="text-xs text-slate-500 mt-4">Tap to reveal answer</p>
                  </div>

                  {/* Back */}
                  <div
                    className="absolute w-full h-full backface-hidden flex flex-col items-center justify-center p-6 bg-gradient-to-br from-indigo-50 to-purple-50"
                    style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
                  >
                    <div className="text-4xl mb-4">✅</div>
                    <p className="text-lg font-semibold text-slate-800 text-center">
                      {flashcards[currentIndex]?.answer || 'No answer'}
                    </p>
                    <p className="text-xs text-slate-500 mt-4">Tap to see question</p>
                  </div>
                </div>
              </div>

              {/* Controls */}
              <div className="flex items-center gap-4 w-full">
                <button
                  onClick={handlePrevious}
                  className="flex-1 px-4 py-3 bg-white border border-slate-200 rounded-xl font-semibold text-slate-700 hover:bg-slate-50 active:scale-95 transition-all"
                >
                  Previous
                </button>
                <button
                  onClick={handleFlip}
                  className="flex-1 px-4 py-3 bg-gradient-to-br from-indigo-500 to-purple-600 text-white rounded-xl font-semibold hover:shadow-lg active:scale-95 transition-all"
                >
                  Flip
                </button>
                <button
                  onClick={handleNext}
                  className="flex-1 px-4 py-3 bg-white border border-slate-200 rounded-xl font-semibold text-slate-700 hover:bg-slate-50 active:scale-95 transition-all"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Bottom Navigation */}
        <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 safe-area-inset-bottom z-10">
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
              <Link href="/flashcards" className="flex flex-col items-center py-2 px-4 text-indigo-600">
                <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
                <span className="text-xs font-medium">Flashcards</span>
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

export default function FlashcardsPage() {
  return <FlashcardsPageContent />;
}