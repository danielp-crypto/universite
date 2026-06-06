'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';

export default function StudyModePage() {
  const [studyStreak, setStudyStreak] = useState(0);
  const [totalCards, setTotalCards] = useState(0);
  const [masteredCards, setMasteredCards] = useState(0);
  const [dueToday, setDueToday] = useState(0);
  const [avgMastery, setAvgMastery] = useState(0);
  const [sessionActive, setSessionActive] = useState(false);
  const [sessionComplete, setSessionComplete] = useState(false);
  const [flipped, setFlipped] = useState(false);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [sessionCards, setSessionCards] = useState<any[]>([]);
  const [currentCard, setCurrentCard] = useState<any>(null);

  const flipCard = () => {
    setFlipped(!flipped);
  };

  const startSession = () => {
    // TODO: Load flashcards from API
    setSessionActive(true);
    setSessionComplete(false);
  };

  const rateCard = (rating: number) => {
    // TODO: Update card progress
    setCurrentCardIndex((prev) => prev + 1);
    setFlipped(false);

    if (currentCardIndex + 1 >= sessionCards.length) {
      setSessionComplete(true);
      setSessionActive(false);
    } else {
      setCurrentCard(sessionCards[currentCardIndex + 1]);
    }
  };

  return (
    <div className="bg-gray-50 min-h-screen">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <Link href="/home" className="text-indigo-600 hover:text-indigo-700 font-semibold text-lg flex items-center gap-2">
                <img src="/assets/images/icon-removebg-preview.png-128x128.png" alt="Universite" className="w-5 h-5" />
                Universite
              </Link>
              <div className="ml-8 hidden md:flex">
                <Link href="/lectures" className="text-gray-600 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium">
                  Lectures
                </Link>
                <Link href="/study-mode" className="text-indigo-600 border-b-2 border-indigo-600 px-3 py-2 text-sm font-medium">
                  Study Mode
                </Link>
                <Link href="/settings" className="text-gray-600 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium">
                  Settings
                </Link>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="text-sm text-gray-600">
                <span className="text-orange-500">🔥</span>
                <span>{studyStreak}</span> day streak
              </div>
              <button className="flex items-center text-sm">
                <div className="w-8 h-8 bg-indigo-600 rounded-full flex items-center justify-center text-white">
                  👤
                </div>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Study Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0 bg-blue-100 rounded-lg p-3">
                <span className="text-blue-600">📚</span>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Cards</p>
                <p className="text-2xl font-semibold text-gray-900">{totalCards}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0 bg-green-100 rounded-lg p-3">
                <span className="text-green-600">✓</span>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Mastered</p>
                <p className="text-2xl font-semibold text-gray-900">{masteredCards}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0 bg-yellow-100 rounded-lg p-3">
                <span className="text-yellow-600">⏰</span>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Due Today</p>
                <p className="text-2xl font-semibold text-gray-900">{dueToday}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0 bg-purple-100 rounded-lg p-3">
                <span className="text-purple-600">📈</span>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Avg Mastery</p>
                <p className="text-2xl font-semibold text-gray-900">{avgMastery.toFixed(1)}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Study Controls */}
        <div className="bg-white rounded-lg shadow mb-8">
          <div className="p-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Study Session</h2>
                <p className="text-gray-600 mt-1">Review your flashcards with spaced repetition</p>
              </div>
              <div className="mt-4 md:mt-0 flex space-x-3">
                <select className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500">
                  <option value="">All Lectures</option>
                </select>
                <select className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500">
                  <option value="">All Difficulties</option>
                  <option value="easy">Easy</option>
                  <option value="medium">Medium</option>
                  <option value="hard">Hard</option>
                </select>
                <button
                  onClick={startSession}
                  className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                >
                  ▶️ Start Session
                </button>
              </div>
            </div>

            {/* Session Progress */}
            {sessionActive && (
              <div className="mt-6">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium text-gray-700">Session Progress</span>
                  <span className="text-sm text-gray-600">{currentCardIndex} / {sessionCards.length} cards</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-indigo-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${(currentCardIndex / sessionCards.length) * 100}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Flashcard Study Area */}
        {sessionActive && currentCard && (
          <div className="bg-white rounded-lg shadow mb-8">
            <div className="p-8">
              <div className="max-w-2xl mx-auto">
                {/* Card Counter */}
                <div className="text-center mb-6">
                  <span className="text-sm text-gray-600">Card {currentCardIndex + 1} of {sessionCards.length}</span>
                </div>

                {/* Flashcard */}
                <div className="relative h-96 mb-8">
                  <div
                    onClick={flipCard}
                    className={`w-full h-full cursor-pointer transition-transform duration-500 ${flipped ? 'rotate-y-180' : ''}`}
                    style={{ transformStyle: 'preserve-3d' }}
                  >
                    {/* Front */}
                    <div
                      className={`absolute w-full h-full rounded-xl flex items-center justify-center p-8 ${flipped ? 'opacity-0' : 'opacity-100'}`}
                      style={{
                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                        color: 'white',
                        backfaceVisibility: 'hidden'
                      }}
                    >
                      <div className="text-center">
                        <div className="mb-4">
                          <span className="inline-block px-3 py-1 bg-white bg-opacity-20 rounded-full text-sm">
                            🏷️ {currentCard.type || 'Concept'}
                          </span>
                        </div>
                        <h3 className="text-xl font-medium leading-relaxed">{currentCard.front}</h3>
                        <div className="mt-4 text-sm opacity-75">
                          ⏰ {currentCard.time_reference || '0:00'}
                        </div>
                      </div>
                    </div>

                    {/* Back */}
                    <div
                      className={`absolute w-full h-full rounded-xl flex items-center justify-center p-8 ${flipped ? 'opacity-100' : 'opacity-0'}`}
                      style={{
                        background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
                        color: 'white',
                        backfaceVisibility: 'hidden',
                        transform: 'rotateY(180deg)'
                      }}
                    >
                      <div className="text-center">
                        <div className="mb-4">
                          <span className="inline-block px-3 py-1 bg-white bg-opacity-20 rounded-full text-sm">
                            💡 Answer
                          </span>
                        </div>
                        <p className="text-lg leading-relaxed">{currentCard.back}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Rating Buttons */}
                <div className="flex justify-center space-x-4">
                  <button
                    onClick={() => rateCard(1)}
                    className="px-6 py-3 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-all"
                  >
                    🔄 Again
                  </button>
                  <button
                    onClick={() => rateCard(2)}
                    className="px-6 py-3 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-all"
                  >
                    🧠 Hard
                  </button>
                  <button
                    onClick={() => rateCard(3)}
                    className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-all"
                  >
                    ✓ Good
                  </button>
                  <button
                    onClick={() => rateCard(4)}
                    className="px-6 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-all"
                  >
                    ⭐ Easy
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Session Complete */}
        {sessionComplete && (
          <div className="bg-white rounded-lg shadow">
            <div className="p-8 text-center">
              <div className="mb-6">
                <span className="text-6xl">🏆</span>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Session Complete!</h2>
              <p className="text-gray-600 mb-8">Great job studying today! Here's your progress:</p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-2xl mx-auto">
                <div className="text-center">
                  <p className="text-3xl font-bold text-indigo-600">{currentCardIndex}</p>
                  <p className="text-gray-600">Cards Studied</p>
                </div>
                <div className="text-center">
                  <p className="text-3xl font-bold text-green-600">{Math.floor(currentCardIndex * 0.7)}</p>
                  <p className="text-gray-600">Good/Easy</p>
                </div>
                <div className="text-center">
                  <p className="text-3xl font-bold text-purple-600">{avgMastery.toFixed(1)}</p>
                  <p className="text-gray-600">Avg Mastery</p>
                </div>
              </div>

              <div className="mt-8 flex justify-center space-x-4">
                <button
                  onClick={startSession}
                  className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                >
                  ➕ New Session
                </button>
                <Link href="/home" className="px-6 py-3 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300">
                  🏠 Home
                </Link>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
