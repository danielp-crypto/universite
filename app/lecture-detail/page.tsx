'use client';

import React, { useEffect, useState, useRef, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { apiGet, apiPost } from '@/lib/api/client';
import { getSession } from '@/lib/supabase/auth';
import { useRouter } from 'next/navigation';
import AudioPlayer from '../components/AudioPlayer';
import UpgradeModal from '../components/UpgradeModal';
import Alert from '../components/Alert';
import jsPDF from 'jspdf';

function LectureDetailPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const lectureId = searchParams.get('id');

  const [currentLecture, setCurrentLecture] = useState<any>(null);
  
  // Tabs
  const [activeTab, setActiveTab] = useState<'summary'>('summary');
  
  // AI Processing states
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingMessage, setProcessingMessage] = useState('');
  const [processingResults, setProcessingResults] = useState<{
    segmentsCount: number;
    summaryAvailable: boolean;
    suggestionsCount: number;
    summaryText?: string;
  }>({
    segmentsCount: 0,
    summaryAvailable: false,
    suggestionsCount: 0,
    summaryText: undefined
  });

  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);
  const [upgradeFeature, setUpgradeFeature] = useState('');

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

  // Tracks which Key Concept bubbles are tapped open to reveal their
  // definition (mobile has no hover, so tap-to-expand replaces tooltips).
  const [expandedConcepts, setExpandedConcepts] = useState<Set<number>>(new Set());
  const toggleConcept = (i: number) => {
    setExpandedConcepts(prev => {
      const next = new Set(prev);
      if (next.has(i)) {
        next.delete(i);
      } else {
        next.add(i);
      }
      return next;
    });
  };

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

  const exportToPDF = async () => {
    if (!currentLecture) return;

    try {
      const pdf = new jsPDF();
      
      // Add logo image
      const logoImg = new Image();
      logoImg.src = '/new-logo-black-removebg-preview.png';
      await new Promise((resolve) => {
        logoImg.onload = resolve;
        logoImg.onerror = resolve; // Continue even if image fails to load
      });
      
      // Add logo to PDF (width 40, height proportional)
      pdf.addImage(logoImg, 'PNG', 20, 10, 40, 40);
      
      // Add title
      pdf.setFontSize(20);
      pdf.text(currentLecture.title || 'Untitled Lecture', 70, 30);
      
      // Add metadata
      pdf.setFontSize(12);
      pdf.text(`Date: ${currentLecture.date || new Date().toLocaleDateString()}`, 70, 40);
      pdf.text(`Duration: ${currentLecture.duration || 'N/A'}`, 70, 48);
      
      // Add module name if available
      if (currentLecture.module && currentLecture.module.name) {
        pdf.text(`Module: ${currentLecture.module.name}`, 70, 56);
      }
      
      // Add transcript section
      pdf.setFontSize(16);
      pdf.text('TRANSCRIPT', 20, 75);
      pdf.setFontSize(12);
      
      const transcript = currentLecture.transcription || 'No transcript available';
      const transcriptLines = pdf.splitTextToSize(transcript, 170);
      let yPosition = 85;
      
      transcriptLines.forEach((line: string) => {
        if (yPosition > 270) {
          pdf.addPage();
          yPosition = 20;
        }
        pdf.text(line, 20, yPosition);
        yPosition += 7;
      });
      
      // Add summary section on new page
      pdf.addPage();
      pdf.setFontSize(16);
      pdf.text('SUMMARY', 20, 20);
      pdf.setFontSize(12);
      
      const summary = currentLecture.summary || 'No summary available';
      const summaryLines = pdf.splitTextToSize(summary, 170);
      yPosition = 30;
      
      summaryLines.forEach((line: string) => {
        if (yPosition > 270) {
          pdf.addPage();
          yPosition = 20;
        }
        pdf.text(line, 20, yPosition);
        yPosition += 7;
      });
      
      // Save the PDF
      pdf.save(`${currentLecture.title || 'lecture'}-notes.pdf`);
    } catch (error) {
      console.error('Error exporting notes:', error);
      showAlert('Error', 'Error exporting notes', 'error');
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
        const lectureData = {
          id: local.id,
          title: local.name,
          created_at: local.createdAt,
          duration: local.duration,
          audioUrl: local.audioUrl,
          isLocal: true,
          transcription: local.transcription || null,
          segments: local.segments || [],
          keyConcepts: local.keyConcepts || ['local recording']
        };
        setCurrentLecture(lectureData);
        
        // Set segments count from local data
        if (local.segments && local.segments.length > 0) {
          setProcessingResults(prev => ({
            ...prev,
            segmentsCount: local.segments.length
          }));
        }
        
        // If the local recording has been synced to Supabase (isLocal is false), load summary from Supabase
        if (local.isLocal === false) {
          try {
            const supabaseLecture = await apiGet(`/api/lectures/${id}`);
            if (supabaseLecture && supabaseLecture.summary) {
              setProcessingResults(prev => ({
                ...prev,
                summaryAvailable: true,
                summaryText: supabaseLecture.summary
              }));
            }
          } catch (error) {
            console.error('Failed to load summary from Supabase:', error);
          }
        }
        return;
      }

      // 2. Load from API
      const lecture = await apiGet(`/api/lectures/${id}`);
      if (lecture) {
        setCurrentLecture(lecture);
        // If lecture has a summary, set it in processing results for display
        if (lecture.summary) {
          setProcessingResults(prev => ({
            ...prev,
            summaryAvailable: true,
            summaryText: lecture.summary
          }));
        }
        // If lecture has segments, set segments count
        if (lecture.segments && lecture.segments.length > 0) {
          setProcessingResults(prev => ({
            ...prev,
            segmentsCount: lecture.segments.length
          }));
        }
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

  // AI Feature triggers
  const handleGenerateQA = async () => {
    if (!currentLecture) return;
    if (!currentLecture.transcription) {
      showAlert('No Transcription', 'This lecture has no transcription to generate Q&A from', 'warning');
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
        showAlert('Error', 'Error generating Q&A: ' + result.error, 'error');
      }
    } catch (e: any) {
      console.error(e);
      showAlert('Error', 'Failed to generate Q&A', 'error');
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

          // Create lecture in Supabase for local lectures
          try {
            console.log('Creating lecture in Supabase for local lecture:', currentLecture.title);
            const createResponse = await fetch('/api/lectures', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.access_token}`
              },
              body: JSON.stringify({
                title: currentLecture.title,
                duration: currentLecture.duration && currentLecture.duration !== 'N/A' ? currentLecture.duration : 0,
                transcription: transcriptionResult.transcript,
                stored_locally: true,
                local_audio_size: currentLecture.audioSize || 0
              })
            });
            
            console.log('Create response status:', createResponse.status);
            const createData = await createResponse.json();
            console.log('Create response data:', createData);
            
            if (createResponse.ok) {
              if (createData.success) {
                // Update current lecture with Supabase ID
                currentLecture.id = createData.lecture.id;
                currentLecture.isLocal = false;
                setCurrentLecture({ ...currentLecture });
                
                // Update local storage to mark as synced
                if (foundIdx !== -1) {
                  recordings[foundIdx].id = createData.lecture.id;
                  recordings[foundIdx].isLocal = false;
                  localStorage.setItem(RECORDINGS_STORAGE_KEY, JSON.stringify(recordings));
                }
              }
            } else {
              console.error('Failed to create lecture:', createData.error);
            }
          } catch (error) {
            console.error('Failed to create lecture in Supabase:', error);
          }
        } else {
          // Save transcript to Supabase
          try {
            await fetch(`/api/lectures/${currentLecture.id}`, {
              method: 'PUT',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.access_token}`
              },
              body: JSON.stringify({
                transcription: transcriptionResult.transcript
              })
            });
          } catch (error) {
            console.error('Failed to save transcript to Supabase:', error);
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

        // Save summary to Supabase
        if (summary) {
          try {
            await fetch(`/api/lectures/${currentLecture.id}`, {
              method: 'PUT',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.access_token}`
              },
              body: JSON.stringify({
                summary: summary
              })
            });
          } catch (error) {
            console.error('Failed to save summary to Supabase:', error);
          }
        }

        showAlert('Success', 'Transcription and analysis completed successfully!', 'success');
      } else {
        throw new Error(transcriptionResult.error || 'Transcription failed');
      }
    } catch (error: any) {
      console.error(error);
      showAlert('Error', `Transcription failed: ${error.message}`, 'error');
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

  const handleRegenerateSummary = async () => {
    if (!currentLecture) return;
    
    setIsProcessing(true);
    setProcessingMessage('Regenerating summary...');
    
    try {
      const session = await getSession();
      if (!session) return;

      // Get the existing transcription from the lecture
      const transcript = currentLecture.transcription || '';
      if (!transcript) {
        showAlert('Error', 'No transcription available to regenerate summary', 'error');
        setIsProcessing(false);
        return;
      }

      // Generate new summary
      const summary = await generateSummary(transcript);
      
      if (summary) {
        // Update processing results
        setProcessingResults(prev => ({
          ...prev,
          summaryAvailable: true,
          summaryText: summary
        }));

        // Save new summary to Supabase
        try {
          await fetch(`/api/lectures/${currentLecture.id}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session.access_token}`
            },
            body: JSON.stringify({
              summary: summary
            })
          });
          showAlert('Success', 'Summary regenerated successfully', 'success');
        } catch (error) {
          console.error('Failed to save summary to Supabase:', error);
          showAlert('Error', 'Failed to save summary', 'error');
        }
      } else {
        showAlert('Error', 'Failed to regenerate summary', 'error');
      }
    } catch (error) {
      console.error('Error regenerating summary:', error);
      showAlert('Error', 'Failed to regenerate summary', 'error');
    } finally {
      setIsProcessing(false);
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

  // ---- Lecture Notes formatting helpers ----

  // Renders a line of note text, turning **bold** markdown into real bold,
  // and auto-bolding a leading "Term:" label when no markdown bold is present.
  const formatNoteText = (raw: string, keyPrefix: string) => {
    const text = raw.trim();

    if (text.includes('**')) {
      const parts = text.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);
      return parts.map((part, i) =>
        part.startsWith('**') && part.endsWith('**') ? (
          <strong key={`${keyPrefix}-${i}`} className="font-semibold text-slate-900">
            {part.slice(2, -2)}
          </strong>
        ) : (
          <React.Fragment key={`${keyPrefix}-${i}`}>{part}</React.Fragment>
        )
      );
    }

    const labelMatch = text.match(/^([^:]{2,40}):\s*(.+)$/);
    if (labelMatch) {
      return (
        <>
          <strong className="font-semibold text-slate-900">{labelMatch[1]}:</strong>{' '}
          {labelMatch[2]}
        </>
      );
    }

    return text;
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
                <h2 className="text-xl font-bold text-slate-800 mb-2 truncate">{currentLecture.title}</h2>
                <div className="flex items-center gap-3 text-sm text-slate-500 mb-4">
                  <span>{new Date(currentLecture.created_at || currentLecture.createdAt).toLocaleDateString()}</span>
                  <span>•</span>
                  <span>{currentLecture.duration || 'N/A'}</span>
                  {currentLecture.module && (
                    <>
                      <span>•</span>
                      <div className="flex items-center gap-1">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                        </svg>
                        <span className="text-indigo-600 font-medium">{currentLecture.module.name}</span>
                      </div>
                    </>
                  )}
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
                    Ask Professor AI
                  </Link>
                  <button
                    onClick={exportToPDF}
                    className="px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold text-center hover:shadow-lg transition-all text-sm active:scale-95"
                    title="Export to PDF"
                  >
                    <svg className="w-5 h-5 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </button>
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

              {/* Lecture Notes */}
              <div className="bg-white border border-slate-200 rounded-2xl p-4 md:p-6 shadow-sm animate-fade-in">
                <div className="flex items-center justify-between mb-5">
                  <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                    <span className="text-xl leading-none">📝</span>
                    <span>Lecture Notes</span>
                  </h3>
                  <div className="flex items-center gap-2">
                    {processingResults?.summaryText && (
                      <>
                        <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                          AI Generated
                        </span>
                        <button
                          onClick={handleRegenerateSummary}
                          disabled={isProcessing}
                          className="text-[10px] font-semibold text-indigo-600 hover:text-indigo-700 uppercase tracking-wider disabled:opacity-50"
                        >
                          🔄 Regenerate
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {processingResults?.summaryText ? (
                  <div className="space-y-4">
                    {(() => {
                      const text = processingResults.summaryText;
                      const sections: { title: string; content: string; icon: string; style: string }[] = [];

                      // Sections are matched against the actual "## Heading" markers the
                      // REDUCE_PROMPT produces, and each capture stops at the NEXT "##"
                      // heading (or end of string) so sections can never bleed into each
                      // other regardless of order or spacing.
                      const sectionRegex = (heading: string) =>
                        new RegExp(`##\\s*${heading}[^\\n]*\\n([\\s\\S]*?)(?=\\n##|$)`, 'i');

                      // Parse Key Concepts section
                      const keyConceptsMatch = text.match(sectionRegex('Key Concepts'));
                      if (keyConceptsMatch) {
                        const concepts = keyConceptsMatch[1]
                          .split(/[\n•\-\*]/)
                          .map(line => {
                            // Extract just the term (before the colon) from "**Term**: Definition" format
                            const termMatch = line.match(/\*\*([^*]+)\*\*/);
                            return termMatch ? termMatch[1].trim() : line.trim();
                          })
                          .filter(c => c.trim());
                        sections.push({
                          title: 'Key Concepts',
                          content: concepts.join('|||'),
                          icon: '🔑',
                          style: 'indigo'
                        });
                      }

                      // Parse Full Lecture Notes section
                      const fullNotesMatch = text.match(sectionRegex('Full Lecture Notes'));
                      if (fullNotesMatch) {
                        const notes = fullNotesMatch[1].trim();
                        sections.push({
                          title: 'Full Lecture Notes',
                          content: notes,
                          icon: '📝',
                          style: 'blue'
                        });
                      }

                      // Parse Assessment Hints section
                      const assessmentHintsMatch = text.match(sectionRegex('Assessment Hints'));
                      if (assessmentHintsMatch) {
                        const hints = assessmentHintsMatch[1].split(/[\n•\-\*]/).filter(h => h.trim());
                        sections.push({
                          title: 'Assessment Hints',
                          content: hints.join('|||'),
                          icon: '⚠️',
                          style: 'amber'
                        });
                      }

                      // Parse Summary section
                      const summaryMatch = text.match(sectionRegex('Summary'));
                      if (summaryMatch) {
                        const summaryText = summaryMatch[1].trim();
                        // Split by numbered items (1., 2., 3., etc.) and clean up
                        const summaryItems = summaryText.split(/\d+\.\s*/).filter(s => s.trim());
                        const summaryContent = summaryItems.join('|||');
                        sections.push({
                          title: '10-Bullet Pass Guarantee',
                          content: summaryContent,
                          icon: '🎯',
                          style: 'emerald'
                        });
                      }

                      // Parse Test Predictor section
                      const testPredictorMatch = text.match(sectionRegex('Test Predictor'));
                      if (testPredictorMatch) {
                        const questions = testPredictorMatch[1]
                          .split(/\n(?=Q\d)/)
                          .map(q => q.trim())
                          .filter(Boolean);
                        sections.push({
                          title: 'Test Predictor',
                          content: questions.join('|||'),
                          icon: '🧠',
                          style: 'violet'
                        });
                      }

                      // Parse Glossary section
                      const glossaryMatch = text.match(sectionRegex('Glossary'));
                      if (glossaryMatch) {
                        const glossary = glossaryMatch[1].trim();
                        sections.push({
                          title: 'Glossary',
                          content: glossary,
                          icon: '📚',
                          style: 'rose'
                        });
                      }

                      // If no structured sections found, display as formatted plain text
                      if (sections.length === 0) {
                        return (
                          <div className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
                            {formatNoteText(text, 'plain')}
                          </div>
                        );
                      }

                      const styleMap: Record<string, { border: string; bg: string; badge: string; chip: string }> = {
                        indigo: {
                          border: 'border-indigo-100',
                          bg: 'from-indigo-50/80 to-white',
                          badge: 'bg-indigo-100',
                          chip: 'bg-white border-indigo-200 text-indigo-700'
                        },
                        blue: {
                          border: 'border-blue-100',
                          bg: 'from-blue-50/80 to-white',
                          badge: 'bg-blue-100',
                          chip: ''
                        },
                        amber: {
                          border: 'border-amber-100',
                          bg: 'from-amber-50/80 to-white',
                          badge: 'bg-amber-100',
                          chip: ''
                        },
                        emerald: {
                          border: 'border-emerald-100',
                          bg: 'from-emerald-50/80 to-white',
                          badge: 'bg-emerald-100',
                          chip: ''
                        },
                        violet: {
                          border: 'border-violet-100',
                          bg: 'from-violet-50/80 to-white',
                          badge: 'bg-violet-100',
                          chip: ''
                        },
                        rose: {
                          border: 'border-rose-100',
                          bg: 'from-rose-50/80 to-white',
                          badge: 'bg-rose-100',
                          chip: ''
                        }
                      };

                      return sections.map((section, idx) => {
                        const items = section.content.split('|||').map(i => i.trim()).filter(Boolean);
                        const colors = styleMap[section.style];

                        return (
                          <div
                            key={idx}
                            className={`rounded-xl border ${colors.border} bg-gradient-to-br ${colors.bg} p-4`}
                          >
                            <h4 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
                              <span className={`flex items-center justify-center w-6 h-6 rounded-full ${colors.badge} text-sm`}>
                                {section.icon}
                              </span>
                              <span>{section.title}</span>
                              <span className="ml-auto text-[11px] font-medium text-slate-400">
                                {items.length}
                              </span>
                            </h4>

                            {section.style === 'indigo' ? (() => {
                              // Bubbles show just the bolded term. Tapping a
                              // bubble (mobile has no hover) reveals its full
                              // definition in a panel below the row.
                              const concepts = items.map((item) => {
                                const termMatch = item.match(/^\*\*\[?([^*\]]+)\]?\*\*\s*:?\s*([\s\S]*)$/);
                                const term = termMatch ? termMatch[1].trim() : item.split(':')[0].replace(/\*\*/g, '').trim();
                                const definition = termMatch ? termMatch[2].trim() : item.split(':').slice(1).join(':').trim();
                                return { term, definition };
                              });
                              const hasExpanded = concepts.some((_, i) => expandedConcepts.has(i));

                              return (
                                <div>
                                  <div className="flex flex-wrap gap-2">
                                    {concepts.map((c, i) => {
                                      const isExpanded = expandedConcepts.has(i);
                                      return (
                                        <button
                                          key={i}
                                          type="button"
                                          onClick={() => toggleConcept(i)}
                                          aria-expanded={isExpanded}
                                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 border rounded-full text-xs font-semibold shadow-sm transition-colors active:scale-95 ${
                                            isExpanded
                                              ? 'bg-indigo-600 border-indigo-600 text-white'
                                              : colors.chip
                                          }`}
                                        >
                                          <span className={`text-[10px] ${isExpanded ? 'text-indigo-200' : 'text-indigo-400'}`}>●</span>
                                          {c.term}
                                        </button>
                                      );
                                    })}
                                  </div>

                                  {hasExpanded && (
                                    <div className="mt-3 space-y-2">
                                      {concepts.map((c, i) =>
                                        expandedConcepts.has(i) && c.definition ? (
                                          <div
                                            key={i}
                                            className="text-xs text-slate-600 bg-white border border-indigo-100 rounded-lg px-3 py-2 leading-relaxed"
                                          >
                                            <span className="font-semibold text-slate-800">{c.term}: </span>
                                            {c.definition}
                                          </div>
                                        ) : null
                                      )}
                                    </div>
                                  )}
                                </div>
                              );
                            })() : section.style === 'amber' ? (
                              <ul className="space-y-2.5">
                                {items.map((item, i) => (
                                  <li key={i} className="flex items-start gap-2.5 text-sm text-slate-700 leading-relaxed">
                                    <span className="mt-0.5 flex-shrink-0">💡</span>
                                    <span>{formatNoteText(item, `eh-${i}`)}</span>
                                  </li>
                                ))}
                              </ul>
                            ) : section.style === 'violet' ? (
                              <ol className="space-y-3">
                                {items.map((item, i) => {
                                  const qMatch = item.match(/^Q\d+\s*\[([^\]]+)\]:\s*([\s\S]+)$/i);
                                  const level = qMatch ? qMatch[1] : null;
                                  const body = qMatch ? qMatch[2].trim() : item;
                                  return (
                                    <li key={i} className="flex items-start gap-2.5 text-sm text-slate-700 leading-relaxed">
                                      <span className="mt-0.5 flex items-center justify-center w-5 h-5 rounded-full bg-violet-500 text-white text-[10px] font-bold flex-shrink-0">
                                        {i + 1}
                                      </span>
                                      <span>
                                        {level && (
                                          <span className="mr-1.5 inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide bg-violet-100 text-violet-700">
                                            {level}
                                          </span>
                                        )}
                                        {formatNoteText(body, `ty-${i}`)}
                                      </span>
                                    </li>
                                  );
                                })}
                              </ol>
                            ) : section.style === 'blue' ? (
                              <div className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
                                {formatNoteText(section.content, `notes-${idx}`)}
                              </div>
                            ) : section.style === 'rose' ? (
                              <div className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
                                {formatNoteText(section.content, `glossary-${idx}`)}
                              </div>
                            ) : (
                              <ul className="space-y-2.5">
                                {items.map((item, i) => (
                                  <li key={i} className="flex items-start gap-2.5 text-sm text-slate-700 leading-relaxed">
                                    <span className="mt-0.5 flex items-center justify-center w-4 h-4 rounded-full bg-emerald-500 text-white text-[10px] font-bold flex-shrink-0">
                                      ✓
                                    </span>
                                    <span>{formatNoteText(item, `sm-${i}`)}</span>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        );
                      });
                    })()}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <div className="text-3xl mb-2">🗒️</div>
                    <p className="text-slate-500 text-sm mb-4">No notes available for this lecture yet.</p>
                    <button
                      onClick={handleProcessTranscript}
                      className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-semibold active:scale-95 transition-all"
                    >
                      ✨ Generate Summary
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-4 border-indigo-600 border-t-transparent mx-auto"></div>
              <p className="text-slate-500 mt-4 text-sm">Loading lecture...</p>
            </div>
          )}
        </div>

        {/* Upgrade Modal */}
        <UpgradeModal
          isOpen={upgradeModalOpen}
          onClose={() => setUpgradeModalOpen(false)}
          feature={upgradeFeature}
          onUpgrade={() => showAlert('Coming Soon', 'Premium upgrade coming soon!', 'info')}
        />

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
              <Link href="/lectures" className="flex flex-col items-center py-2 px-4 text-indigo-600">
                <svg className="w-6 h-6 mb-1" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M7 3a1 1 0 000 2h6a1 1 0 100-2H7zM4 7a1 1 0 011-1h10a1 1 0 110 2H5a1 1 0 01-1-1zM2 11a2 2 0 012-2h12a2 2 0 012 2v4a2 2 0 01-2 2H4a2 2 0 01-2-2v-4z" />
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

      <UpgradeModal
        isOpen={upgradeModalOpen}
        onClose={() => setUpgradeModalOpen(false)}
        feature={upgradeFeature}
      />

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