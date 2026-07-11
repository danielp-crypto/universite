'use client';

import React, { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { apiGet, apiPost } from '@/lib/api/client';
import { getSession } from '@/lib/supabase/auth';
import { supabase } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import WaveformVisualizer from '../components/WaveformVisualizer';
import AudioPlayer from '../components/AudioPlayer';
import UpgradeModal from '../components/UpgradeModal';
import Alert from '../components/Alert';

function HomePageContent() {
  const router = useRouter();
  const [lectures, setLectures] = useState<any[]>([]);
  const [stats, setStats] = useState({ lectures: 0, minutes: 0, flashcards: 0 });
  const [streak, setStreak] = useState(0);
  const [profileWidgetVisible, setProfileWidgetVisible] = useState(false);
  const [profileModalVisible, setProfileModalVisible] = useState(false);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);
  const [upgradeFeature, setUpgradeFeature] = useState('');

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

  const mediaRecorderRef = useRef<any>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingStartTimeRef = useRef<number | null>(null);
  const recordingTimerIntervalRef = useRef<any>(null);

  // Profile form refs
  const formRef = useRef<HTMLFormElement>(null);

  const RECORDINGS_STORAGE_KEY = 'universite_recordings';
  const STREAK_STORAGE_KEY = 'universite_streak';

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

  const updateWeeklyStats = (allLectures: any[]) => {
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

    let totalMinutes = 0;
    weeklyLectures.forEach(lecture => {
      const duration = lecture.duration || '0:00';
      const parts = duration.split(':');
      if (parts.length === 2) {
        totalMinutes += parseInt(parts[0]) * 60 + parseInt(parts[1]);
      }
    });
    const totalHours = (totalMinutes / 60).toFixed(1);

    let flashcardCount = 0;
    try {
      const flashcards = localStorage.getItem('universite_flashcards');
      if (flashcards) {
        const flashcardData = JSON.parse(flashcards);
        const weeklyFlashcards = flashcardData.filter((card: any) => {
          const cardDate = new Date(card.created_at || card.createdAt);
          return cardDate >= weekStart;
        });
        flashcardCount = weeklyFlashcards.length;
      }
    } catch (error) {
      console.error('Error getting flashcards:', error);
    }

    setStats({
      lectures: lectureCount,
      minutes: totalMinutes,
      flashcards: flashcardCount
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
      setUpgradeModalOpen(true);
      setUpgradeFeature('Record lectures');
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
    try {
      // Update streak immediately when recording is saved
      updateStreak();

      const elapsed = recordingStartTimeRef.current
        ? Math.floor((Date.now() - recordingStartTimeRef.current) / 1000)
        : 0;

      const mins = Math.floor(elapsed / 60);
      const secs = elapsed % 60;
      const durationStr = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

      // Initialize processing steps
      const steps = [
        'Processing audio for transcription...',
        'Transcribing audio with AI...',
        'Generating your study assets...',
        'Finalizing lecture...'
      ];
      setProcessingSteps(steps);
      setCurrentStep(0);
      setProcessingText(steps[0]);

      const session = await getSession();
      if (!session) {
        setProcessingError('Please log in to save recordings');
        return;
      }

      // Step 1: Upload audio to Supabase
      const formData = new FormData();
      formData.append('audio', blob, 'recording.webm');
      
      setProcessingText(steps[0]);
      const transcribeResponse = await fetch('/api/transcribe', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${session.access_token}` },
        body: formData
      });

      if (!transcribeResponse.ok) {
        setProcessingError('Failed to transcribe audio. Please try again.');
        return;
      }

      const transcribeData = await transcribeResponse.json();
      const transcript = transcribeData.transcript;

      setCurrentStep(1);
      setProcessingText(steps[1]);

      // Step 2: Generate summary
      const summaryResponse = await fetch('/api/generate-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript })
      });

      let summary = '';
      if (summaryResponse.ok) {
        const summaryData = await summaryResponse.json();
        summary = summaryData.summary;
      }

      setCurrentStep(2);
      setProcessingText(steps[2]);

      // Step 3: Create lecture in Supabase
      // Generate lecture number based on existing lectures
      const lectureNumber = lectures.length + 1;

      const lectureResponse = await fetch('/api/lectures', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          title: `Lecture ${lectureNumber}`,
          duration: elapsed,
          transcription: transcript,
          summary: summary,
          module_id: selectedModule,
          stored_locally: true,
          local_audio_size: blob.size
        })
      });

      if (!lectureResponse.ok) {
        setProcessingError('Failed to save lecture to Supabase. Please try again.');
        return;
      }

      const lectureResponseData = await lectureResponse.json();
      const lectureData = lectureResponseData.lecture;

      setCurrentStep(3);
      setProcessingText(steps[3]);

      // Record credit usage
      if (selectedModule) {
        await supabase.from('credits').insert({
          user_id: session.user.id,
          module_id: selectedModule,
          lecture_id: lectureData.id,
          used_for: 'recording'
        });
        // Reload modules to update global credit display
        loadModules();
      }

      // Discard audio blob - don't save to localStorage to save space
      // The lecture is now stored in Supabase with transcript and summary

      updateStreak();

      setRecordingState('idle');
      loadData();

      // Show notification with view button
      showAlert(
        'Your study assets are ready',
        lectureData.title.length > 30 ? lectureData.title.substring(0, 30) + '...' : lectureData.title,
        'success',
        `/lecture-detail?id=${lectureData.id}`
      );

    } catch (error) {
      console.error('Error saving recording:', error);
      setProcessingError('An unexpected error occurred. Please try again.');
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
      setUpgradeModalOpen(true);
      setUpgradeFeature('Upload lectures');
      return;
    }

    try {
      // Update streak immediately when file is uploaded
      updateStreak();

      // Initialize processing steps
      const steps = [
        'Processing audio for transcription...',
        'Transcribing audio with AI...',
        'Generating your study assets...',
        'Finalizing lecture...'
      ];
      setProcessingSteps(steps);
      setCurrentStep(0);
      setProcessingText(steps[0]);
      setRecordingState('processing');
      setProcessingError(null);

      const session = await getSession();
      if (!session) {
        setProcessingError('Please log in to upload recordings');
        return;
      }

      // Get audio duration from file
      const audioDuration = await new Promise<number>((resolve) => {
        const audio = new Audio();
        audio.onloadedmetadata = () => {
          resolve(audio.duration);
        };
        audio.onerror = () => {
          resolve(0);
        };
        audio.src = URL.createObjectURL(file);
      });

      // Step 1: Transcribe audio
      const formData = new FormData();
      formData.append('audio', file, file.name);
      
      setProcessingText(steps[0]);
      const transcribeResponse = await fetch('/api/transcribe', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${session.access_token}` },
        body: formData
      });

      if (!transcribeResponse.ok) {
        setProcessingError('Failed to transcribe audio. Please try again.');
        return;
      }

      const transcribeData = await transcribeResponse.json();
      const transcript = transcribeData.transcript;

      setCurrentStep(1);
      setProcessingText(steps[1]);

      // Step 2: Generate summary
      const summaryResponse = await fetch('/api/generate-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript })
      });

      let summary = '';
      if (summaryResponse.ok) {
        const summaryData = await summaryResponse.json();
        summary = summaryData.summary;
      }

      setCurrentStep(2);
      setProcessingText(steps[2]);

      // Step 3: Create lecture in Supabase
      const lectureResponse = await fetch('/api/lectures', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          title: file.name.replace(/\.[^/.]+$/, ''),
          duration: Math.floor(audioDuration),
          transcription: transcript,
          summary: summary,
          module_id: selectedModule,
          stored_locally: true,
          local_audio_size: file.size
        })
      });

      if (!lectureResponse.ok) {
        setProcessingError('Failed to save lecture to Supabase. Please try again.');
        return;
      }

      const lectureResponseData = await lectureResponse.json();
      const lectureData = lectureResponseData.lecture;

      setCurrentStep(3);
      setProcessingText(steps[3]);

      // Record credit usage
      if (selectedModule) {
        await supabase.from('credits').insert({
          user_id: session.user.id,
          module_id: selectedModule,
          lecture_id: lectureData.id,
          used_for: 'upload'
        });
        // Reload modules to update global credit display
        loadModules();
      }

      // Update streak regardless of Supabase upload success
      updateStreak();

      setRecordingState('idle');
      loadData();

      // Show notification with view button
      showAlert(
        'Your study assets are ready',
        lectureData.title.length > 30 ? lectureData.title.substring(0, 30) + '...' : lectureData.title,
        'success',
        `/lecture-detail?id=${lectureData.id}`
      );

    } catch (error) {
      console.error('Error uploading recording:', error);
      setProcessingError('An unexpected error occurred. Please try again.');
    }
  };

  const handleFileUpload = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'audio/*';
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
      if (file.type.startsWith('audio/')) {
        await uploadRecording(file);
      } else {
        setProcessingError('Please upload an audio file');
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
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg">
                <img alt="Universite logo" className="w-6 h-6 md:w-7 md:h-7 object-contain" src="/assets/images/icon-white-removebg.png" />
              </div>
              <h1 className="text-lg md:text-xl font-semibold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                Universite
              </h1>
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
                  <span className="font-semibold text-sm">{isDragging ? 'Drop audio file here' : 'Upload Audio'}</span>
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
                            Ask AI Tutor
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
                          <Link href={`/lecture-detail?id=${lecture.id}`} className="flex-1 px-3 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm font-medium text-center active:scale-95 transition-transform hover:bg-slate-200">
                            Review
                          </Link>
                          <Link href={`/assistant?lecture=${lecture.id}`} className="flex-1 px-3 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium text-center active:scale-95 transition-transform hover:bg-indigo-700">
                            Ask AI Tutor
                          </Link>
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
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-white border border-slate-200 rounded-xl p-3 text-center">
                <div className="text-2xl font-bold text-indigo-600 mb-1">{stats.lectures}</div>
                <div className="text-xs text-slate-600">Lectures</div>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-3 text-center">
                <div className="text-2xl font-bold text-indigo-600 mb-1">{(stats.minutes / 60).toFixed(1)}</div>
                <div className="text-xs text-slate-600">Hours Saved</div>
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
              <button
                onClick={() => {
                  setUpgradeFeature('Flashcards');
                  setUpgradeModalOpen(true);
                }}
                className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-xl active:scale-[0.99] transition-transform w-full relative"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center">
                    <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                    </svg>
                  </div>
                  <div>
                    <div className="font-medium text-slate-800 text-sm">Self-Test Mode</div>
                    <div className="text-xs text-slate-500">Review key concepts</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <a href="/#pricing" className="absolute -top-1 -right-1 bg-amber-400 text-amber-900 text-[10px] font-bold px-1.5 py-0.5 rounded-full hover:bg-amber-500 transition-colors">Upgrade</a>
                  <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </button>
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
              <h3 className="text-xl font-semibold text-slate-800 mb-2">Recording</h3>
              <div className="text-2xl font-mono text-slate-900 mb-4">{recordingTimer}</div>
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
                <h3 className="text-xl font-semibold text-slate-800 mb-4">Processing Recording</h3>
                
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
                
                <p className="text-slate-500 text-xs">Please wait while we process your lecture...</p>
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

      {/* Upgrade Modal */}
      <UpgradeModal
        isOpen={upgradeModalOpen}
        onClose={() => setUpgradeModalOpen(false)}
        feature={upgradeFeature}
        onUpgrade={() => showAlert('Coming Soon', 'Upgrade upgrade coming soon!', 'info')}
      />

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
