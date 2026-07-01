'use client';

// Assistant page with Gemini chat integration

import React, { useEffect, useState, useRef, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { apiPost, apiGet } from '@/lib/api/client';
import { getSession } from '@/lib/supabase/auth';
import { useRouter } from 'next/navigation';
import Alert from '../components/Alert';

function AssistantPageContent(): React.ReactNode {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialLectureId = searchParams.get('lecture');
  const initialQuery = searchParams.get('q');

  const [messages, setMessages] = useState<any[]>([]);
  const [currentLecture, setCurrentLecture] = useState<any>(null);
  const [inputValue, setInputValue] = useState('');
  const [isBotTyping, setIsBotTyping] = useState(false);

  // Alert state
  const [alertOpen, setAlertOpen] = useState(false);
  const [alertTitle, setAlertTitle] = useState('');
  const [alertMessage, setAlertMessage] = useState('');
  const [alertType, setAlertType] = useState<'error' | 'warning' | 'info' | 'success'>('info');

  const showAlert = (title: string, message: string, type: 'error' | 'warning' | 'info' | 'success' = 'info') => {
    setAlertTitle(title);
    setAlertMessage(message);
    setAlertType(type);
    setAlertOpen(true);
  };

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  const loadInitialState = async () => {
    if (initialLectureId) {
      try {
        const lecture = await apiGet(`/api/lectures/${initialLectureId}`);
        if (lecture) {
          setCurrentLecture(lecture);
          if (lecture.chatHistory) {
            setMessages(lecture.chatHistory);
          }
        }
      } catch (error) {
        console.error('Error loading lecture:', error);
      }
    }

    if (initialQuery) {
      setInputValue(initialQuery);
    }
  };

  useEffect(() => {
    loadInitialState();
  }, [initialLectureId, initialQuery]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isBotTyping]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const query = inputValue.trim();
    if (!query || isBotTyping) return;

    const userMsg = { sender: 'user', content: query, timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInputValue('');
    setIsBotTyping(true);

    try {
      const aiResponse = await getContextAwareResponse(query, newMessages);
      const botMsg = { sender: 'bot', content: aiResponse, timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) };
      setMessages((prev) => [...prev, botMsg]);
    } catch (error) {
      console.error(error);
      setMessages((prev) => [
        ...prev,
        { sender: 'bot', content: 'Sorry, I encountered an error. Please try again.', timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }
      ]);
    } finally {
      setIsBotTyping(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  };

  const getContextAwareResponse = async (query: string, currentHistory: any[]) => {
    try {
      const response = await apiPost('/api/chat', {
        message: query,
        currentLecture: currentLecture,
        messages: currentHistory.map((m) => ({ sender: m.sender, content: m.content }))
      });

      if (response.success && response.response) {
        return response.response;
      }
      return 'No response content.';
    } catch (e: any) {
      console.error(e);
      if (currentLecture) {
        return `Sorry, I encountered an error processing your request. Please ensure the backend is running. Error: ${e.message}`;
      }
      return "I don't have any lecture context yet. Please select a lecture from the dashboard to chat about it.";
    }
  };

  return (
    <div className="bg-slate-50 h-screen overflow-hidden font-sans flex flex-col justify-between">
      <div id="app" className="flex-1 overflow-hidden flex flex-col mx-auto w-full max-w-[430px] md:max-w-[680px] lg:max-w-[800px]">
        {/* Header */}
        <div className="bg-white border-b border-slate-200 px-4 py-6 md:py-8 sticky top-0 z-10">
          <div className="mx-auto w-full max-w-[430px] md:max-w-[680px] lg:max-w-[800px]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg">
                <img alt="Universite logo" className="w-6 h-6 md:w-7 md:h-7 object-contain" src="/assets/images/icon-white-removebg.png" />
              </div>
              <h1 className="text-lg md:text-xl font-semibold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                Tutor
              </h1>
            </div>
          </div>
        </div>

        {/* Message Area */}
        <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4 pb-24 scrollbar-none">
          {messages.length === 0 ? (
            <div id="welcome-message" className="flex flex-col items-center justify-center h-full text-center px-4">
              <div className="w-16 h-16 md:w-20 md:h-20 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center mb-4 shadow-lg">
                <img src="/assets/images/icon-white-removebg.png" alt="Universite logo" className="w-8 h-8 md:w-10 md:h-10 object-contain" />
              </div>
              <h2 className="text-xl md:text-2xl font-bold text-slate-800 mb-2">
                Chat with your lectures
              </h2>
              <p className="text-sm md:text-base text-slate-600 max-w-md mb-6">
                Use the "Ask AI" button on any lecture to start asking questions about the content.
              </p>
              <Link
                href="/dashboard"
                className="px-6 py-2.5 bg-gradient-to-br from-indigo-500 to-purple-600 text-white rounded-xl font-medium shadow-md active:scale-95 transition-transform"
              >
                Go to Dashboard
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((msg, index) => {
                const isUser = msg.sender === 'user';
                return (
                  <div key={index} className={`flex items-start gap-3 ${isUser ? 'flex-row-reverse' : ''} animate-fade-in`}>
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                      isUser ? 'bg-indigo-100' : 'bg-gradient-to-br from-indigo-500 to-purple-600'
                    }`}>
                      {isUser ? (
                        <svg className="w-5 h-5 text-indigo-600" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                        </svg>
                      ) : (
                        <img src="/assets/images/icon-white-removebg.png" alt="Universite AI Assistant" className="w-6 h-6" />
                      )}
                    </div>

                    <div className={`flex-1 max-w-[75%] md:max-w-[80%]`}>
                      <div className={`p-4 rounded-2xl text-sm leading-relaxed ${
                        isUser 
                          ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-tr-sm' 
                          : 'bg-slate-100 text-slate-700 rounded-tl-sm'
                      }`}>
                        <div className="whitespace-pre-wrap break-words">{msg.content}</div>
                      </div>
                      {msg.timestamp && (
                        <span className={`text-[10px] text-slate-400 mt-1 px-1 block ${isUser ? 'text-right' : ''}`}>{msg.timestamp}</span>
                      )}
                    </div>
                  </div>
                );
              })}

              {isBotTyping && (
                <div className="flex items-start gap-3 animate-fade-in">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center flex-shrink-0">
                    <img src="/assets/images/icon-white-removebg.png" alt="Universite AI Assistant" className="w-6 h-6" />
                  </div>
                  <div className="bg-slate-100 rounded-2xl rounded-tl-sm p-4 flex-1">
                    <div className="flex gap-1">
                      <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                      <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                      <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="fixed bottom-16 left-0 right-0 bg-white border-t border-slate-200 px-4 py-3 safe-area-inset-bottom z-10">
          <div className="mx-auto w-full max-w-[430px] md:max-w-[680px] lg:max-w-[800px]">
            <form onSubmit={handleSend} className="flex gap-2 items-end">
              <div className="flex-1 relative flex items-center bg-slate-50 border-2 border-slate-200 rounded-2xl px-4 py-2 focus-within:border-indigo-500 transition-all">
                <textarea
                  ref={inputRef}
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  placeholder="Ask about your lecture..."
                  rows={1}
                  className="flex-1 border-none bg-transparent outline-none resize-none text-sm text-slate-800 placeholder-slate-400 min-h-[24px] max-h-[80px]"
                />
              </div>
              <button
                type="submit"
                disabled={!inputValue.trim() || isBotTyping}
                className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center shadow-md active:scale-95 disabled:opacity-50 transition-all flex-shrink-0"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 11l5-5m0 0l5 5m-5-5v12" />
                </svg>
              </button>
            </form>
          </div>
        </div>

        {/* Bottom Navigation */}
        <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 safe-area-inset-bottom z-40">
          <div className="mx-auto w-full max-w-[430px] md:max-w-[680px] lg:max-w-[800px]">
            <div className="flex items-center justify-around py-2">
              <Link href="/dashboard" className="flex flex-col items-center py-2 px-4 text-slate-400 hover:text-slate-600">
                <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
                </svg>
                <span className="text-xs font-medium">Home</span>
              </Link>
              <Link href="/lectures" className="flex flex-col items-center py-2 px-4 text-slate-400 hover:text-slate-600">
                <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
                <span className="text-xs font-medium">Lectures</span>
              </Link>
              <button disabled className="flex flex-col items-center py-2 px-4 text-slate-400 cursor-not-allowed opacity-50">
                <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                <span className="text-xs font-medium">Notifications</span>
              </button>
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

      {/* Alert Modal */}
      <Alert
        isOpen={alertOpen}
        onClose={() => setAlertOpen(false)}
        title={alertTitle}
        message={alertMessage}
        type={alertType}
      />
    </div>
  );
}

function AssistantPageWithSuspense() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-4 border-indigo-600 border-t-transparent"></div>
      </div>
    }>
      <AssistantPageContent />
    </Suspense>
  );
}

export default function AssistantPage() {
  return <AssistantPageWithSuspense />;
}