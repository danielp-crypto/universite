'use client';

import React, { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { apiGet, apiPost } from '@/lib/api/client';
import { getSession } from '@/lib/supabase/auth';
import { supabase } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import WaveformVisualizer from '../components/WaveformVisualizer';
import AudioPlayer from '../components/AudioPlayer';
import Alert from '../components/Alert';
import Notifications from '../components/Notifications';
import { uploadWithProgress } from '@/lib/supabase/uploadWithProgress';

function HomePageContent() {
  const router = useRouter();
  const [lectures, setLectures] = useState<any[]>([]);
  const [stats, setStats] = useState({ lectures: 0, selfTests: 0, aiChats: 0 });
  const [streak, setStreak] = useState(0);
  const [profileWidgetVisible, setProfileWidgetVisible] = useState(false);
  const [profileModalVisible, setProfileModalVisible] = useState(false);
  const [userProfile, setUserProfile] = useState<any>(null);

  // Alert state
  const [alertOpen, setAlertOpen] = useState(false);
  const [alertTitle, setAlertTitle] = useState('');
  const [alertMessage, setAlertMessage] = useState('');
  const [alertType, setAlertType] = useState<'error' | 'warning' | 'info' | 'success'>('info');
  const [alertActionUrl, setAlertActionUrl] = useState<string | undefined>(undefined);

  const showAlert = (title: string, message: string, type: 'error' | 'warning' | 'info' | 'success' = 'info', actionUrl?: string) => {
    setAlertTitle(title);
    setAlertMessage(message);
    setAlertType(type);
    setAlertActionUrl(actionUrl);
    setAlertOpen(true);
  };

  // Modules state
  const [modules, setModules] = useState<any[]>([]);
  const [selectedModule, setSelectedModule] = useState<string | null>(null);
  const [globalCredits, setGlobalCredits] = useState({ used: 0, allocated: 4 });
  const [showCreateModuleModal, setShowCreateModuleModal] = useState(false);
  const [newModuleName, setNewModuleName] = useState('');

  // Processing states
  const [processingSteps, setProcessingSteps] = useState<string[]>([]);
  const [currentStep, setCurrentStep] = useState(0);
  const [processingError, setProcessingError] = useState<string | null>(null);

  // Drag and drop states
  const [isDragging, setIsDragging] = useState(false);

  // Recording states
  const [recordingState, setRecordingState] = useState<'idle' | 'recording' | 'processing'>('idle');
  const [recordingTimer, setRecordingTimer] = useState('00:00');
  const [processingText, setProcessingText] = useState('Saving audio...');
  const [audioStream, setAudioStream] = useState<MediaStream | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);

  const mediaRecorderRef = useRef<any>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingStartTimeRef = useRef<number | null>(null);
  const recordingTimerIntervalRef = useRef<any>(null);
  const wakeLockRef = useRef<any>(null);

  // Profile form refs
  const formRef = useRef<HTMLFormElement>(null);

  const RECORDINGS_STORAGE_KEY = 'universite_recordings';
  const STREAK_STORAGE_KEY = 'universite_streak';
  const MAX_UPLOAD_SIZE_BYTES = 50 * 1024 * 1024; // 50MB

  // Helper to load recordings
  const getRecordings = () => {
    try {
      const recordings = localStorage.getItem(RECORDINGS_STORAGE_KEY);
      return recordings ? JSON.parse(recordings) : [];
    } catch (error) {
      console.error('Error getting recordings:', error);
      return [];
    }
  };

  // Helper to save recordings
  const saveRecordings = (recordings: any[]) => {
    try {
      localStorage.setItem(RECORDINGS_STORAGE_KEY, JSON.stringify(recordings));
    } catch (error) {
      console.error('Error saving recordings:', error);
      showAlert('Error', 'Error saving recording. Storage may be full.', 'error');
    }
  };

  // Streak tracking functions
  const loadStreak = () => {
    try {
      const streakData = localStorage.getItem(STREAK_STORAGE_KEY);
      if (streakData) {
        const { streak, lastActivityDate } = JSON.parse(streakData);
        const today = new Date().toDateString();
        const yesterday = new Date(Date.now() - 86400000).toDateString();
        
        if (lastActivityDate === today) {
          setStreak(streak);
        } else if (lastActivityDate === yesterday) {
          // Streak continues from yesterday, but we don't increment until user does something today
          setStreak(streak);
        } else {
          // Streak broken - reset to 0
          setStreak(0);
          localStorage.setItem(STREAK_STORAGE_KEY, JSON.stringify({ streak: 0, lastActivityDate: today }));
        }
      }
    } catch (error) {
      console.error('Error loading streak:', error);
      setStreak(0);
    }
  };

  const updateStreak = () => {
    try {
      const streakData = localStorage.getItem(STREAK_STORAGE_KEY);
      const today = new Date().toDateString();
      const yesterday = new Date(Date.now() - 86400000).toDateString();
      
      let newStreak = 1;
      
      if (streakData) {
        const { streak, lastActivityDate } = JSON.parse(streakData);
        if (lastActivityDate === today) {
          // Already did something today, keep same streak
          newStreak = streak;
        } else if (lastActivityDate === yesterday) {
          // Did something yesterday, increment streak
          newStreak = streak + 1;
        }
        // Else: streak broken, start fresh at 1
      }
      
      console.log('Updating streak:', { newStreak, lastActivityDate: today });
      setStreak(newStreak);
      localStorage.setItem(STREAK_STORAGE_KEY, JSON.stringify({ streak: newStreak, lastActivityDate: today }));
    } catch (error) {
      console.error('Error updating streak:', error);
      // Even if there's an error, try to set a default streak
      const today = new Date().toDateString();
      setStreak(1);
      localStorage.setItem(STREAK_STORAGE_KEY, JSON.stringify({ streak: 1, lastActivityDate: today }));
    }
  };

  const loadModules = async () => {
    try {
      const session = await getSession();
      if (!session) return;

      const response = await fetch('/api/modules', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });

      if (response.ok) {
        const modulesData = await response.json();
        setModules(modulesData || []);
        // Set global credits from first module (all modules now share the same global credits)
        if (modulesData && modulesData.length > 0) {
          setGlobalCredits({
            used: modulesData[0].credits_used || 0,
            allocated: modulesData[0].credits_allocated || 4
          });
        }
      }
    } catch (error) {
      console.error('Error loading modules:', error);
    }
  };

  const createModule = async (name: string) => {
    try {
      const session = await getSession();
      if (!session) return;

      const response = await fetch('/api/modules', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ name })
      });

      if (response.ok) {
        const newModule = await response.json();
        setModules([...modules, newModule]);
        setSelectedModule(newModule.id);
        setShowCreateModuleModal(false);
        setNewModuleName('');
        showAlert('Success', 'Module created successfully!', 'success');
      } else {
        showAlert('Error', 'Failed to create module', 'error');
      }
    } catch (error) {
      console.error('Error creating module:', error);
      showAlert('Error', 'Failed to create module', 'error');
    }
  };

  const loadData = async () => {
    try {
      const session = await getSession();
      if (!session) {
        router.push('/login');
        return;
      }

      // Load remote lectures only
      let allLectures = [];
      try {
        const remoteLectures = await apiGet('/api/lectures');
        if (remoteLectures) {
          allLectures = remoteLectures;
        }
      } catch (error) {
        console.error('Error fetching lectures:', error);
      }

      // Sort and slice top 3
      allLectures.sort((a: any, b: any) => new Date(b.created_at || b.createdAt).getTime() - new Date(a.created_at || a.createdAt).getTime());
      setLectures(allLectures);

      // Update weekly stats
      updateWeeklyStats(allLectures);
    } catch (err) {
      console.error('Error in loadData:', err);
    }
  };

  const updateWeeklyStats = async (allLectures: any[]) => {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const diff = now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
    const weekStart = new Date(now.setDate(diff));
    weekStart.setHours(0, 0, 0, 0);

    const weeklyLectures = allLectures.filter(lecture => {
      const lectureDate = new Date(lecture.created_at || lecture.createdAt);
      return lectureDate >= weekStart;
    });

    const lectureCount = weeklyLectures.length;

    // Self-tests and AI chats are logged server-side, so they're durable
    // across devices — pull this week's counts from Supabase instead of
    // localStorage.
    let selfTestCount = 0;
    try {
      // A "self-test" is a completed quiz (app/lecture-detail's Quiz Bank
      // flow), one row per submission in quiz_results — not flashcard usage.
      const quizResponse = await apiGet(`/api/quiz-results?since=${encodeURIComponent(weekStart.toISOString())}`);
      if (quizResponse?.quizResults) {
        selfTestCount = quizResponse.quizResults.length;
      }
    } catch (error) {
      console.error('Error getting quiz results:', error);
    }

    let aiChatCount = 0;
    try {
      const response = await apiGet(`/api/analytics/event?since=${encodeURIComponent(weekStart.toISOString())}`);
      if (response?.success && response.counts) {
        aiChatCount = response.counts.ai_chat || 0;
      }
    } catch (error) {
      console.error('Error getting study events:', error);
    }

    setStats({
      lectures: lectureCount,
      selfTests: selfTestCount,
      aiChats: aiChatCount
    });
  };

  const checkProfileCompletion = async () => {
    try {
      const session = await getSession();
      if (!session) return;

      const userId = session.user.id;
      const { data: profile } = await supabase
        .from('profiles')
        .select('university, major, year, study_time, learning_style, full_name')
        .eq('user_id', userId)
        .single();

      setUserProfile(profile);

      // Check if dismissed recently
      const dismissed = localStorage.getItem('profile_widget_dismissed');
      const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);

      if (dismissed && parseInt(dismissed) > sevenDaysAgo) {
        return;
      }

      if (!profile || !profile.university || !profile.major) {
        setProfileWidgetVisible(true);
      }
    } catch (error) {
      console.error('Error checking profile:', error);
    }
  };

  useEffect(() => {
    loadData();
    loadModules();
    checkProfileCompletion();
    loadStreak();

    return () => {
      if (recordingTimerIntervalRef.current) clearInterval(recordingTimerIntervalRef.current);
    };
  }, []);
// The upload/recording pipeline processes lectures asynchronously in the
  // background (Deepgram + summary generation) — loadData() only fetches
  // once on mount, so without this, a lecture that finishes while the
  // student is still on the dashboard would show "Processing" forever until
  // they navigate away and back (which forces a fresh fetch). Poll while
  // anything is still processing, and stop automatically once nothing is.
  useEffect(() => {
    const hasProcessing = lectures.some((l: any) => l.status === 'processing');
    if (!hasProcessing) return;

    const interval = setInterval(() => {
      loadData();
    }, 5000);

    return () => clearInterval(interval);
  }, [lectures]);
  // Warn before the tab is closed/refreshed while a recording is in progress
  // or being transcribed/summarized — there's no queue yet, so navigating
  // away mid-recording or mid-processing loses the recording entirely.
  useEffect(() => {
    if (recordingState !== 'processing' && recordingState !== 'recording') return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [recordingState]);

  // Keep the screen from auto-locking while recording or processing. This
  // is the main defense against phones/laptops sleeping mid-lecture: the
  // Wake Lock API stops the OS's normal screen-timeout from kicking in.
  // It can't stop someone manually pressing the power button or switching
  // apps, so it's paired with the beforeunload/visibility warnings above
  // and below rather than relied on alone. Not supported everywhere (older
  // Safari, some Firefox versions) — fails silently there, same behavior
  // as today.
  useEffect(() => {
    if (recordingState !== 'recording' && recordingState !== 'processing') return;
    if (!('wakeLock' in navigator)) return;

    let cancelled = false;

    const requestWakeLock = async () => {
      try {
        const lock = await (navigator as any).wakeLock.request('screen');
        if (cancelled) {
          // State changed while the request was in flight; release immediately.
          lock.release().catch(() => {});
          return;
        }
        wakeLockRef.current = lock;
      } catch (err) {
        // Common causes: tab not visible yet, battery saver mode, or the
        // browser just doesn't support it. Recording/processing still
        // works — the user just won't get the auto-sleep protection.
        console.warn('Wake Lock request failed:', err);
      }
    };

    requestWakeLock();

    // The lock is released automatically whenever the tab is hidden (screen
    // locked, app switched away from), and browsers don't re-grant it on
    // their own — we have to ask again once the tab is visible again.
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && !wakeLockRef.current) {
        requestWakeLock();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (wakeLockRef.current) {
        wakeLockRef.current.release().catch(() => {});
        wakeLockRef.current = null;
      }
    };
  }, [recordingState]);

  // Recording Handlers
  const startRecording = async () => {
    // Check if module is selected
    if (!selectedModule) {
      showAlert('Module Required', 'Please select or create a module before recording a lecture.', 'warning');
      return;
    }

    // Check if user has credits available
    if (globalCredits.used >= globalCredits.allocated) {
      showAlert('No Credits', 'You have used all your credits. Please upgrade to continue.', 'warning');
      router.push('/pricing');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setAudioStream(stream);
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
        setAudioStream(null);
        await saveRecording(audioBlob);
      };

      mediaRecorderRef.current.start();
      setRecordingState('recording');
      recordingStartTimeRef.current = Date.now();
      
      // Start Timer
      recordingTimerIntervalRef.current = setInterval(() => {
        if (recordingStartTimeRef.current) {
          const elapsed = Math.floor((Date.now() - recordingStartTimeRef.current) / 1000);
          const minutes = Math.floor(elapsed / 60);
          const seconds = elapsed % 60;
          setRecordingTimer(`${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`);
        }
      }, 1000);
    } catch (error) {
      console.error('Error accessing microphone:', error);
      showAlert('Microphone Error', 'Could not access microphone. Please check permissions.', 'error');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && recordingState === 'recording') {
      mediaRecorderRef.current.stop();
      setRecordingState('processing');
      setProcessingText('Saving audio...');
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
    setAudioStream(null);
    audioChunksRef.current = [];
    if (recordingTimerIntervalRef.current) {
      clearInterval(recordingTimerIntervalRef.current);
      recordingTimerIntervalRef.current = null;
    }
  };

  const saveRecording = async (blob: Blob) => {
    // Check if module is selected
    if (!selectedModule) {
      showAlert('Module Required', 'Please select a module before recording a lecture.', 'warning');
      setRecordingState('idle');
      return;
    }

    // Check if user has credits available
    if (globalCredits.used >= globalCredits.allocated) {
      showAlert('No Credits', 'You have used all your credits. Please upgrade to continue.', 'warning');
      setRecordingState('idle');
      router.push('/pricing');
      return;
    }

    if (blob.size > MAX_UPLOAD_SIZE_BYTES) {
      showAlert(
        'Recording too large',
        `This recording is ${(blob.size / (1024 * 1024)).toFixed(1)}MB, over the 50MB limit. This is unusual for audio — please try a shorter recording.`,
        'warning'
      );
      setRecordingState('idle');
      return;
    }

    try {
      // Update streak immediately when recording is saved
      updateStreak();

      const elapsed = recordingStartTimeRef.current
        ? Math.floor((Date.now() - recordingStartTimeRef.current) / 1000)
        : 0;

      setProcessingText('Uploading recording...');
      setUploadProgress(0);

      const session = await getSession();
      if (!session) {
        setProcessingError('Please log in to save recordings');
        setRecordingState('idle');
        setUploadProgress(null);
        return;
      }

      // Same async pipeline as file uploads: upload straight to Supabase
      // Storage, hand off to Deepgram, and return immediately — the student
      // doesn't need to stay in the lecture hall waiting for transcription
      // and summary generation to finish.
      const randomId = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      const storagePath = `${session.user.id}/${randomId}.webm`;

      try {
        await uploadWithProgress(
          'lecture-media',
          storagePath,
          blob,
          session.access_token,
          'audio/webm',
          (percent) => {
            setUploadProgress(percent);
            setProcessingText(`Uploading recording... ${percent}%`);
          }
        );
      } catch (uploadError) {
        console.error('Error uploading recording to storage:', uploadError);
        setProcessingError('Failed to upload recording. Please try again.');
        setRecordingState('idle');
        setUploadProgress(null);
        return;
      }

      setUploadProgress(null);
      setProcessingText('Starting transcription...');

      const lectureNumber = lectures.length + 1;

      const startResponse = await fetch('/api/lectures/start-processing', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          title: `Lecture ${lectureNumber}`,
          duration: elapsed,
          module_id: selectedModule,
          mime_type: 'audio/webm',
          file_path: storagePath,
          file_size: blob.size
        })
      });

      if (!startResponse.ok) {
        setProcessingError('Failed to start processing. Please try again.');
        setRecordingState('idle');
        return;
      }

      updateStreak();
      setRecordingState('idle');
      loadData();

      showAlert(
        'Recording saved — processing started',
        "We're transcribing and summarizing your lecture now. You'll get a notification when it's ready — no need to wait around.",
        'success'
      );

    } catch (error) {
      console.error('Error saving recording:', error);
      setProcessingError('An unexpected error occurred. Please try again.');
      setRecordingState('idle');
      setUploadProgress(null);
    }
  };

  const deleteRecording = async (id: string) => {
    try {
      const recordings = getRecordings();
      const filtered = recordings.filter((r: any) => r.id !== id);
      saveRecordings(filtered);
      loadData();
    } catch (error) {
      console.error('Error deleting recording:', error);
      showAlert('Error', 'Error deleting recording', 'error');
    }
  };

  const deleteSupabaseLecture = async (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      const session = await getSession();
      if (!session) return;

      const { error } = await supabase
        .from('lectures')
        .delete()
        .eq('id', id);

      if (error) {
        showAlert('Error', 'Error deleting lecture: ' + error.message, 'error');
        return;
      }

      loadData();
    } catch (error) {
      console.error('Error deleting lecture:', error);
      showAlert('Error', 'Error deleting lecture', 'error');
    }
  };

  const shareRecording = async (lecture: any) => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: lecture.title,
          text: `Check out this lecture: ${lecture.title}`,
          url: window.location.href
        });
      } else {
        // Fallback: copy to clipboard
        navigator.clipboard.writeText(window.location.href);
        showAlert('Success', 'Link copied to clipboard', 'success');
      }
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };

  const downloadRecording = async (lecture: any) => {
    try {
      const response = await fetch(lecture.audioUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${lecture.title || 'recording'}.webm`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Error downloading recording:', error);
      showAlert('Error', 'Error downloading recording', 'error');
    }
  };

  const uploadRecording = async (file: File) => {
    // Check if module is selected
    if (!selectedModule) {
      showAlert('Module Required', 'Please select a module before uploading a lecture.', 'warning');
      return;
    }

    // Check if user has credits available
    if (globalCredits.used >= globalCredits.allocated) {
      showAlert('No Credits', 'You have used all your credits. Please upgrade to continue.', 'warning');
      router.push('/pricing');
      return;
    }

    if (file.size > MAX_UPLOAD_SIZE_BYTES) {
      showAlert(
        'File too large',
        `This file is ${(file.size / (1024 * 1024)).toFixed(1)}MB. The maximum allowed size is 50MB — try a shorter recording or a more compressed format.`,
        'warning'
      );
      return;
    }

    try {
      // Update streak immediately when file is uploaded
      updateStreak();

      setProcessingSteps(['Uploading file...']);
      setCurrentStep(0);
      setProcessingText('Uploading file...');
      setUploadProgress(0);
      setRecordingState('processing');
      setProcessingError(null);

      const session = await getSession();
      if (!session) {
        setProcessingError('Please log in to upload recordings');
        setUploadProgress(null);
        return;
      }

      // Get duration from file. A <video> element reliably reads metadata for
      // both audio-only and video files.
      const mediaDuration = await new Promise<number>((resolve) => {
        const mediaEl = document.createElement('video');
        mediaEl.preload = 'metadata';
        mediaEl.onloadedmetadata = () => resolve(mediaEl.duration);
        mediaEl.onerror = () => resolve(0);
        mediaEl.src = URL.createObjectURL(file);
      });

      // Upload the raw file straight to Supabase Storage — Deepgram will
      // fetch it directly from there. Nothing is decoded or chunked in the
      // browser anymore: no memory pressure on the student's device, no
      // Vercel body-size limit to work around, and it works the same way
      // regardless of file length.
      const fileExt = file.name.includes('.') ? file.name.split('.').pop() : 'bin';
      const randomId = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      const storagePath = `${session.user.id}/${randomId}.${fileExt}`;

      try {
        await uploadWithProgress(
          'lecture-media',
          storagePath,
          file,
          session.access_token,
          file.type,
          (percent) => {
            setUploadProgress(percent);
            setProcessingText(`Uploading file... ${percent}%`);
          }
        );
      } catch (uploadError) {
        console.error('Error uploading to storage:', uploadError);
        setProcessingError('Failed to upload file. Please try again.');
        setRecordingState('idle');
        setUploadProgress(null);
        return;
      }

      setUploadProgress(null);
      setProcessingText('Starting transcription...');

      // Create the lecture immediately (as "processing") and hand off to
      // Deepgram asynchronously — this call returns fast regardless of how
      // long the lecture is, since we don't wait for transcription here.
      const startResponse = await fetch('/api/lectures/start-processing', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          title: file.name.replace(/\.[^/.]+$/, ''),
          duration: Math.floor(mediaDuration),
          module_id: selectedModule,
          mime_type: file.type,
          file_path: storagePath,
          file_size: file.size
        })
      });

      if (!startResponse.ok) {
        setProcessingError('Failed to start processing. Please try again.');
        setRecordingState('idle');
        return;
      }

      // Reload modules to update global credit display (credit was recorded
      // server-side in start-processing)
      loadModules();

      updateStreak();
      setRecordingState('idle');
      loadData();

      showAlert(
        'Lecture uploaded — processing started',
        "We're transcribing and summarizing your lecture now. You'll get a notification when it's ready — feel free to keep using the app in the meantime.",
        'success'
      );

    } catch (error) {
      console.error('Error uploading recording:', error);
      setProcessingError('An unexpected error occurred. Please try again.');
      setRecordingState('idle');
      setUploadProgress(null);
    }
  };

  const handleFileUpload = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'audio/*,video/*';
    input.onchange = async (e: any) => {
      const file = e.target.files[0];
      if (file) {
        await uploadRecording(file);
      }
    };
    input.click();
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      const file = files[0];
      if (file.type.startsWith('audio/') || file.type.startsWith('video/')) {
        await uploadRecording(file);
      } else {
        setProcessingError('Please upload an audio or video file');
      }
    }
  };

  // Profile management
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formRef.current) return;

    const formData = new FormData(formRef.current);
    try {
      const session = await getSession();
      if (!session) return;

      const userId = session.user.id;
      const fullName = formData.get('full_name');
      const { error } = await supabase
        .from('profiles')
        .upsert({
          user_id: userId,
          full_name: fullName,
          first_name: fullName?.toString().split(' ')[0] || '',
          last_name: fullName?.toString().split(' ').slice(1).join(' ') || '',
          university: formData.get('university'),
          major: formData.get('major'),
          year: formData.get('year'),
          study_time: formData.get('study_time'),
          learning_style: formData.get('learning_style'),
          updated_at: new Date().toISOString()
        });

      if (error) {
        showAlert('Error', 'Error saving profile: ' + error.message, 'error');
        return;
      }

      setUserProfile({
        full_name: formData.get('full_name'),
        university: formData.get('university'),
        major: formData.get('major'),
        year: formData.get('year'),
        study_time: formData.get('study_time'),
        learning_style: formData.get('learning_style')
      });

      setProfileModalVisible(false);
      setProfileWidgetVisible(false);
      showAlert('Success', 'Profile saved successfully!', 'success');
    } catch (err) {
      console.error(err);
      showAlert('Error', 'Error saving profile. Please try again.', 'error');
    }
  };

  const formatDate = (date: Date) => {
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="bg-slate-50 min-h-screen font-sans flex flex-col justify-between">
      <div id="app" className="flex-1 flex flex-col pb-20">
        {/* Header */}
        <div className="bg-white border-b border-slate-200 px-4 py-3 md:py-4 sticky top-0 z-10">
          <div className="mx-auto w-full max-w-[430px] md:max-w-[680px] lg:max-w-[800px]">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg">
                  <img alt="Universite logo" className="w-6 h-6 md:w-7 md:h-7 object-contain" src="/assets/images/icon-white-removebg.png" />
                </div>
                <h1 className="text-lg md:text-xl font-semibold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                  Universite
                </h1>
              </div>
              <div className="flex items-center gap-3">
                <Link href="/pricing" className="text-sm font-medium text-indigo-600 hover:text-indigo-700">
                  Upgrade
                </Link>
                <Notifications />
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 mx-auto w-full max-w-[430px] md:max-w-[680px] lg:max-w-[800px] px-4 py-6">
          {/* Module Selector */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-slate-700 mb-2">Select a Module first before recording/uploading a lecture (Required)</label>
            <div className="flex gap-2">
              <select
                value={selectedModule || ''}
                onChange={(e) => setSelectedModule(e.target.value || null)}
                className="flex-1 px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">Select a module...</option>
                {modules.map((module) => (
                  <option key={module.id} value={module.id}>{module.name}</option>
                ))}
              </select>
              <button
                onClick={() => setShowCreateModuleModal(true)}
                className="px-4 py-2 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-lg text-sm font-medium hover:shadow-md transition-all active:scale-95"
              >
                + New
              </button>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="mb-6">
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={startRecording}
                className="block p-4 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl shadow-md active:scale-95 transition-transform"
              >
                <div className="flex flex-col items-center text-center text-white">
                  <svg className="w-10 h-10 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                  </svg>
                  <span className="font-semibold text-sm">Record Lecture</span>
                </div>
              </button>
              <div
                onClick={handleFileUpload}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`block p-4 bg-white border-2 rounded-2xl active:scale-95 transition-transform cursor-pointer ${
                  isDragging ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200'
                }`}
              >
                <div className="flex flex-col items-center text-center text-slate-700">
                  <svg className="w-10 h-10 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                  <span className="font-semibold text-sm">{isDragging ? 'Drop file here' : 'Upload Audio or Video'}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Profile Completion Widget */}
          {profileWidgetVisible && (
            <div id="profile-widget" className="mb-6">
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-6">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0">
                    <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                      <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    </div>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-slate-800 mb-2">Complete Your Profile</h3>
                    <p className="text-slate-600 mb-4 text-sm">Tell us about yourself to get personalized AI assistance and study recommendations</p>
                    <div className="flex flex-wrap gap-2 mb-4">
                      <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">Better AI</span>
                      <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">Study Tips</span>
                      <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-medium">Course Help</span>
                    </div>
                    <button
                      onClick={() => setProfileModalVisible(true)}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
                    >
                      Add Details (2 min)
                    </button>
                    <button
                      onClick={() => {
                        setProfileWidgetVisible(false);
                        localStorage.setItem('profile_widget_dismissed', Date.now().toString());
                      }}
                      className="ml-3 text-slate-500 hover:text-slate-700 transition-colors text-sm"
                    >
                      Maybe Later
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Recent Lectures */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold text-slate-800">Recent Lectures</h2>
              <Link href="/lectures" className="text-sm text-indigo-600 font-medium">View All</Link>
            </div>
            
            {lectures.length > 0 ? (
              <div className="space-y-3">
                {lectures.slice(0, 3).map((lecture) => {
                  const dateStr = formatDate(new Date(lecture.created_at || lecture.createdAt));
                  const isLocal = lecture.isLocal || !!lecture.local_audio;
                  
                  if (isLocal) {
                    return (
                      <div key={lecture.id} className="bg-gradient-to-br from-white to-slate-50 border border-slate-200 rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1">
                            <h3 className="text-base font-semibold text-slate-800 mb-1">{lecture.title}</h3>
                            <div className="flex items-center gap-2 text-xs text-slate-500">
                              <span>{dateStr}</span>
                              <span>•</span>
                              <span>{lecture.duration || 'N/A'}</span>
                              <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs font-medium">Local</span>
                            </div>
                          </div>
                        </div>
                        <AudioPlayer src={lecture.audioUrl} className="mb-3" />
                        <div className="flex gap-2">
                          <Link href={`/lecture-detail?id=${lecture.id}`} className="flex-1 px-3 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm font-medium text-center active:scale-95 transition-transform hover:bg-slate-200">
                            Review
                          </Link>
                          <Link href={`/assistant?lecture=${lecture.id}`} className="flex-1 px-3 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium text-center active:scale-95 transition-transform hover:bg-indigo-700">
                            Ask Lecture
                          </Link>
                        </div>
                      </div>
                    );
                  } else {
                    return (
                      <div
                        key={lecture.id}
                        className="bg-gradient-to-br from-white to-slate-50 border border-slate-200 rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow"
                      >
                        <div className="flex items-start justify-between mb-2">
                          <Link
                            href={`/lecture-detail?id=${lecture.id}`}
                            className="flex-1 min-w-0"
                          >
                            <h3 className="text-base font-semibold text-slate-800 hover:text-indigo-600 transition-colors truncate">{lecture.title}</h3>
                          </Link>
                          {lecture.status === 'processing' && (
                            <span className="ml-2 flex-shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 text-amber-700 rounded-full text-xs font-medium">
                              <span className="inline-block w-2 h-2 border-2 border-amber-300 border-t-amber-600 rounded-full animate-spin"></span>
                              Processing
                            </span>
                          )}
                          {lecture.status === 'failed' && (
                            <span className="ml-2 flex-shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 bg-red-50 text-red-700 rounded-full text-xs font-medium">
                              Failed
                            </span>
                          )}
                          <button
                            onClick={(e) => deleteSupabaseLecture(lecture.id, e)}
                            className="ml-2 p-1 text-slate-400 hover:text-red-600 transition-colors flex-shrink-0"
                            title="Delete"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-slate-500 mb-3">
                          <span>{dateStr}</span>
                          <span>•</span>
                          <span>{lecture.duration || 'N/A'}</span>
                          {lecture.module && (
                            <>
                              <span>•</span>
                              <div className="flex items-center gap-1">
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                                </svg>
                                <span className="text-indigo-600 font-medium">{lecture.module.name}</span>
                              </div>
                            </>
                          )}
                        </div>
                        {lecture.keyConcepts && lecture.keyConcepts.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mb-3">
                            {lecture.keyConcepts.slice(0, 5).map((concept: string, idx: number) => (
                              <span key={idx} className="px-2 py-1 bg-indigo-50 text-indigo-700 rounded-full text-xs font-medium">{concept}</span>
                            ))}
                          </div>
                        )}
                        <div className="flex gap-2">
                          {lecture.status === 'processing' ? (
                            <span
                              className="flex-1 px-3 py-2 bg-slate-50 text-slate-400 rounded-lg text-sm font-medium text-center cursor-not-allowed select-none"
                              title="Available once transcription and notes are ready"
                            >
                              Review
                            </span>
                          ) : (
                            <Link href={`/lecture-detail?id=${lecture.id}`} className="flex-1 px-3 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm font-medium text-center active:scale-95 transition-transform hover:bg-slate-200">
                              Review
                            </Link>
                          )}
                          {lecture.status === 'processing' ? (
                            <span
                              className="flex-1 px-3 py-2 bg-indigo-200 text-indigo-400 rounded-lg text-sm font-medium text-center cursor-not-allowed select-none"
                              title="Available once transcription and notes are ready"
                            >
                              Ask Lecture
                            </span>
                          ) : (
                            <Link href={`/assistant?lecture=${lecture.id}`} className="flex-1 px-3 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium text-center active:scale-95 transition-transform hover:bg-indigo-700">
                              Ask Lecture
                            </Link>
                          )}
                        </div>
                      </div>
                    );
                  }
                })}
              </div>
            ) : (
              <div className="text-center py-8 bg-white border border-slate-200 rounded-2xl">
                <p className="text-slate-500 mb-4 text-sm">No lectures yet</p>
                <button
                  onClick={startRecording}
                  className="inline-block px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-medium"
                >
                  Record or Upload Your First Lecture
                </button>
              </div>
            )}
          </div>

          {/* Study Stats */}
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-slate-800 mb-3">This Week</h2>
            <div className="grid grid-cols-4 gap-3">
              <div className="bg-white border border-slate-200 rounded-xl p-3 text-center">
                <div className="text-2xl font-bold text-indigo-600 mb-1">{stats.lectures}</div>
                <div className="text-xs text-slate-600">Lectures</div>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-3 text-center">
                <div className="text-2xl font-bold text-violet-600 mb-1">{stats.selfTests}</div>
                <div className="text-xs text-slate-600">Self-Tests</div>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-3 text-center">
                <div className="text-2xl font-bold text-purple-600 mb-1">{stats.aiChats}</div>
                <div className="text-xs text-slate-600">Lecture Chats</div>
              </div>
              <div className="bg-gradient-to-br from-orange-50 to-red-50 border border-orange-200 rounded-xl p-3 text-center">
                <div className="text-2xl font-bold text-orange-600 mb-1 flex items-center justify-center gap-1">
                  🔥 {streak}
                </div>
                <div className="text-xs text-slate-600">Day Streak</div>
              </div>
            </div>
          </div>

          {/* Credits Display */}
          <div className="mb-6">
            <div className="bg-gradient-to-br from-indigo-50 to-purple-50 border border-indigo-200 rounded-xl p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-slate-800 mb-1">Free Tier Credits</h3>
                  <p className="text-xs text-slate-600">Credits Used (Global)</p>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-indigo-600">
                    {globalCredits.used}/{globalCredits.allocated}
                  </div>
                  <div className="text-xs text-slate-600">Credits</div>
                </div>
              </div>
              <div className="mt-3 bg-white rounded-full h-2 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all"
                  style={{ width: `${(globalCredits.used / globalCredits.allocated) * 100}%` }}
                ></div>
              </div>
            </div>
          </div>

          {/* Study Tools Quick Links */}
          <div>
            <h2 className="text-lg font-semibold text-slate-800 mb-3">Study Tools</h2>
            <div className="space-y-2">
              <Link href="/pricing" className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-xl active:scale-[0.99] transition-transform w-full relative">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center">
                    <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                    </svg>
                  </div>
                  <div>
                    <div className="font-medium text-slate-800 text-sm">Exam Mode</div>
                    <div className="text-xs text-slate-500">Review key concepts</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Link href="/pricing" className="absolute -top-1 -right-1 bg-amber-400 text-amber-900 text-[10px] font-bold px-1.5 py-0.5 rounded-full hover:bg-amber-500 transition-colors">Upgrade</Link>
                  <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </Link>
            </div>
          </div>
        </div>

        {/* Bottom Navigation */}
        <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 safe-area-inset-bottom z-10">
          <div className="mx-auto w-full max-w-[430px] md:max-w-[680px] lg:max-w-[800px]">
            <div className="flex items-center justify-around py-2">
              <Link href="/dashboard" className="flex flex-col items-center py-2 px-4 text-indigo-600">
                <svg className="w-6 h-6 mb-1" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
                </svg>
                <span className="text-xs font-medium">Home</span>
              </Link>
              <Link href="/lectures" className="flex flex-col items-center py-2 px-4 text-slate-400 hover:text-slate-600">
                <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
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

      {/* Recording Overlay */}
      {recordingState === 'recording' && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
          <div className="bg-white rounded-2xl p-6 mx-4 max-w-sm w-full shadow-2xl">
            <div className="text-center">
              {/* Waveform Visualizer */}
              <div className="h-32 mb-4 bg-slate-50 rounded-xl overflow-hidden">
                <WaveformVisualizer 
                  stream={audioStream} 
                  isRecording={recordingState === 'recording'}
                  color="#6366f1"
                />
              </div>
              
              <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-red-105 flex items-center justify-center animate-pulse-recording">
                <div className="w-12 h-12 rounded-full bg-red-500"></div>
              </div>
              <h3 className="text-xl font-semibold text-slate-800 mb-2">Recording Your Lecture</h3>
              <div className="text-2xl font-mono text-slate-900 mb-4">{recordingTimer}</div>
              <p className="text-slate-400 text-xs mb-4">
                This tab and your screen are kept on while recording.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={stopRecording}
                  className="flex-1 px-4 py-3 bg-red-500 hover:bg-red-650 text-white rounded-xl font-medium active:scale-95 transition-transform"
                >
                  Stop
                </button>
                <button
                  onClick={cancelRecording}
                  className="flex-1 px-4 py-3 bg-slate-200 hover:bg-slate-250 text-slate-900 rounded-xl font-medium active:scale-95 transition-transform"
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
            {processingError ? (
              <div className="text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-100 flex items-center justify-center">
                  <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-slate-800 mb-2">Processing Failed</h3>
                <p className="text-slate-600 text-sm mb-4">{processingError}</p>
                <button
                  onClick={() => {
                    setProcessingError(null);
                    setRecordingState('idle');
                  }}
                  className="px-4 py-3 bg-slate-200 text-slate-900 rounded-xl font-medium hover:bg-slate-300 transition-colors"
                >
                  Close
                </button>
              </div>
            ) : (
              <div className="text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                  <svg className="w-8 h-8 text-white animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-slate-800 mb-4">Processing Lecture</h3>
                
                {/* Progress Steps */}
                <div className="space-y-3 mb-4">
                  {processingSteps.map((step, index) => (
                    <div key={index} className="flex items-center gap-3">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                        index < currentStep 
                          ? 'bg-green-500 text-white' 
                          : index === currentStep 
                          ? 'bg-indigo-600 text-white animate-pulse' 
                          : 'bg-slate-200 text-slate-400'
                      }`}>
                        {index < currentStep ? (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                          </svg>
                        ) : (
                          <span className="text-xs">{index + 1}</span>
                        )}
                      </div>
                      <span className={`text-sm ${
                        index < currentStep 
                          ? 'text-green-600 line-through' 
                          : index === currentStep 
                          ? 'text-indigo-600 font-medium' 
                          : 'text-slate-400'
                      }`}>
                        {step}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Upload progress bar - only shown during the actual upload,
                    since that's the only phase still tied to this tab
                    staying open. Once handed off to start-processing, the
                    rest happens server-side regardless of navigation. */}
                {uploadProgress !== null && (
                  <div className="mb-4">
                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-indigo-500 to-purple-600 rounded-full transition-all duration-150"
                        style={{ width: `${uploadProgress}%` }}
                      ></div>
                    </div>
                    <p className="text-slate-500 text-xs mt-1.5">{uploadProgress}% uploaded</p>
                  </div>
                )}

                {/* Live sub-status (e.g. "Transcribed 2 of 4 parts...") */}
                {processingText && (
                  <p className="text-indigo-500 text-xs font-medium mb-3">{processingText}</p>
                )}

                {uploadProgress !== null ? (
                  <p className="text-amber-600 text-xs font-semibold bg-amber-50 rounded-lg px-3 py-2">
                    ⚠️ Don't close this tab while uploading — you can navigate away freely once the upload finishes.
                  </p>
                ) : (
                  <p className="text-slate-500 text-xs">
                    Transcription and summarization now continue in the background — feel free to navigate away, you'll get a notification when it's ready.
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Profile Completion Modal */}
      {profileModalVisible && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 overflow-y-auto">
          <div className="bg-white rounded-2xl w-full max-w-md mx-auto max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-slate-800">Complete Your Profile</h2>
                <button
                  onClick={() => setProfileModalVisible(false)}
                  className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <form ref={formRef} onSubmit={handleSaveProfile} className="space-y-5">
                <div>
                  <label htmlFor="full_name" className="block text-sm font-medium text-slate-700 mb-2">Full Name</label>
                  <input
                    type="text"
                    id="full_name"
                    name="full_name"
                    defaultValue={userProfile?.full_name || ''}
                    className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all outline-none text-sm text-slate-800"
                    placeholder="Your full name"
                    required
                  />
                </div>

                <div>
                  <label htmlFor="university" className="block text-sm font-medium text-slate-700 mb-2">University</label>
                  <input
                    type="text"
                    id="university"
                    name="university"
                    defaultValue={userProfile?.university || ''}
                    className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all outline-none text-sm text-slate-800"
                    placeholder="Your university"
                    required
                  />
                </div>

                <div>
                  <label htmlFor="major" className="block text-sm font-medium text-slate-700 mb-2">Major/Field of Study</label>
                  <input
                    type="text"
                    id="major"
                    name="major"
                    defaultValue={userProfile?.major || ''}
                    className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all outline-none text-sm text-slate-800"
                    placeholder="e.g., Computer Science, Biology"
                    required
                  />
                </div>

                <div>
                  <label htmlFor="year" className="block text-sm font-medium text-slate-700 mb-2">Year of Study</label>
                  <select
                    id="year"
                    name="year"
                    defaultValue={userProfile?.year || ''}
                    className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all outline-none text-sm text-slate-800"
                  >
                    <option value="">Select your year</option>
                    <option value="freshman">Freshman</option>
                    <option value="sophomore">Sophomore</option>
                    <option value="junior">Junior</option>
                    <option value="senior">Senior</option>
                    <option value="graduate">Graduate</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="study_time" className="block text-sm font-medium text-slate-700 mb-2">Preferred Study Time</label>
                  <select
                    id="study_time"
                    name="study_time"
                    defaultValue={userProfile?.study_time || ''}
                    className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all outline-none text-sm text-slate-800"
                  >
                    <option value="">Select preference</option>
                    <option value="morning">Morning (6AM - 12PM)</option>
                    <option value="afternoon">Afternoon (12PM - 6PM)</option>
                    <option value="evening">Evening (6PM - 12AM)</option>
                    <option value="night">Night (12AM - 6AM)</option>
                    <option value="flexible">Flexible</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="learning_style" className="block text-sm font-medium text-slate-700 mb-2">Learning Style</label>
                  <select
                    id="learning_style"
                    name="learning_style"
                    defaultValue={userProfile?.learning_style || ''}
                    className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all outline-none text-sm text-slate-800"
                  >
                    <option value="">Select your style</option>
                    <option value="visual">Visual (diagrams, charts)</option>
                    <option value="auditory">Auditory (lectures, discussions)</option>
                    <option value="reading">Reading/Writing (notes, texts)</option>
                    <option value="kinesthetic">Hands-on (practice, projects)</option>
                    <option value="mixed">Mixed approach</option>
                  </select>
                </div>

                <div className="flex gap-3">
                  <button type="submit" className="flex-1 px-4 py-3 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition-colors">
                    Save Profile
                  </button>
                  <button type="button" onClick={() => setProfileModalVisible(false)} className="px-4 py-3 bg-slate-200 text-slate-700 rounded-xl font-medium hover:bg-slate-300 transition-colors">
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Create Module Modal */}
      {showCreateModuleModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md">
            <h3 className="text-xl font-semibold text-slate-900 mb-4">Create New Module</h3>
            <input
              type="text"
              value={newModuleName}
              onChange={(e) => setNewModuleName(e.target.value)}
              placeholder="e.g., Calculus 101, Physics, Chem1048"
              className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all text-slate-900 placeholder:text-slate-400 mb-4"
            />
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowCreateModuleModal(false);
                  setNewModuleName('');
                }}
                className="flex-1 px-4 py-3 bg-slate-100 text-slate-700 rounded-xl font-medium hover:bg-slate-200 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (newModuleName.trim()) {
                    createModule(newModuleName.trim());
                  }
                }}
                disabled={!newModuleName.trim()}
                className="flex-1 px-4 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-medium hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Create Module
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Alert Modal */}
      <Alert
        isOpen={alertOpen}
        onClose={() => setAlertOpen(false)}
        title={alertTitle}
        message={alertMessage}
        type={alertType}
        actionUrl={alertActionUrl}
      />
    </div>
  );
}

export default function HomePage() {
  return <HomePageContent />;
}