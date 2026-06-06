'use client';

import React, { useState } from 'react';
import Link from 'next/link';

export default function QAInterfacePage() {
  const [selectedLecture, setSelectedLecture] = useState('');
  const [question, setQuestion] = useState('');
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [relevantSegments, setRelevantSegments] = useState<any[]>([]);
  const [generatedQA, setGeneratedQA] = useState<any[]>([]);
  const [difficultyFilter, setDifficultyFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [generateForAll, setGenerateForAll] = useState(true);
  const [includeContext, setIncludeContext] = useState(true);

  const handleAskQuestion = async () => {
    if (!question.trim() || !selectedLecture) return;

    // Add user message
    setChatMessages(prev => [...prev, { sender: 'user', message: question }]);
    setQuestion('');

    // Show loading
    setChatMessages(prev => [...prev, { sender: 'assistant', message: 'Thinking...', isLoading: true }]);

    // TODO: Call API to answer question
    setTimeout(() => {
      setChatMessages(prev => {
        const newMessages = [...prev];
        newMessages[newMessages.length - 1] = { sender: 'assistant', message: 'This is a placeholder answer. Connect to API for real responses.' };
        return newMessages;
      });
      setRelevantSegments([
        { id: 1, title: 'Segment 1', content: 'Sample relevant segment content...', time: '0:30' }
      ]);
    }, 1000);
  };

  const handleGenerateQA = async () => {
    if (!selectedLecture) return;
    setIsLoading(true);

    // TODO: Call API to generate Q&A
    setTimeout(() => {
      setGeneratedQA([
        { id: 1, question: 'What is the main topic?', answer: 'The main topic is...', difficulty: 'basic', type: 'recall', time_reference: '0:30' },
        { id: 2, question: 'How does this concept apply?', answer: 'This concept applies by...', difficulty: 'intermediate', type: 'application', time_reference: '1:45' },
      ]);
      setIsLoading(false);
    }, 2000);
  };

  const toggleAnswer = (id: number) => {
    setGeneratedQA(prev => prev.map(qa => 
      qa.id === id ? { ...qa, showAnswer: !qa.showAnswer } : qa
    ));
  };

  const filteredQA = generatedQA.filter(qa => {
    if (difficultyFilter && qa.difficulty !== difficultyFilter) return false;
    if (typeFilter && qa.type !== typeFilter) return false;
    return true;
  });

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
                <Link href="/study-mode" className="text-gray-600 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium">
                  Study Mode
                </Link>
                <Link href="/qa-interface" className="text-indigo-600 border-b-2 border-indigo-600 px-3 py-2 text-sm font-medium">
                  Q&A
                </Link>
                <Link href="/settings" className="text-gray-600 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium">
                  Settings
                </Link>
              </div>
            </div>
            <div className="flex items-center space-x-4">
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
        {/* Lecture Selection */}
        <div className="bg-white rounded-lg shadow mb-8">
          <div className="p-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Q&A Interface</h2>
                <p className="text-gray-600 mt-1">Ask questions about your lecture content or review generated Q&A</p>
              </div>
              <div className="mt-4 md:mt-0">
                <select 
                  value={selectedLecture}
                  onChange={(e) => setSelectedLecture(e.target.value)}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                >
                  <option value="">Select a lecture...</option>
                  <option value="1">Sample Lecture 1</option>
                  <option value="2">Sample Lecture 2</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Two Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Column: Q&A Chat */}
          <div className="space-y-6">
            {/* Chat Interface */}
            <div className="bg-white rounded-lg shadow">
              <div className="p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  💬 Ask Questions
                </h3>

                {/* Chat Messages */}
                <div className="h-96 overflow-y-auto mb-4 p-4 bg-gray-50 rounded-lg">
                  {chatMessages.length === 0 ? (
                    <div className="text-center text-gray-500 py-8">
                      <div className="text-4xl mb-4">❓</div>
                      <p>Select a lecture and start asking questions!</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {chatMessages.map((msg, index) => (
                        <div key={index} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                          <div className={`inline-block max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                            msg.sender === 'user' ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-800'
                          }`}>
                            {msg.message}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Question Input */}
                <div className="flex space-x-3">
                  <input
                    type="text"
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleAskQuestion()}
                    placeholder="Ask a question about the lecture..."
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    disabled={!selectedLecture}
                  />
                  <button
                    onClick={handleAskQuestion}
                    disabled={!selectedLecture || !question.trim()}
                    className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                  >
                    📤 Ask
                  </button>
                </div>
              </div>
            </div>

            {/* Relevant Segments */}
            <div className="bg-white rounded-lg shadow">
              <div className="p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  🔍 Relevant Segments
                </h3>
                <div className="space-y-3">
                  {relevantSegments.length === 0 ? (
                    <p className="text-gray-500 text-center py-4">Ask a question to see relevant segments</p>
                  ) : (
                    relevantSegments.map((segment) => (
                      <div key={segment.id} className="bg-amber-50 border-l-4 border-amber-500 p-4 rounded">
                        <div className="flex justify-between items-start mb-2">
                          <span className="font-medium text-sm">{segment.title}</span>
                          <span className="text-xs text-gray-500">{segment.time}</span>
                        </div>
                        <p className="text-sm text-gray-700">{segment.content}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Generated Q&A */}
          <div className="space-y-6">
            {/* Q&A Generation Controls */}
            <div className="bg-white rounded-lg shadow">
              <div className="p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  ✨ Generate Q&A
                </h3>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Generation Options</label>
                    <div className="space-y-2">
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={generateForAll}
                          onChange={(e) => setGenerateForAll(e.target.checked)}
                          className="mr-2"
                        />
                        <span className="text-sm">Generate for all segments</span>
                      </label>
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={includeContext}
                          onChange={(e) => setIncludeContext(e.target.checked)}
                          className="mr-2"
                        />
                        <span className="text-sm">Include lecture context</span>
                      </label>
                    </div>
                  </div>

                  <button
                    onClick={handleGenerateQA}
                    disabled={!selectedLecture || isLoading}
                    className="w-full px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                  >
                    {isLoading ? '⏳ Generating...' : '⚙️ Generate Q&A'}
                  </button>
                </div>
              </div>
            </div>

            {/* Generated Q&A List */}
            <div className="bg-white rounded-lg shadow">
              <div className="p-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">
                    📋 Generated Q&A
                  </h3>
                  <div className="flex space-x-2">
                    <select
                      value={difficultyFilter}
                      onChange={(e) => setDifficultyFilter(e.target.value)}
                      className="px-3 py-1 text-sm border border-gray-300 rounded"
                    >
                      <option value="">All Difficulties</option>
                      <option value="basic">Basic</option>
                      <option value="intermediate">Intermediate</option>
                      <option value="advanced">Advanced</option>
                    </select>
                    <select
                      value={typeFilter}
                      onChange={(e) => setTypeFilter(e.target.value)}
                      className="px-3 py-1 text-sm border border-gray-300 rounded"
                    >
                      <option value="">All Types</option>
                      <option value="recall">Recall</option>
                      <option value="application">Application</option>
                      <option value="analysis">Analysis</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-4 max-h-96 overflow-y-auto">
                  {filteredQA.length === 0 ? (
                    <p className="text-gray-500 text-center py-8">
                      <div className="text-4xl mb-4">📋</div>
                      <p>No Q&A generated yet. Select a lecture and click "Generate Q&A"</p>
                    </p>
                  ) : (
                    filteredQA.map((qa) => (
                      <div key={qa.id} className="bg-gray-50 rounded-lg p-4 hover:shadow-md transition-shadow">
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex space-x-2">
                            <span className={`text-xs px-2 py-1 rounded-full font-semibold ${
                              qa.difficulty === 'basic' ? 'bg-green-500 text-white' :
                              qa.difficulty === 'intermediate' ? 'bg-amber-500 text-white' :
                              'bg-red-500 text-white'
                            }`}>
                              {qa.difficulty}
                            </span>
                            <span className="text-xs px-2 py-1 rounded-full font-semibold bg-indigo-500 text-white">
                              {qa.type}
                            </span>
                          </div>
                          <button
                            onClick={() => toggleAnswer(qa.id)}
                            className="text-gray-400 hover:text-gray-600"
                          >
                            👁️
                          </button>
                        </div>
                        <h4 className="font-medium text-gray-900 mb-2">{qa.question}</h4>
                        {qa.showAnswer && (
                          <div className="pt-2 border-t border-gray-200">
                            <p className="text-gray-700">{qa.answer}</p>
                            {qa.time_reference && (
                              <p className="text-xs text-gray-500 mt-2">⏰ {qa.time_reference}</p>
                            )}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
