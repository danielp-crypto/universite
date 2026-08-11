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
import { transcribeAudioChunked } from '@/lib/audio/chunkedTranscribe';

function LectureDetailPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const lectureId = searchParams.get('id');

  const [currentLecture, setCurrentLecture] = useState<any>(null);
  
  // Tabs
  const [activeTab, setActiveTab] = useState<'summary'>('summary');
  
  // Self-test (multiple-choice quiz) state
  const [quizOpen, setQuizOpen] = useState(false);
  const [quizQuestions, setQuizQuestions] = useState<{ question: string; options: string[]; correctIndex: number }[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [quizAnswers, setQuizAnswers] = useState<(number | null)[]>([]);
  const [quizSubmitted, setQuizSubmitted] = useState(false);
  const [quizScore, setQuizScore] = useState(0);
  
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

  // Warn before the tab is closed/refreshed while transcribing/summarizing —
  // there's no queue yet, so navigating away mid-processing loses the work.
  useEffect(() => {
    if (!isProcessing) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isProcessing]);

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
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 16;
      const contentWidth = pageWidth - margin * 2;
      let yPosition = margin;

      // Brand colors, matching the palette used on the lecture-detail page
      const colors = {
        indigo: [79, 70, 229],
        blue: [59, 130, 246],
        amber: [245, 158, 11],
        emerald: [16, 185, 129],
        violet: [139, 92, 246],
        rose: [244, 63, 94],
        ink: [30, 41, 59],
        subtext: [100, 116, 139],
        border: [226, 232, 240],
        cardBg: [250, 250, 252],
      };

      // Adds a new page and resets yPosition if the given height won't fit
      const checkPageBreak = (neededHeight: number) => {
        if (yPosition + neededHeight > pageHeight - 20) {
          pdf.addPage();
          yPosition = margin;
          return true;
        }
        return false;
      };

      // Draws a small colored circular badge with a bold letter inside it.
      // Emoji glyphs aren't supported by jsPDF's built-in fonts (they render
      // as garbled characters), so badges use plain ASCII letters instead.
      const drawBadge = (x: number, y: number, diameter: number, color: number[], letter: string) => {
        pdf.setFillColor(color[0], color[1], color[2]);
        pdf.circle(x + diameter / 2, y + diameter / 2, diameter / 2, 'F');
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(diameter * 1.5);
        pdf.setTextColor(255, 255, 255);
        const tw = pdf.getTextWidth(letter);
        pdf.text(letter, x + diameter / 2 - tw / 2, y + diameter / 2 + diameter * 0.28);
        pdf.setFont('helvetica', 'normal');
      };

      // Renders a badge + heading, then a thin colored underline
      const sectionHeader = (title: string, color: number[], letter: string) => {
        checkPageBreak(18);
        yPosition += 4;
        const badgeSize = 7;
        drawBadge(margin, yPosition, badgeSize, color, letter);
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(13);
        pdf.setTextColor(colors.ink[0], colors.ink[1], colors.ink[2]);
        pdf.text(title, margin + badgeSize + 4, yPosition + badgeSize / 2 + 2.3);
        pdf.setFont('helvetica', 'normal');
        yPosition += badgeSize + 3;
        pdf.setDrawColor(color[0], color[1], color[2]);
        pdf.setLineWidth(0.6);
        pdf.line(margin, yPosition, pageWidth - margin, yPosition);
        pdf.setLineWidth(0.2);
        yPosition += 7;
      };

      // Wraps text to maxLines, truncating the final line with an ellipsis
      // if there's more content than fits — used to keep long lecture
      // titles from overflowing off the page.
      const fitTextToLines = (text: string, maxWidth: number, maxLines: number, fontSize: number) => {
        pdf.setFontSize(fontSize);
        let lines: string[] = pdf.splitTextToSize(text, maxWidth);
        if (lines.length <= maxLines) return lines;
        lines = lines.slice(0, maxLines);
        let lastLine = lines[maxLines - 1];
        while (pdf.getTextWidth(lastLine + '…') > maxWidth && lastLine.length > 1) {
          lastLine = lastLine.slice(0, -1).trim();
        }
        lines[maxLines - 1] = lastLine + '…';
        return lines;
      };

      // Renders a list of items, each in its own bordered card with a
      // colored left accent bar. Cards are measured before drawing, so
      // page breaks always land between cards rather than through them.
      const renderCardList = (items: string[], color: number[], opts: { numbered?: boolean } = {}) => {
        pdf.setFontSize(9.5);
        items.forEach((item: string, idx: number) => {
          const prefix = opts.numbered ? `${idx + 1}.  ` : '•  ';
          const lines = pdf.splitTextToSize(prefix + item.trim(), contentWidth - 10);
          const cardHeight = lines.length * 5 + 6;
          checkPageBreak(cardHeight + 3);
          pdf.setFillColor(colors.cardBg[0], colors.cardBg[1], colors.cardBg[2]);
          pdf.setDrawColor(colors.border[0], colors.border[1], colors.border[2]);
          pdf.setLineWidth(0.2);
          pdf.roundedRect(margin, yPosition, contentWidth, cardHeight, 2, 2, 'FD');
          pdf.setFillColor(color[0], color[1], color[2]);
          pdf.rect(margin, yPosition, 1.4, cardHeight, 'F');
          pdf.setTextColor(colors.ink[0], colors.ink[1], colors.ink[2]);
          let ty = yPosition + 5;
          lines.forEach((line: string) => {
            pdf.text(line, margin + 6, ty);
            ty += 5;
          });
          yPosition += cardHeight + 3;
        });
        yPosition += 5;
      };

      // Renders free-flowing paragraph text (used for the full lecture
      // notes, which can be long). Wrapped in a bordered card only when the
      // whole block fits on the current page; otherwise falls back to a
      // plain flowing paragraph so the border doesn't break across pages.
      const renderNotesBlock = (text: string, color: number[]) => {
        pdf.setFontSize(9.5);
        const lines = pdf.splitTextToSize(text, contentWidth - 10);
        const lineHeight = 5;
        const totalHeight = lines.length * lineHeight + 8;
        const remaining = pageHeight - 20 - yPosition;

        pdf.setTextColor(colors.ink[0], colors.ink[1], colors.ink[2]);

        if (totalHeight <= remaining) {
          pdf.setFillColor(colors.cardBg[0], colors.cardBg[1], colors.cardBg[2]);
          pdf.setDrawColor(colors.border[0], colors.border[1], colors.border[2]);
          pdf.roundedRect(margin, yPosition, contentWidth, totalHeight, 2, 2, 'FD');
          pdf.setFillColor(color[0], color[1], color[2]);
          pdf.rect(margin, yPosition, 1.4, totalHeight, 'F');
          let ty = yPosition + 6;
          lines.forEach((line: string) => {
            pdf.text(line, margin + 6, ty);
            ty += lineHeight;
          });
          yPosition += totalHeight + 8;
        } else {
          lines.forEach((line: string) => {
            if (yPosition + lineHeight > pageHeight - 20) {
              pdf.addPage();
              yPosition = margin;
            }
            pdf.text(line, margin + 2, yPosition);
            yPosition += lineHeight;
          });
          yPosition += 8;
        }
      };

      // ---------- Header banner ----------
      const bannerHeight = 40;
      pdf.setFillColor(colors.indigo[0], colors.indigo[1], colors.indigo[2]);
      pdf.rect(0, 0, pageWidth, bannerHeight, 'F');

      try {
        const logoImg = new Image();
        logoImg.src = '/new-logo-white-removebg-preview.png-1-192x192.png';
        await new Promise((resolve) => {
          logoImg.onload = resolve;
          logoImg.onerror = resolve; // Continue even if the logo fails to load
        });
        pdf.addImage(logoImg, 'PNG', margin, 8, 24, 24);
      } catch (e) {
        // Continue without the logo
      }

      const titleX = margin + 30;
      const titleMaxWidth = pageWidth - titleX - margin;
      const titleLines = fitTextToLines(currentLecture.title || 'Untitled Lecture', titleMaxWidth, 2, 17);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(255, 255, 255);
      let titleY = titleLines.length > 1 ? 15 : 19;
      titleLines.forEach((line: string) => {
        pdf.text(line, titleX, titleY);
        titleY += 7.5;
      });
      pdf.setFont('helvetica', 'normal');

      pdf.setFontSize(9.5);
      pdf.setTextColor(224, 224, 250);
      const metaParts: string[] = [];
      const lectureDate = currentLecture.created_at || currentLecture.createdAt;
      if (lectureDate) metaParts.push(`Date: ${new Date(lectureDate).toLocaleDateString()}`);
      metaParts.push(`Duration: ${currentLecture.duration || 'N/A'}`);
      if (currentLecture.module && currentLecture.module.name) {
        metaParts.push(`Module: ${currentLecture.module.name}`);
      }
      pdf.text(metaParts.join('   ·   '), titleX, 34);

      yPosition = bannerHeight + 10;

      // ---------- Key Concepts (chip style) ----------
      if (currentLecture.keyConcepts && currentLecture.keyConcepts.length > 0) {
        sectionHeader('Key Concepts', colors.indigo, 'K');
        pdf.setFontSize(9.5);
        const chipHeight = 7;
        let chipX = margin;
        currentLecture.keyConcepts.forEach((concept: string) => {
          const textWidth = pdf.getTextWidth(concept);
          const chipWidth = textWidth + 6;
          if (chipX + chipWidth > pageWidth - margin) {
            chipX = margin;
            yPosition += chipHeight + 3;
          }
          if (yPosition + chipHeight > pageHeight - 20) {
            pdf.addPage();
            yPosition = margin;
            chipX = margin;
          }
          pdf.setFillColor(238, 238, 253);
          pdf.setDrawColor(colors.indigo[0], colors.indigo[1], colors.indigo[2]);
          pdf.setLineWidth(0.2);
          pdf.roundedRect(chipX, yPosition, chipWidth, chipHeight, 3, 3, 'FD');
          pdf.setTextColor(colors.indigo[0], colors.indigo[1], colors.indigo[2]);
          pdf.text(concept, chipX + 3, yPosition + 4.8);
          chipX += chipWidth + 3;
        });
        yPosition += chipHeight + 10;
      }

      // Parse summary into sections. Each capture stops at the NEXT top-level
      // "## Heading" (or end of string). The lookahead requires exactly two
      // '#' — "(?!#)" rules out "###" subheadings (e.g. "### Formulas",
      // "### Definitions") so a section's own subheadings don't prematurely
      // end its capture and leave it empty.
      const summary = currentLecture.summary || '';
      const sectionRegex = (heading: string) =>
        new RegExp(`##\\s*${heading}[^\\n]*\\n([\\s\\S]*?)(?=\\n##(?!#)|$)`, 'i');

      // ---------- Full Lecture Notes ----------
      const fullNotesMatch = summary.match(sectionRegex('Full Lecture Notes'));
      if (fullNotesMatch) {
        sectionHeader('Full Lecture Notes', colors.blue, 'N');
        renderNotesBlock(fullNotesMatch[1].trim(), colors.blue);
      }

      // ---------- Assessment Hints ----------
      const assessmentHintsMatch = summary.match(sectionRegex('Assessment Hints'));
      if (assessmentHintsMatch) {
        sectionHeader('Assessment Hints', colors.amber, '!');
        const hints = assessmentHintsMatch[1]
          .split(/\n+/)
          .map((line: string) => line.replace(/^\s*[•\-\*]\s*/, '').trim())
          .filter(Boolean);
        renderCardList(hints, colors.amber);
      }

      // ---------- 10-Bullet Pass Guarantee ----------
      const summaryMatch = summary.match(sectionRegex('Summary'));
      if (summaryMatch) {
        sectionHeader('10-Bullet Pass Guarantee', colors.emerald, 'P');
        const summaryText = summaryMatch[1].trim();
        const summaryItems = summaryText.split(/\d+\.\s*/).filter((s: string) => s.trim());
        renderCardList(summaryItems, colors.emerald, { numbered: true });
      }

      // ---------- Test Predictor ----------
      const testPredictorMatch = summary.match(sectionRegex('Test Predictor'));
      if (testPredictorMatch) {
        sectionHeader('Test Predictor', colors.violet, 'Q');
        const questions = testPredictorMatch[1]
          .split(/\n(?=Q\d)/)
          .map((q: string) => q.trim())
          .filter(Boolean);
        renderCardList(questions, colors.violet);
      }

      // ---------- Glossary ----------
      const glossaryMatch = summary.match(sectionRegex('Glossary'));
      if (glossaryMatch) {
        sectionHeader('Glossary', colors.rose, 'G');
        const glossary = glossaryMatch[1].trim();

        const formulasMatch = glossary.match(/### Formulas\s*([\s\S]*?)(?=###|$)/i);
        if (formulasMatch) {
          checkPageBreak(12);
          pdf.setFont('helvetica', 'bold');
          pdf.setFontSize(11);
          pdf.setTextColor(colors.ink[0], colors.ink[1], colors.ink[2]);
          pdf.text('Formulas', margin, yPosition);
          pdf.setFont('helvetica', 'normal');
          yPosition += 6;
          const formulas = formulasMatch[1].split(/[\n•\-\*]/).filter((f: string) => f.trim());
          renderCardList(formulas, colors.rose);
        }

        const definitionsMatch = glossary.match(/### Definitions\s*([\s\S]*)/i);
        if (definitionsMatch) {
          checkPageBreak(12);
          pdf.setFont('helvetica', 'bold');
          pdf.setFontSize(11);
          pdf.setTextColor(colors.ink[0], colors.ink[1], colors.ink[2]);
          pdf.text('Definitions', margin, yPosition);
          pdf.setFont('helvetica', 'normal');
          yPosition += 6;
          const definitions = definitionsMatch[1].split(/[\n•\-\*]/).filter((d: string) => d.trim());
          renderCardList(definitions, colors.rose);
        }
      }

      // ---------- Footer (page numbers + brand line, every page) ----------
      const totalPages = pdf.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        pdf.setPage(i);
        pdf.setDrawColor(colors.border[0], colors.border[1], colors.border[2]);
        pdf.setLineWidth(0.2);
        pdf.line(margin, pageHeight - 14, pageWidth - margin, pageHeight - 14);
        pdf.setFontSize(8);
        pdf.setTextColor(colors.subtext[0], colors.subtext[1], colors.subtext[2]);
        pdf.text('Universite · AI Lecture Notes', margin, pageHeight - 9);
        const pageLabel = `Page ${i} of ${totalPages}`;
        pdf.text(pageLabel, pageWidth - margin - pdf.getTextWidth(pageLabel), pageHeight - 9);
      }

      // Save the PDF, with a filesystem-safe, length-capped filename
      const safeTitle = (currentLecture.title || 'lecture')
        .replace(/[\/\\?%*:|"<>]/g, '-')
        .trim()
        .slice(0, 60);
      pdf.save(`${safeTitle}-notes.pdf`);
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

      let audioBlob: Blob;

      if (currentLecture.isLocal && currentLecture.audioUrl) {
        const response = await fetch(currentLecture.audioUrl);
        audioBlob = await response.blob();
      } else if (currentLecture.file_path) {
        const token = session.access_token;
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://hiruufvoyigrcdohqjkm.supabase.co';
        const downloadUrl = `${supabaseUrl}/storage/v1/object/public/${currentLecture.file_path}`;
        const response = await fetch(downloadUrl, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) throw new Error('Failed to download audio file');
        audioBlob = await response.blob();
      } else {
        throw new Error('No audio source available');
      }

      // Transcribe audio (decoded + chunked client-side so long/large
      // recordings don't exceed Vercel's 4.5MB function body limit)
      const transcriptionResult = await transcribeAudioChunked(
        audioBlob,
        session.access_token,
        (msg) => setProcessingMessage(msg)
      );
      
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
        const finalTranscript = transcriptionResult.transcript || '';
        const summary = await generateSummary(finalTranscript);

        const segments = createSegmentsFromTranscription(finalTranscript);
        
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
        transcript: transcript
      });
      if (result.success && result.truncated) {
        console.warn(`Summary generated from a truncated transcript (${result.transcriptChars} chars).`);
        showAlert('Note', 'This lecture was very long, so notes are based on the first ~4 hours of content.', 'info');
      }
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
            },
            body: JSON.stringify({ summary }),
          });
        } catch (error) {
          console.error('Error saving summary:', error);
        }

        showAlert('Success', 'Summary regenerated successfully!', 'success');
      } else {
        showAlert('Error', 'Failed to regenerate summary', 'error');
      }
    } catch (error: any) {
      console.error(error);
      showAlert('Error', `Failed to regenerate summary: ${error.message}`, 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  // The "Quiz Bank" section is generated as real multiple-choice questions
  // (MCQn: question / A) / B) / C) / D) / CORRECT: <letter>) specifically so
  // students can click an option rather than just reading a model answer.
  const parseQuizBankQuestions = (summaryText: string) => {
    const quizBankMatch = summaryText.match(/##\s*Quiz Bank[^\n]*\n([\s\S]*?)(?=\n##(?!#)|$)/i);
    if (!quizBankMatch) return [];

    const blocks = quizBankMatch[1]
      .split(/\n(?=MCQ\d+\s*:)/i)
      .map((block: string) => block.trim())
      .filter(Boolean);

    const letterToIndex: Record<string, number> = { A: 0, B: 1, C: 2, D: 3 };

    const parsed = blocks
      .map((block: string) => {
        const match = block.match(
          /^MCQ\d+\s*:\s*([\s\S]*?)\n+A\)\s*([\s\S]*?)\n+B\)\s*([\s\S]*?)\n+C\)\s*([\s\S]*?)\n+D\)\s*([\s\S]*?)\n+CORRECT\s*:\s*([A-D])/i
        );
        if (!match) return null;
        const [, question, optA, optB, optC, optD, correctLetter] = match;
        const options = [optA, optB, optC, optD].map(o => o.trim()).filter(Boolean);
        if (options.length !== 4) return null;
        return {
          question: question.trim(),
          options,
          correctIndex: letterToIndex[correctLetter.toUpperCase()],
        };
      })
      .filter((q): q is { question: string; options: string[]; correctIndex: number } => q !== null);

    return parsed;
  };

  const startQuiz = () => {
    if (!processingResults?.summaryText) {
      showAlert('Error', 'No lecture summary available. Please generate notes first.', 'error');
      return;
    }

    const parsedQuestions = parseQuizBankQuestions(processingResults.summaryText);
    if (parsedQuestions.length === 0) {
      showAlert('Error', 'No test questions available in this lecture.', 'error');
      return;
    }

    setQuizQuestions(parsedQuestions);
    setCurrentQuestionIndex(0);
    setQuizAnswers(new Array(parsedQuestions.length).fill(null));
    setQuizSubmitted(false);
    setQuizScore(0);
    setQuizOpen(true);
  };

  const selectQuizAnswer = (optionIndex: number) => {
    setQuizAnswers(prev => {
      const next = [...prev];
      next[currentQuestionIndex] = optionIndex;
      return next;
    });
  };

  const goToNextQuestion = () => {
    if (currentQuestionIndex < quizQuestions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
    }
  };

  const goToPreviousQuestion = () => {
    setCurrentQuestionIndex(prev => Math.max(0, prev - 1));
  };

  // Score is computed once at submit time by comparing the full answers
  // array against each question's correct index — not incremented as the
  // student moves forward. That avoids double-counting if they use
  // Previous/Next to revisit and change an earlier answer.
  const submitQuiz = async () => {
    const finalScore = quizQuestions.reduce(
      (score, q, i) => (quizAnswers[i] === q.correctIndex ? score + 1 : score),
      0
    );
    setQuizScore(finalScore);
    setQuizSubmitted(true);

    // Save quiz result to database
    try {
      const session = await getSession();
      if (session) {
        await fetch('/api/quiz-results', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`
          },
          body: JSON.stringify({
            lectureId: currentLecture?.id,
            lectureTitle: currentLecture?.title,
            score: finalScore,
            total: quizQuestions.length
          })
        });
      }
    } catch (error) {
      console.error('Error saving quiz result:', error);
    }
  };

  const closeQuiz = () => {
    setQuizOpen(false);
    setCurrentQuestionIndex(0);
    setQuizAnswers([]);
    setQuizSubmitted(false);
    setQuizScore(0);
  };

  const createSegmentsFromTranscription = (transcription: string) => {
    if (!transcription) return [];
    const sentences = transcription.split('. ').filter((s: string) => s.trim().length > 0);
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
      return parts.map((part: string, i: number) =>
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
                    Ask Lecture
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
                      {currentLecture.keyConcepts
                        .map((concept: string) => {
                          // Bubbles show a single word each, stripped of any
                          // leading/trailing punctuation like stray "**" or ":".
                          const firstToken = concept.trim().split(/\s+/)[0] || '';
                          return firstToken.replace(/^[^a-zA-Z0-9]+|[^a-zA-Z0-9]+$/g, '');
                        })
                        .filter((word: string) => word.length > 0)
                        .map((word: string, idx: number) => (
                          <span key={idx} className="px-2.5 py-1 bg-indigo-50 text-indigo-700 rounded-full text-xs font-medium">
                            {word}
                          </span>
                        ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Self-test Section */}
              <div className="bg-gradient-to-br from-violet-50 to-purple-50 border border-violet-200 rounded-2xl p-4 md:p-5 shadow-sm mb-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                    <span className="text-xl leading-none">🎯</span>
                    <span>Quick Quiz</span>
                  </h3>
                </div>
                <p className="text-sm text-slate-600 mb-4">
                  Test your knowledge with a quiz generated from this lecture. Track your progress and master the material.
                </p>
                <button
                  onClick={startQuiz}
                  disabled={!processingResults?.summaryText}
                  className="w-full px-4 py-3 bg-gradient-to-r from-violet-600 to-purple-600 text-white rounded-xl font-semibold hover:shadow-lg transition-all text-sm active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Take Test
                </button>
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
                        <button
                          onClick={handleRegenerateSummary}
                          disabled={isProcessing}
                          className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                          title="Regenerate notes"
                        >
                          🔄 Regenerate
                        </button>
                        <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                          AI Generated
                        </span>
                        <span className="text-[10px] font-semibold text-indigo-600 uppercase tracking-wider">
                          📊 Add slides for context
                        </span>
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
                      // REDUCE_PROMPT produces, and each capture stops at the NEXT top-level
                      // "## Heading" (or end of string). The lookahead requires exactly two
                      // '#' — "(?!#)" rules out "###" subheadings (e.g. "### Formulas",
                      // "### Topic 1") so a section's own subheadings don't prematurely end
                      // its capture and leave it empty.
                      const sectionRegex = (heading: string) =>
                        new RegExp(`##\\s*${heading}[^\\n]*\\n([\\s\\S]*?)(?=\\n##(?!#)|$)`, 'i');

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
                        const hints = assessmentHintsMatch[1]
                          .split(/\n+/)
                          .map((line: string) => line.replace(/^\s*[•\-\*]\s*/, '').trim())
                          .filter(Boolean);
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
                        const summaryItems = summaryText.split(/\d+\.\s*/).filter((s: string) => s.trim());
                        const summaryContent = summaryItems.join('|||');
                        sections.push({
                          title: 'Bullet Pass Guarantee',
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
                          .map((q: string) => q.trim())
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

                      return sections.map((section, idx: number) => {
                        const items = section.content.split('|||').map((i: string) => i.trim()).filter(Boolean);
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
                              const concepts = items.map((item: string) => {
                                const termMatch = item.match(/^\*\*\[?([^*\]]+)\]?\*\*\s*:?\s*([\s\S]*)$/);
                                const term = termMatch ? termMatch[1].trim() : item.split(':')[0].replace(/\*\*/g, '').trim();
                                const definition = termMatch ? termMatch[2].trim() : item.split(':').slice(1).join(':').trim();
                                return { term, definition };
                              });
                              const hasExpanded = concepts.some((_: { term: string; definition: string }, i: number) => expandedConcepts.has(i));

                              return (
                                <div>
                                  <div className="flex flex-wrap gap-2">
                                    {concepts.map((c: any, i: number) => {
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
                                      {concepts.map((c: any, i: number) =>
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
                                {items.map((item: string, i: number) => (
                                  <li key={i} className="flex items-start gap-2.5 text-sm text-slate-700 leading-relaxed">
                                    <span className="mt-0.5 flex-shrink-0">💡</span>
                                    <span>{formatNoteText(item, `eh-${i}`)}</span>
                                  </li>
                                ))}
                              </ul>
                            ) : section.style === 'violet' ? (
                              <ol className="space-y-3">
                                {items.map((item: string, i: number) => {
                                  const qMatch = item.match(/^Q\d+\s*\[([^\]]+)\]:\s*([\s\S]+)$/i);
                                  const level = qMatch ? qMatch[1] : null;
                                  const rawBody = qMatch ? qMatch[2].trim() : item;

                                  // Split off the "A1: ..." model answer so it renders
                                  // as a bold, visually distinct block under the question.
                                  const answerMatch = rawBody.match(/^([\s\S]*?)\n?A\d+:\s*([\s\S]+)$/i);
                                  const question = answerMatch ? answerMatch[1].trim() : rawBody;
                                  const answer = answerMatch ? answerMatch[2].trim() : null;

                                  return (
                                    <li key={i} className="flex items-start gap-2.5 text-sm text-slate-700 leading-relaxed">
                                      <span className="mt-0.5 flex items-center justify-center w-5 h-5 rounded-full bg-violet-500 text-white text-[10px] font-bold flex-shrink-0">
                                        {i + 1}
                                      </span>
                                      <span className="flex-1">
                                        {level && (
                                          <span className="mr-1.5 inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide bg-violet-100 text-violet-700">
                                            {level}
                                          </span>
                                        )}
                                        {formatNoteText(question, `ty-${i}`)}
                                        {answer && (
                                          <div className="mt-2 pl-3 border-l-2 border-violet-300">
                                            <span className="block text-[10px] font-semibold uppercase tracking-wide text-violet-500 mb-0.5">
                                              Answer
                                            </span>
                                            <span className="font-bold text-violet-900">
                                              {formatNoteText(answer, `tya-${i}`)}
                                            </span>
                                          </div>
                                        )}
                                      </span>
                                    </li>
                                  );
                                })}
                              </ol>
                            ) : section.style === 'blue' ? (
                              <div className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
                                {formatNoteText(section.content, `notes-${idx}`)}
                              </div>
                            ) : section.style === 'rose' ? (() => {
                              // Parse Formulas and Definitions subsections
                              const formulasMatch = section.content.match(/### Formulas\s*([\s\S]*?)(?=###|$)/i);
                              const definitionsMatch = section.content.match(/### Definitions\s*([\s\S]*)/i);

                              // Split on newlines only, then strip a single leading
                              // bullet marker (•, -, or *) from each line. We must NOT
                              // split on '*' or '-' mid-line — that shreds the
                              // "**Term**: Definition" markdown before formatNoteText
                              // ever gets a chance to render the term in bold.
                              const splitLines = (text: string) =>
                                text
                                  .split(/\n+/)
                                  .map((line: string) => line.replace(/^\s*[•\-\*]\s*/, '').trim())
                                  .filter(Boolean);

                              const formulas = formulasMatch ? splitLines(formulasMatch[1]) : [];
                              const definitions = definitionsMatch ? splitLines(definitionsMatch[1]) : [];

                              return (
                                <div className="space-y-4">
                                  {formulas.length > 0 && (
                                    <div>
                                      <h5 className="text-xs font-bold text-slate-800 mb-2 flex items-center gap-2">
                                        <span className="text-sm">📐</span>
                                        <span>Formulas</span>
                                      </h5>
                                      <ul className="space-y-2">
                                        {formulas.map((formula: string, i: number) => (
                                          <li key={i} className="flex items-start gap-2.5 text-sm text-slate-700 leading-relaxed">
                                            <span className="mt-0.5 flex-shrink-0">📐</span>
                                            <span>{formatNoteText(formula, `formula-${i}`)}</span>
                                          </li>
                                        ))}
                                      </ul>
                                    </div>
                                  )}
                                  {definitions.length > 0 && (
                                    <div>
                                      <h5 className="text-xs font-bold text-slate-800 mb-2 flex items-center gap-2">
                                        <span className="text-sm">📖</span>
                                        <span>Definitions</span>
                                      </h5>
                                      <ul className="space-y-2">
                                        {definitions.map((definition: string, i: number) => (
                                          <li key={i} className="flex items-start gap-2.5 text-sm text-slate-700 leading-relaxed">
                                            <span className="mt-0.5 flex-shrink-0">📖</span>
                                            <span>{formatNoteText(definition, `def-${i}`)}</span>
                                          </li>
                                        ))}
                                      </ul>
                                    </div>
                                  )}
                                  {formulas.length === 0 && definitions.length === 0 && (
                                    <div className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
                                      {formatNoteText(section.content, `glossary-${idx}`)}
                                    </div>
                                  )}
                                </div>
                              );
                            })() : (
                              <ul className="space-y-2.5">
                                {items.map((item: string, i: number) => (
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

      {isProcessing && (
        <div className="fixed inset-0 bg-black/55 z-50 flex items-center justify-center">
          <div className="bg-white rounded-2xl p-6 mx-4 max-w-sm w-full shadow-2xl text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
              <svg className="w-8 h-8 text-white animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-slate-800 mb-2">Processing Lecture</h3>
            <p className="text-indigo-600 text-xs font-medium mb-3">{processingMessage || 'Working on it...'}</p>
            <p className="text-slate-500 text-xs mb-3">
              Longer lectures can take a few minutes — hang tight.
            </p>
            <p className="text-amber-600 text-xs font-semibold bg-amber-50 rounded-lg px-3 py-2">
              ⚠️ Don't close this tab or navigate away — it'll cancel processing and you'll lose this recording.
            </p>
          </div>
        </div>
      )}

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

      {/* Quiz Modal */}
      {quizOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-slate-900">Quick Quiz</h2>
                <button
                  onClick={closeQuiz}
                  className="text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {!quizSubmitted ? (
                <>
                  <div className="mb-4">
                    <div className="flex items-center justify-between text-sm text-slate-600 mb-2">
                      <span>Question {currentQuestionIndex + 1} of {quizQuestions.length}</span>
                      <span className="font-semibold">{Math.round((currentQuestionIndex / quizQuestions.length) * 100)}%</span>
                    </div>
                    <div className="w-full bg-slate-200 rounded-full h-2">
                      <div
                        className="bg-gradient-to-r from-violet-600 to-purple-600 h-2 rounded-full transition-all"
                        style={{ width: `${(currentQuestionIndex / quizQuestions.length) * 100}%` }}
                      ></div>
                    </div>
                  </div>

                  {quizQuestions[currentQuestionIndex] && (
                    <div className="mb-6">
                      <h3 className="text-lg font-semibold text-slate-900 mb-4">
                        {quizQuestions[currentQuestionIndex].question}
                      </h3>
                      <div className="space-y-3">
                        {quizQuestions[currentQuestionIndex].options.map((option: string, idx: number) => (
                          <button
                            key={idx}
                            onClick={() => selectQuizAnswer(idx)}
                            className={`w-full text-left p-4 rounded-xl border-2 transition-all flex items-start gap-3 ${
                              quizAnswers[currentQuestionIndex] === idx
                                ? 'border-violet-600 bg-violet-50'
                                : 'border-slate-200 hover:border-violet-300 hover:bg-slate-50'
                            }`}
                          >
                            <span className={`flex-shrink-0 flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                              quizAnswers[currentQuestionIndex] === idx
                                ? 'bg-violet-600 text-white'
                                : 'bg-slate-100 text-slate-500'
                            }`}>
                              {String.fromCharCode(65 + idx)}
                            </span>
                            <span className="font-medium text-slate-700">{option}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex justify-between">
                    <button
                      onClick={goToPreviousQuestion}
                      disabled={currentQuestionIndex === 0}
                      className="px-4 py-2 text-slate-600 hover:text-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Previous
                    </button>
                    {currentQuestionIndex === quizQuestions.length - 1 ? (
                      <button
                        onClick={submitQuiz}
                        disabled={quizAnswers[currentQuestionIndex] === null}
                        className="px-6 py-2 bg-gradient-to-r from-violet-600 to-purple-600 text-white rounded-lg font-semibold hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Submit Quiz
                      </button>
                    ) : (
                      <button
                        onClick={goToNextQuestion}
                        disabled={quizAnswers[currentQuestionIndex] === null}
                        className="px-6 py-2 bg-gradient-to-r from-violet-600 to-purple-600 text-white rounded-lg font-semibold hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Next
                      </button>
                    )}
                  </div>
                </>
              ) : (
                <div className="text-center">
                  <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center">
                    <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <h3 className="text-2xl font-bold text-slate-900 mb-2">Quiz Complete!</h3>
                  <p className="text-lg text-slate-600 mb-4">
                    You scored <span className="font-bold text-violet-600">{quizScore}</span> out of <span className="font-bold text-violet-600">{quizQuestions.length}</span>
                  </p>
                  <p className="text-slate-500 mb-6">
                    {quizScore === quizQuestions.length
                      ? 'Perfect! You mastered this lecture!'
                      : quizScore >= quizQuestions.length * 0.7
                      ? 'Great job! Keep up the good work!'
                      : 'Keep practicing to improve your understanding.'}
                  </p>

                  {quizScore < quizQuestions.length && (
                    <div className="text-left mb-6">
                      <p className="text-sm font-semibold text-slate-700 mb-3">
                        Review what you missed
                      </p>
                      <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                        {quizQuestions.map((q, i) => {
                          const selected = quizAnswers[i];
                          if (selected === q.correctIndex) return null;
                          return (
                            <div key={i} className="p-3.5 rounded-xl border border-rose-200 bg-rose-50">
                              <p className="text-sm font-medium text-slate-800 mb-2">
                                {i + 1}. {q.question}
                              </p>
                              <p className="text-sm text-rose-700 mb-1">
                                <span className="font-semibold">Your answer: </span>
                                {selected !== null ? q.options[selected] : 'No answer selected'}
                              </p>
                              <p className="text-sm text-emerald-700">
                                <span className="font-semibold">Correct answer: </span>
                                {q.options[q.correctIndex]}
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <button
                    onClick={closeQuiz}
                    className="px-6 py-3 bg-gradient-to-r from-violet-600 to-purple-600 text-white rounded-xl font-semibold hover:shadow-lg transition-all"
                  >
                    Close
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
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