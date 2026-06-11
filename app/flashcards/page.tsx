'use client';

import React, { useEffect, useState, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { apiGet, apiPut } from '@/lib/api/client';
import { getSession } from '@/lib/supabase/auth';
import { useRouter } from 'next/navigation';

function FlashcardsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const lectureId = searchParams.get('lecture');

  const [flashcardSet, setFlashcardSet] = useState<any>(null);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [allSets, setAllSets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadFlashcards = async () => {
    try {
      const session = await getSession();
      if (!session) {
        router.push('/login');
        return;
      }

      let targetSet: any = null;

      if (lectureId) {
        try {
          targetSet = await apiGet(`/api/lectures/${lectureId}/flashcards`);
          if (!targetSet) {
            // Fallback to generating mock flashcards
            const lecture = await apiGet(`/api/lectures/${lectureId}`);
            if (lecture) {
              const mockCards = [
                { question: `What are the key concepts in "${lecture.title}"?`, answer: (lecture.keyConcepts || []).join(', '), category: 'Overview', status: 'new' },
                ...(lecture.segments || []).flatMap((seg: any) => (seg.concepts || []).map((concept: any) => ({
                  question: `Explain ${concept} from ${seg.title}`,
                  answer: `This concept was discussed in the "${seg.title}" segment of the lecture.`,
                  category: seg.title,
                  status: 'new'
                })))
              ];
              targetSet = { id: lectureId, lectureTitle: lecture.title, flashcards: mockCards, progress: { mastered: 0, learning: 0, new: mockCards.length } };
            }
          }
        } catch (error) {
          console.error('Error loading flashcards:', error);
        }
      } else {
        // Load first set if available
        try {
          const sets = await apiGet('/api/flashcards');
          if (sets && sets.length > 0) {
            targetSet = sets[0];
          }
        } catch (error) {
          console.error('Error loading flashcard sets:', error);
        }
      }

      setFlashcardSet(targetSet);
      setAllSets([]);
    } catch (error) {
      console.error('Error loading flashcards:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFlashcards();
  }, [lectureId]);

  const handleFlip = () => {
    setIsFlipped(!isFlipped);
  };

  const handleRate = async (rating: 'hard' | 'good' | 'easy') => {
    if (!flashcardSet) return;

    const statusMap = {
      hard: 'new',
      good: 'learning',
      easy: 'mastered'
    };

    const status = statusMap[rating];
    const updatedCards = [...flashcardSet.flashcards];
    updatedCards[currentCardIndex].status = status;

    try {
      await apiPut(`/api/flashcards/${flashcardSet.id}/cards/${currentCardIndex}`, { status });
    } catch (error) {
      console.error('Error updating flashcard progress:', error);
    }

    // Recalculate progress locally
    const progress = updatedCards.reduce((acc, c) => {
      if (c.status === 'mastered') acc.mastered++;
      else if (c.status === 'learning') acc.learning++;
      else acc.new++;
      return acc;
    }, { mastered: 0, learning: 0, new: 0 });

    setFlashcardSet({
      ...flashcardSet,
      flashcards: updatedCards,
      progress
    });

    // Move to next card
    setIsFlipped(false);
    setTimeout(() => {
      setCurrentCardIndex((prev) => (prev + 1) % updatedCards.length);
    }, 150);
  };

  const handleGoToCard = (index: number) => {
    setIsFlipped(false);
    setTimeout(() => {
      setCurrentCardIndex(index);
    }, 150);
  };

  const currentCard = flashcardSet?.flashcards?.[currentCardIndex];
  const progress = flashcardSet?.progress || { mastered: 0, learning: 0, new: 0 };
  const total = flashcardSet?.flashcards?.length || 0;
  const progressPercent = total > 0 ? ((progress.mastered + progress.learning) / total) * 100 : 0;

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
          {flashcardSet ? (
            <>
              {/* Set Title */}
              <div className="bg-white border border-slate-200 rounded-2xl p-4 mb-4 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h2 className="text-lg font-bold text-slate-800">
                      {flashcardSet.lectureTitle || 'Study Set'}
                    </h2>
                    <p className="text-xs text-slate-500">{total} cards in this set</p>
                  </div>
                </div>
              </div>

              {/* Progress Summary */}
              <div className="bg-white border border-slate-200 rounded-2xl p-4 mb-4 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-slate-700">Progress</span>
                  <span className="text-xs text-slate-500">{progress.mastered + progress.learning} / {total}</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2">
                  <div
                    className="bg-gradient-to-r from-indigo-500 to-purple-600 h-2 rounded-full transition-all"
                    style={{ width: `${progressPercent}%` }}
                  ></div>
                </div>
                <div className="grid grid-cols-3 gap-2 mt-4 text-center">
                  <div>
                    <div className="text-lg font-bold text-green-600">{progress.mastered}</div>
                    <div className="text-[10px] text-slate-500">Mastered</div>
                  </div>
                  <div>
                    <div className="text-lg font-bold text-amber-500">{progress.learning}</div>
                    <div className="text-[10px] text-slate-500">Learning</div>
                  </div>
                  <div>
                    <div className="text-lg font-bold text-slate-400">{progress.new}</div>
                    <div className="text-[10px] text-slate-500">New</div>
                  </div>
                </div>
              </div>

              {/* Card Container */}
              {currentCard && (
                <div className="mb-6">
                  {/* CSS perspective and 3D flip wrapper */}
                  <div
                    onClick={handleFlip}
                    className="relative cursor-pointer h-72 w-full transition-transform duration-500 active:scale-95"
                    style={{ perspective: '1000px' }}
                  >
                    <div
                      className={`relative w-full h-full text-center duration-500`}
                      style={{
                        transformStyle: 'preserve-3d',
                        transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
                      }}
                    >
                      {/* Front Card */}
                      <div
                        className="absolute w-full h-full bg-white border border-slate-200 rounded-2xl flex items-center justify-center p-6"
                        style={{ backfaceVisibility: 'hidden' }}
                      >
                        <div>
                          <div className="text-[10px] uppercase tracking-wide text-slate-400 font-semibold mb-2">Question</div>
                          <div className="text-base font-semibold text-slate-800">{currentCard.question}</div>
                        </div>
                      </div>

                      {/* Back Card */}
                      <div
                        className="absolute w-full h-full bg-gradient-to-br from-indigo-600 to-purple-600 text-white rounded-2xl flex items-center justify-center p-6"
                        style={{
                          backfaceVisibility: 'hidden',
                          transform: 'rotateY(180deg)',
                        }}
                      >
                        <div>
                          <div className="text-[10px] uppercase tracking-wide text-white/70 font-semibold mb-2">Answer</div>
                          <div className="text-sm">{currentCard.answer}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="text-center mt-3 text-xs text-slate-500">
                    Card {currentCardIndex + 1} of {total} • Tap card to flip
                  </div>
                </div>
              )}

              {/* Rating Buttons */}
              <div className="flex gap-3 mb-6">
                <button
                  onClick={() => handleRate('hard')}
                  className="flex-1 px-4 py-3 bg-red-50 hover:bg-red-100 text-red-700 rounded-xl font-semibold text-sm active:scale-95 transition-transform"
                >
                  Hard
                </button>
                <button
                  onClick={() => handleRate('good')}
                  className="flex-1 px-4 py-3 bg-amber-50 hover:bg-amber-100 text-amber-600 rounded-xl font-semibold text-sm active:scale-95 transition-transform"
                >
                  Good
                </button>
                <button
                  onClick={() => handleRate('easy')}
                  className="flex-1 px-4 py-3 bg-green-50 hover:bg-green-100 text-green-700 rounded-xl font-semibold text-sm active:scale-95 transition-transform"
                >
                  Easy
                </button>
              </div>

              {/* Cards List */}
              <div>
                <h3 className="text-base font-bold text-slate-800 mb-3">All Cards</h3>
                <div className="space-y-2">
                  {flashcardSet.flashcards.map((card: any, idx: number) => {
                    const badgeColor =
                      card.status === 'mastered'
                        ? 'bg-green-100 text-green-700'
                        : card.status === 'learning'
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-slate-100 text-slate-500';

                    return (
                      <div
                        key={idx}
                        onClick={() => handleGoToCard(idx)}
                        className={`bg-white border rounded-xl p-4 cursor-pointer hover:bg-slate-50 transition-colors ${
                          idx === currentCardIndex ? 'border-indigo-500 ring-2 ring-indigo-100' : 'border-slate-200'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1">
                            <div className="text-sm font-semibold text-slate-800 mb-1">{card.question}</div>
                            <div className="text-[10px] text-slate-500 font-medium">{card.category || 'General'}</div>
                          </div>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${badgeColor}`}>
                            {card.status || 'new'}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          ) : (
            <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center shadow-sm">
              <p className="text-slate-600 mb-4 text-sm">No flashcards available yet.</p>
              <p className="text-xs text-slate-500 mb-6">Record or upload a lecture to generate study cards.</p>
              <Link
                href="/assistant"
                className="inline-block px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold active:scale-95"
              >
                Go to Assistant
              </Link>
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
                <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
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

function FlashcardsPageWithSuspense() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-4 border-indigo-600 border-t-transparent"></div>
      </div>
    }>
      <FlashcardsPageContent />
    </Suspense>
  );
}

export default function FlashcardsPage() {
  return <FlashcardsPageWithSuspense />;
}
