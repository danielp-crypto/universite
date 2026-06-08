'use client';

import React, { useEffect, useState, useRef, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { apiGet, apiPost } from '@/lib/api/client';
import { getSession } from '@/lib/supabase/auth';
import { useRouter } from 'next/navigation';
import AudioPlayer from '../components/AudioPlayer';

function LectureDetailPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const lectureId = searchParams.get('id');

  const [currentLecture, setCurrentLecture] = useState<any>(null);
  
  // Tabs
  const [activeTab, setActiveTab] = useState<'segments' | 'transcript' | 'flashcards'>('segments');
  
  // AI Processing states
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingMessage, setProcessingMessage] = useState('');
  const [processingResults, setProcessingResults] = useState<{
    segmentsCount: number;
    summaryAvailable: boolean;
    suggestionsCount: number;
    summaryText?: string;
  } | null>(null);

  const [flashcards, setFlashcards] = useState<any[]>([]);

  const RECORDINGS_STORAGE_KEY = 'universite_recordings';

  const getRecordings = () => {
    try {
      const recordings = localStorage.getItem(RECORDINGS_STORAGE_KEY);
      return recordings ? JSON.parse(recordings) : [];
    } catch (e) {
      return [];
    }
  };

  const getLocalRecordingById = (id: string) => {
    const recordings = getRecordings();
    return recordings.find((r: any) => r.id === id);
  };

  const formatTime = (seconds: number) => {
    if (isNaN(seconds)) return '0:00';
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const downloadRecording = async () => {
    if (!currentLecture || !currentLecture.audioUrl) return;
    try {
      const response = await fetch(currentLecture.audioUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${currentLecture.title || 'recording'}.webm`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Error downloading recording:', error);
      alert('Error downloading recording');
    }
  };

  const loadLecture = async (id: string) => {
    try {
      // Check session
      const session = await getSession();
      if (!session) {
        router.push('/login');
        return;
      }

      // 1. Check local recordings first
      const local = getLocalRecordingById(id);
      if (local) {
        setCurrentLecture({
          id: local.id,
          title: local.name,
          created_at: local.createdAt,
          duration: local.duration,
          audioUrl: local.audioUrl,
          isLocal: true,
          transcription: local.transcription || null,
          segments: local.segments || [],
          keyConcepts: local.keyConcepts || ['local recording']
        });
        return;
      }

      // 2. Load from API
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

    // Load flashcards from localStorage
    try {
      const stored = localStorage.getItem('universite_flashcards');
      if (stored) {
        const parsed = JSON.parse(stored);
        setFlashcards(parsed.filter((card: any) => card.lecture_id === lectureId));
      }
    } catch (e) {
      console.error(e);
    }
  }, [lectureId]);

  // AI Feature triggers
  const handleGenerateQA = async () => {
    if (!currentLecture) return;
    if (!currentLecture.transcription) {
      alert('This lecture has no transcription to generate Q&A from');
      return;
    }

    try {
      setProcessingMessage('Generating Q&A...');
      setIsProcessing(true);

      const segments = createSegmentsFromTranscription(currentLecture.transcription);
      const result = await apiPost('/api/generate-qa', {
        lecture: currentLecture,
        segments: segments
      });
      
      if (result.success) {
        localStorage.setItem(`qa_${currentLecture.id}`, JSON.stringify(result.qaPairs));
        router.push(`/qa-interface?lecture=${currentLecture.id}`);
      } else {
        alert('Error generating Q&A: ' + result.error);
      }
    } catch (e: any) {
      console.error(e);
      alert('Failed to generate Q&A');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleGenerateFlashcards = async () => {
    if (!currentLecture) return;
    if (!currentLecture.transcription) {
      alert('This lecture has no transcription to generate flashcards from');
      return;
    }

    try {
      setProcessingMessage('Creating Flashcards...');
      setIsProcessing(true);

      const segments = createSegmentsFromTranscription(currentLecture.transcription);
      const result = await apiPost('/api/generate-flashcards', {
        lecture: currentLecture,
        segments: segments
      });
      
      if (result.success) {
        // Save to localStorage
        const existingStored = localStorage.getItem('universite_flashcards');
        const existing = existingStored ? JSON.parse(existingStored) : [];
        const newCards = result.flashcards.map((card: any) => ({
          ...card,
          lecture_id: currentLecture.id,
          lecture_title: currentLecture.title,
          created_at: new Date().toISOString()
        }));

        localStorage.setItem('universite_flashcards', JSON.stringify([...existing, ...newCards]));
        router.push(`/study-mode?lecture=${currentLecture.id}`);
      } else {
        alert('Error generating flashcards: ' + result.error);
      }
    } catch (e: any) {
      console.error(e);
      alert('Failed to generate flashcards');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleProcessTranscript = async () => {
    if (!currentLecture) return;
    setProcessingMessage('Downloading audio file...');
    setIsProcessing(true);

    try {
      const session = await getSession();
      if (!session) {
        router.push('/login');
        return;
      }

      let audioFile: File;

      if (currentLecture.isLocal && currentLecture.audioUrl) {
        const response = await fetch(currentLecture.audioUrl);
        const blob = await response.blob();
        audioFile = new File([blob], 'lecture.webm', { type: 'audio/webm' });
      } else if (currentLecture.file_path) {
        const token = session.access_token;
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://hiruufvoyigrcdohqjkm.supabase.co';
        const downloadUrl = `${supabaseUrl}/storage/v1/object/public/${currentLecture.file_path}`;
        const response = await fetch(downloadUrl, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) throw new Error('Failed to download audio file');
        const blob = await response.blob();
        audioFile = new File([blob], 'lecture.webm', { type: 'audio/webm' });
      } else {
        throw new Error('No audio source available');
      }

      setProcessingMessage('Transcribing audio...');
      
      const formData = new FormData();
      formData.append('audio', audioFile);
      
      const response = await fetch('/api/transcribe', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${session.access_token}` },
        body: formData
      });
      
      const transcriptionResult = await response.json().catch(() => ({}));
      
      if (transcriptionResult.success) {
        currentLecture.transcription = transcriptionResult.transcript;
        setCurrentLecture({ ...currentLecture });

        // Update local storage if it's local
        if (currentLecture.isLocal) {
          const recordings = getRecordings();
          const foundIdx = recordings.findIndex((r: any) => r.id === currentLecture.id);
          if (foundIdx !== -1) {
            recordings[foundIdx].transcription = transcriptionResult.transcript;
            localStorage.setItem(RECORDINGS_STORAGE_KEY, JSON.stringify(recordings));
          }
        }

        setProcessingMessage('Generating summary...');
        const summary = await generateSummary(transcriptionResult.transcript);

        const segments = createSegmentsFromTranscription(transcriptionResult.transcript);
        
        setProcessingResults({
          segmentsCount: segments.length,
          summaryAvailable: !!summary,
          suggestionsCount: Math.min(5, segments.length * 2),
          summaryText: summary || undefined
        });

        alert('Transcription and analysis completed successfully!');
      } else {
        throw new Error(transcriptionResult.error || 'Transcription failed');
      }
    } catch (error: any) {
      console.error(error);
      alert(`Transcription failed: ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const generateSummary = async (transcript: string) => {
    try {
      const result = await apiPost('/api/generate-summary', {
        transcript: transcript.substring(0, 2000)
      });
      return result.success ? result.summary : null;
    } catch (e) {
      return null;
    }
  };

  const createSegmentsFromTranscription = (transcription: string) => {
    if (!transcription) return [];
    const sentences = transcription.split('. ').filter(s => s.trim().length > 0);
    const segments = [];
    const segmentLength = 3;
    
    for (let i = 0; i < sentences.length; i += segmentLength) {
      const segmentSentences = sentences.slice(i, i + segmentLength);
      segments.push({
        id: `segment_${i}`,
        content: segmentSentences.join('. '),
        start_time_seconds: i * 30,
        end_time_seconds: (i + segmentLength) * 30,
        title: `Segment ${Math.floor(i / segmentLength) + 1}`,
        concepts: ['key topic', 'lecture segment']
      });
    }
    return segments;
  };

  const currentSegments = currentLecture?.transcription
    ? createSegmentsFromTranscription(currentLecture.transcription)
    : currentLecture?.segments || [];

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
                  <span>{new Date(currentLecture.created_at || currentLecture.createdAt).toLocaleDateString()}</span>
                  <span>•</span>
                  <span>{currentLecture.duration || 'N/A'}</span>
                </div>

                {/* Audio Player Container */}
                {currentLecture.audioUrl && (
                  <AudioPlayer src={currentLecture.audioUrl} className="mb-4" />
                )}

                {/* Primary Actions */}
                <div className="flex gap-2 mb-4">
                  <Link
                    href={`/assistant?lecture=${currentLecture.id}`}
                    className="flex-1 px-4 py-3 bg-gradient-to-br from-indigo-500 to-purple-600 text-white rounded-xl font-semibold text-center hover:shadow-lg transition-all text-sm active:scale-95"
                  >
                    Chat with Lecture
                  </Link>
                  <button
                    onClick={downloadRecording}
                    className="px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold text-center hover:shadow-lg transition-all text-sm active:scale-95"
                    title="Download"
                  >
                    <svg className="w-5 h-5 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                  </button>
                </div>

                {/* Study Tools */}
                <div className="grid grid-cols-2 gap-2 mb-4">
                  <button
                    onClick={handleGenerateQA}
                    className="px-4 py-2.5 bg-gradient-to-r from-blue-500 to-cyan-600 text-white rounded-xl font-semibold text-sm active:scale-95 transition-transform flex items-center justify-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Generate Q&A
                  </button>
                  <button
                    onClick={handleGenerateFlashcards}
                    className="px-4 py-2.5 bg-gradient-to-r from-purple-500 to-pink-600 text-white rounded-xl font-semibold text-sm active:scale-95 transition-transform flex items-center justify-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                    Create Flashcards
                  </button>
                </div>

                {/* Transcription trigger */}
                <div className="mb-4 pt-4 border-t border-slate-100">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-slate-700">Transcript Processing</h3>
                    <button
                      onClick={handleProcessTranscript}
                      disabled={isProcessing}
                      className="px-3 py-1.5 bg-gradient-to-r from-green-500 to-emerald-600 text-white text-xs font-semibold rounded-lg active:scale-95 transition-transform"
                    >
                      Process Transcript
                    </button>
                  </div>
                  
                  {isProcessing && (
                    <div className="p-3 bg-slate-50 rounded-lg border flex items-center gap-3">
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-indigo-600 border-t-transparent"></div>
                      <span className="text-xs text-slate-600">{processingMessage}</span>
                    </div>
                  )}

                  {processingResults && (
                    <div className="space-y-3 mt-3">
                      <div className="grid grid-cols-3 gap-2">
                        <div className="text-center p-2 bg-blue-50 rounded-lg">
                          <div className="text-base font-bold text-blue-600">{processingResults.segmentsCount}</div>
                          <div className="text-[10px] text-blue-700">Segments</div>
                        </div>
                        <div className="text-center p-2 bg-green-50 rounded-lg">
                          <div className="text-base font-bold text-green-600">{processingResults.summaryAvailable ? 'Yes' : 'No'}</div>
                          <div className="text-[10px] text-green-700">Summary</div>
                        </div>
                        <div className="text-center p-2 bg-purple-50 rounded-lg">
                          <div className="text-base font-bold text-purple-600">{processingResults.suggestionsCount}</div>
                          <div className="text-[10px] text-purple-700">Flashcards</div>
                        </div>
                      </div>

                      {processingResults.summaryText && (
                        <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                          <h4 className="text-xs font-bold text-slate-700 mb-1">Summary</h4>
                          <p className="text-xs text-slate-600 leading-relaxed">{processingResults.summaryText}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Key Concepts */}
                {currentLecture.keyConcepts && currentLecture.keyConcepts.length > 0 && (
                  <div>
                    <h3 className="text-xs font-bold text-slate-700 mb-2">Key Concepts</h3>
                    <div className="flex flex-wrap gap-1.5">
                      {currentLecture.keyConcepts.map((concept: string, idx: number) => (
                        <span key={idx} className="px-2.5 py-1 bg-indigo-50 text-indigo-700 rounded-full text-xs font-medium">
                          {concept}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Tabs Menu */}
              <div className="mb-4">
                <div className="flex gap-2 border-b border-slate-200">
                  <button
                    onClick={() => setActiveTab('segments')}
                    className={`px-4 py-2 text-sm font-semibold transition-colors ${
                      activeTab === 'segments' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    Segments
                  </button>
                  <button
                    onClick={() => setActiveTab('transcript')}
                    className={`px-4 py-2 text-sm font-semibold transition-colors ${
                      activeTab === 'transcript' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    Transcript
                  </button>
                  <button
                    onClick={() => setActiveTab('flashcards')}
                    className={`px-4 py-2 text-sm font-semibold transition-colors ${
                      activeTab === 'flashcards' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    Flashcards ({flashcards.length})
                  </button>
                </div>
              </div>

              {/* Tab Contents */}
              {activeTab === 'segments' && (
                <div className="space-y-3 animate-fade-in">
                  {currentSegments.length > 0 ? (
                    currentSegments.map((segment: any, idx: number) => (
                      <div key={segment.id || idx} className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
                        <h3 className="text-base font-semibold text-slate-800 mb-1">{segment.title}</h3>
                        <div className="text-xs text-slate-500 mb-2">
                          {formatTime(segment.start_time_seconds)} - {formatTime(segment.end_time_seconds)}
                        </div>
                        <p className="text-sm text-slate-600 mb-3">{segment.content}</p>
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              // TODO: Implement segment playback with AudioPlayer
                              alert('Segment playback feature coming soon');
                            }}
                            className="flex-1 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold active:scale-95 transition-transform"
                          >
                            Play Segment
                          </button>
                          <Link
                            href={`/assistant?lecture=${currentLecture.id}&q=${encodeURIComponent(`Explain this section: "${segment.content.substring(0, 100)}..."`)}`}
                            className="flex-1 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold text-center active:scale-95 transition-transform"
                          >
                            Ask AI
                          </Link>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8 bg-white border rounded-2xl">
                      <p className="text-slate-500 text-sm">No segments processed. Click "Process Transcript" to analyze.</p>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'transcript' && (
                <div className="bg-white border border-slate-200 rounded-2xl p-4 md:p-6 shadow-sm animate-fade-in">
                  <h3 className="text-base font-semibold text-slate-800 mb-3">Full Transcript</h3>
                  {currentLecture.transcription ? (
                    <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">{currentLecture.transcription}</p>
                  ) : (
                    <div className="text-center py-6">
                      <p className="text-slate-500 text-sm mb-4">No transcription found for this lecture.</p>
                      <button
                        onClick={handleProcessTranscript}
                        className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-semibold active:scale-95 transition-all"
                      >
                        Start Transcription
                      </button>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'flashcards' && (
                <div className="space-y-3 animate-fade-in">
                  {flashcards.length > 0 ? (
                    flashcards.map((card, idx) => (
                      <div key={card.id || idx} className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
                        <div className="font-semibold text-slate-800 mb-1">Q: {card.question}</div>
                        <div className="text-sm text-slate-600 pt-2 border-t border-slate-100">A: {card.answer}</div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8 bg-white border rounded-2xl">
                      <p className="text-slate-500 text-sm mb-4">No flashcards created yet.</p>
                      <button
                        onClick={handleGenerateFlashcards}
                        className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-semibold active:scale-95 transition-all"
                      >
                        Create Flashcards now
                      </button>
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
