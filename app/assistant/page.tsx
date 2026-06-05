'use client';

import React, { useEffect, useState, useRef, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import ClientLoader from '../components/ClientLoader';

function AssistantPageContent() {
  const searchParams = useSearchParams();
  const initialLectureId = searchParams.get('lecture');
  const initialQuery = searchParams.get('q');

  const [messages, setMessages] = useState<any[]>([]);
  const [currentLecture, setCurrentLecture] = useState<any>(null);
  const [recordingState, setRecordingState] = useState<'idle' | 'recording' | 'processing'>('idle');
  const [recordingTimer, setRecordingTimer] = useState('00:00');
  const [processingText, setProcessingText] = useState('Generating transcript...');
  const [inputValue, setInputValue] = useState('');
  const [isBotTyping, setIsBotTyping] = useState(false);

  const mediaRecorderRef = useRef<any>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingStartTimeRef = useRef<number | null>(null);
  const recordingTimerIntervalRef = useRef<any>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  const RECORDINGS_STORAGE_KEY = 'universite_recordings';

  // Helper to load recordings
  const getRecordings = () => {
    try {
      const recordings = localStorage.getItem(RECORDINGS_STORAGE_KEY);
      return recordings ? JSON.parse(recordings) : [];
    } catch (e) {
      return [];
    }
  };

  const loadInitialState = () => {
    if (initialLectureId && typeof (window as any).appState !== 'undefined') {
      const lecture = (window as any).appState.getLecture(initialLectureId);
      if (lecture) {
        setCurrentLecture(lecture);
        if (lecture.chatHistory) {
          setMessages(lecture.chatHistory);
        }
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

    // Save to lecture if exists
    if (currentLecture && typeof (window as any).appState !== 'undefined') {
      const chatHistory = currentLecture.chatHistory || [];
      chatHistory.push({ sender: 'user', content: query });
      (window as any).appState.updateLecture(currentLecture.id, { chatHistory });
    }

    try {
      const aiResponse = await getContextAwareResponse(query, newMessages);
      const botMsg = { sender: 'bot', content: aiResponse, timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) };
      setMessages((prev) => [...prev, botMsg]);

      // Save to lecture if exists
      if (currentLecture && typeof (window as any).appState !== 'undefined') {
        const chatHistory = currentLecture.chatHistory || [];
        chatHistory.push({ sender: 'bot', content: aiResponse });
        (window as any).appState.updateLecture(currentLecture.id, { chatHistory });
      }
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
      const token = await (window as any).UniSupabase.getAccessToken();
      if (!token) return 'Please sign in again.';

      const API_BASE_URL = (window as any).UniversiteConfig.getConfig().BACKEND.URL;
      const response = await fetch(`${API_BASE_URL}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          message: query,
          currentLecture: currentLecture,
          messages: currentHistory.map((m) => ({ sender: m.sender, content: m.content }))
        })
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        if (response.status === 402) {
          return "You reached your monthly quota for this feature.";
        }
        throw new Error(errData.error || 'Failed to get response from server');
      }

      const data = await response.json();
      return data.success && data.response ? data.response : 'No response content.';
    } catch (e: any) {
      console.error(e);
      if (currentLecture) {
        return `Sorry, I encountered an error processing your request. Please ensure the backend is running. Error: ${e.message}`;
      }
      return "I don't have any lecture context yet. Record or upload a lecture to get started!";
    }
  };

  // Recording Functionalities
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (event: any) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorderRef.current.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        stream.getTracks().forEach(track => track.stop());
        await processRecording(audioBlob);
      };

      mediaRecorderRef.current.start();
      setRecordingState('recording');
      recordingStartTimeRef.current = Date.now();
      
      recordingTimerIntervalRef.current = setInterval(() => {
        if (recordingStartTimeRef.current) {
          const elapsed = Math.floor((Date.now() - recordingStartTimeRef.current) / 1000);
          const minutes = Math.floor(elapsed / 60);
          const seconds = elapsed % 60;
          setRecordingTimer(`${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`);
        }
      }, 1000);
    } catch (error) {
      console.error(error);
      alert('Microphone access denied.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && recordingState === 'recording') {
      mediaRecorderRef.current.stop();
      setRecordingState('processing');
      if (recordingTimerIntervalRef.current) {
        clearInterval(recordingTimerIntervalRef.current);
        recordingTimerIntervalRef.current = null;
      }
    }
  };

  const cancelRecording = () => {
    if (mediaRecorderRef.current && recordingState === 'recording') {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach((track: any) => track.stop());
    }
    setRecordingState('idle');
    audioChunksRef.current = [];
    if (recordingTimerIntervalRef.current) {
      clearInterval(recordingTimerIntervalRef.current);
      recordingTimerIntervalRef.current = null;
    }
  };

  const processRecording = async (blob: Blob) => {
    setProcessingText('Uploading audio...');
    const token = await (window as any).UniSupabase.getAccessToken();
    if (!token) {
      window.location.href = '/login';
      return;
    }

    try {
      const formData = new FormData();
      formData.append('audio', blob, 'recording.webm');
      
      setProcessingText('Generating transcript...');
      const API_BASE_URL = (window as any).UniversiteConfig.getConfig().BACKEND.URL;
      const res = await fetch(`${API_BASE_URL}/api/transcribe`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });
      
      const data = await res.json().catch(() => ({}));
      
      if (res.ok && data.success && data.transcript) {
        createLectureFromTranscript(blob, data.transcript);
        return;
      }

      alert('API transcription failed, saving mock local lecture instead.');
      createMockLecture(blob);
    } catch (error) {
      console.error(error);
      createMockLecture(blob);
    }
  };

  const createMockLecture = (blob: Blob) => {
    const elapsed = recordingStartTimeRef.current ? Math.floor((Date.now() - recordingStartTimeRef.current) / 1000) : 0;
    const mins = Math.floor(elapsed / 60);
    const secs = elapsed % 60;
    const duration = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

    const lecture = {
      id: Date.now().toString(),
      title: `Lecture Recording - ${new Date().toLocaleDateString()}`,
      date: new Date().toLocaleDateString(),
      duration: duration,
      segments: [{ id: '1', title: 'Introduction', startTime: '00:00', concepts: ['intro'] }],
      keyConcepts: ['lecture', 'recording'],
      transcript: 'Mock transcript content.',
      audioUrl: URL.createObjectURL(blob),
      createdAt: new Date().toISOString()
    };

    if (typeof (window as any).appState !== 'undefined') {
      (window as any).appState.addLecture(lecture);
    }

    setCurrentLecture(lecture);
    setRecordingState('idle');
  };

  const createLectureFromTranscript = (blob: Blob, transcript: string) => {
    const elapsed = recordingStartTimeRef.current ? Math.floor((Date.now() - recordingStartTimeRef.current) / 1000) : 0;
    const mins = Math.floor(elapsed / 60);
    const secs = elapsed % 60;
    const duration = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

    const lecture = {
      id: Date.now().toString(),
      title: `Lecture Recording - ${new Date().toLocaleDateString()}`,
      date: new Date().toLocaleDateString(),
      duration: duration,
      transcript: transcript,
      audioUrl: URL.createObjectURL(blob),
      createdAt: new Date().toISOString(),
      segments: [],
      keyConcepts: ['recording']
    };

    if (typeof (window as any).appState !== 'undefined') {
      (window as any).appState.addLecture(lecture);
    }

    setCurrentLecture(lecture);
    setRecordingState('idle');
  };

  const uploadRecording = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.mp3,.mp4,.wav';
    input.onchange = async (e: any) => {
      const file = e.target.files[0];
      if (file) {
        setRecordingState('processing');
        setProcessingText('Uploading audio...');
        try {
          const token = await (window as any).UniSupabase.getAccessToken();
          if (!token) {
            window.location.href = '/login';
            return;
          }

          const formData = new FormData();
          formData.append('audio', file);
          
          setProcessingText('Generating transcript...');
          const API_BASE_URL = (window as any).UniversiteConfig.getConfig().BACKEND.URL;
          const res = await fetch(`${API_BASE_URL}/api/transcribe`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` },
            body: formData
          });

          const data = await res.json().catch(() => ({}));
          if (res.ok && data.success && data.transcript) {
            createLectureFromTranscript(file, data.transcript);
            return;
          }
          alert('Transcription failed');
          setRecordingState('idle');
        } catch (error) {
          console.error(error);
          alert('Upload failed');
          setRecordingState('idle');
        }
      }
    };
    input.click();
  };

  return (
    <div className="bg-slate-50 h-screen overflow-hidden font-sans flex flex-col justify-between">
      <div id="app" className="flex-1 overflow-hidden flex flex-col mx-auto w-full max-w-[430px] md:max-w-[680px] lg:max-w-[800px]">
        {/* Header */}
        <div className="bg-white border-b border-slate-200 px-4 py-3 md:py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/assets/images/icon-removebg-preview.png-128x128.png" alt="Universite" className="w-6 h-6 md:w-7 md:h-7" />
            <h1 className="text-lg md:text-xl font-semibold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
              Universite Chat
            </h1>
          </div>
          <button
            onClick={() => recordingState === 'idle' ? startRecording() : null}
            className="p-2 text-slate-600 hover:text-indigo-600 transition-colors active:scale-95"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            </svg>
          </button>
        </div>

        {/* Message Area */}
        <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4 pb-24 scrollbar-none">
          {messages.length === 0 ? (
            <div id="welcome-message" className="flex flex-col items-center justify-center h-full text-center px-4">
              <div className="w-16 h-16 md:w-20 md:h-20 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center mb-4 shadow-lg">
                <img src="/assets/images/icon-white-removebg.png" alt="Universite logo" className="w-8 h-8 md:w-10 md:h-10 object-contain" />
              </div>
              <h2 className="text-xl md:text-2xl font-bold text-slate-800 mb-2">
                Record a lecture to get started
              </h2>
              <p className="text-sm md:text-base text-slate-600 max-w-md mb-6">
                Record or upload a lecture recording to generate transcripts, summaries, and study materials.
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={startRecording}
                  className="px-6 py-2.5 bg-gradient-to-br from-indigo-500 to-purple-600 text-white rounded-xl font-medium shadow-md active:scale-95 transition-transform"
                >
                  Record Lecture
                </button>
                <button
                  onClick={uploadRecording}
                  className="px-6 py-2.5 bg-white text-slate-700 border-2 border-slate-200 rounded-xl font-medium active:scale-95 transition-transform"
                >
                  Upload Recording
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((msg, index) => {
                const isUser = msg.sender === 'user';
                return (
                  <div key={index} className={`flex gap-3 ${isUser ? 'flex-row-reverse' : ''} animate-fade-in`}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                      isUser ? 'bg-gradient-to-br from-indigo-500 to-purple-600 text-white' : 'bg-slate-100 text-indigo-600 border border-slate-200'
                    }`}>
                      {isUser ? (
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                        </svg>
                      ) : (
                        <img src="/assets/images/icon-removebg-preview.png-128x128.png" alt="Universite" className="w-4 h-4 object-contain" />
                      )}
                    </div>

                    <div className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} max-w-[75%] md:max-w-[80%]`}>
                      <div className={`px-4 py-3 rounded-2xl shadow-sm text-sm leading-relaxed ${
                        isUser ? 'bg-indigo-600 text-white rounded-tr-none' : 'bg-white text-slate-800 border border-slate-200 rounded-tl-none'
                      }`}>
                        <div className="whitespace-pre-wrap break-words">{msg.content}</div>
                      </div>
                      {msg.timestamp && (
                        <span className="text-[10px] text-slate-400 mt-1 px-1">{msg.timestamp}</span>
                      )}
                    </div>
                  </div>
                );
              })}

              {isBotTyping && (
                <div className="flex gap-3 animate-fade-in">
                  <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0 border border-slate-200">
                    <img src="/assets/images/icon-removebg-preview.png-128x128.png" alt="Universite" className="w-4 h-4 object-contain" />
                  </div>
                  <div className="bg-white border border-slate-200 rounded-2xl rounded-tl-none px-4 py-3 shadow-sm flex items-center gap-1">
                    <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-typing-dot"></div>
                    <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-typing-dot animation-delay-200"></div>
                    <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-typing-dot animation-delay-400"></div>
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
              <div className="flex-1 relative flex items-center bg-slate-50 border-2 border-slate-200 rounded-2xl px-4 py-2 pr-10 focus-within:border-indigo-500 transition-all">
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
                <button
                  type="button"
                  onClick={uploadRecording}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-indigo-600 transition-colors"
                  title="Attach lecture"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                  </svg>
                </button>
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
              <Link href="/home" className="flex flex-col items-center py-2 px-4 text-slate-400 hover:text-slate-600">
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
              <Link href="/assistant" className="flex flex-col items-center py-2 px-4 text-indigo-600">
                <svg className="w-6 h-6 mb-1" fill="currentColor" viewBox="0 0 20 20">
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

      {/* Recording Overlay */}
      {recordingState === 'recording' && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
          <div className="bg-white rounded-2xl p-6 mx-4 max-w-sm w-full shadow-2xl">
            <div className="text-center">
              <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-red-100 flex items-center justify-center animate-pulse-recording">
                <div className="w-12 h-12 rounded-full bg-red-500"></div>
              </div>
              <h3 className="text-xl font-semibold text-slate-800 mb-2">Recording</h3>
              <div className="text-2xl font-mono text-slate-700 mb-4">{recordingTimer}</div>
              <div className="flex gap-3">
                <button
                  onClick={stopRecording}
                  className="flex-1 px-4 py-3 bg-red-500 text-white rounded-xl font-medium active:scale-95 transition-transform"
                >
                  Stop
                </button>
                <button
                  onClick={cancelRecording}
                  className="flex-1 px-4 py-3 bg-slate-200 text-slate-700 rounded-xl font-medium active:scale-95 transition-transform"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Processing Overlay */}
      {recordingState === 'processing' && (
        <div className="fixed inset-0 bg-black/55 z-50 flex items-center justify-center">
          <div className="bg-white rounded-2xl p-6 mx-4 max-w-sm w-full shadow-2xl">
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-indigo-100 flex items-center justify-center">
                <svg className="w-8 h-8 text-indigo-600 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-slate-800 mb-2">Processing</h3>
              <p className="text-slate-600 text-sm">{processingText}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AssistantPageWithSuspense() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-55 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-4 border-indigo-600 border-t-transparent"></div>
      </div>
    }>
      <AssistantPageContent />
    </Suspense>
  );
}

export default function AssistantPage() {
  return (
    <ClientLoader
      scripts={[
        '/js/theme-manager.js',
        '/js/config.js',
        '/js/supabase-client.js',
        '/js/auth-guard.js',
        '/js/app-state.js',
        '/js/huggingface-service.js',
        '/js/transcription-service.js'
      ]}
      requiredGlobals={['UniSupabase', 'appState', 'HuggingFaceService', 'TranscriptionService']}
    >
      <AssistantPageWithSuspense />
    </ClientLoader>
  );
}
