'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiGet, apiPut } from '@/lib/api/client';
import { getSession } from '@/lib/supabase/auth';
import { supabase } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import AudioPlayer from '../components/AudioPlayer';
import Alert from '../components/Alert';

function LecturesPageContent() {
  const router = useRouter();
  const [filter, setFilter] = useState<'all' | 'today' | 'week' | 'favorites' | 'module'>('all');
  const [allLectures, setAllLectures] = useState<any[]>([]);
  const [counts, setCounts] = useState({ all: 0, today: 0, week: 0, favorites: 0 });
  const [loading, setLoading] = useState(true);

  // Modules state
  const [modules, setModules] = useState<any[]>([]);
  const [selectedModule, setSelectedModule] = useState<string | null>(null);

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

  const RECORDINGS_STORAGE_KEY = 'universite_recordings';

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
      }
    } catch (error) {
      console.error('Error loading modules:', error);
    }
  };

  const loadLectures = async () => {
    try {
      const session = await getSession();
      if (!session) {
        router.push('/login');
        return;
      }

      // Load lectures from API only
      const apiLectures = await apiGet('/api/lectures').catch(() => []);

      const merged = apiLectures;
      merged.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setAllLectures(merged);

      // Calculate Counts
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

      const countAll = merged.length;
      const countToday = merged.filter((lecture: any) => new Date(lecture.created_at || lecture.createdAt) >= today).length;
      const countWeek = merged.filter((lecture: any) => new Date(lecture.created_at || lecture.createdAt) >= weekAgo).length;
      const countFavorites = merged.filter((lecture: any) => lecture.favorite === true).length;

      setCounts({
        all: countAll,
        today: countToday,
        week: countWeek,
        favorites: countFavorites
      });
    } catch (error) {
      console.error('Error loading lectures:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLectures();
    loadModules();
  }, []);

  const toggleFavorite = async (lectureId: string) => {
    try {
      const currentLecture = allLectures.find(l => l.id === lectureId);
      if (!currentLecture) return;

      const newFavoriteValue = !currentLecture.favorite;

      // Update local state
      setAllLectures(prev => prev.map(lecture => 
        lecture.id === lectureId ? { ...lecture, favorite: newFavoriteValue } : lecture
      ));

      // Update via API
      await apiPut(`/api/lectures/${lectureId}`, { favorite: newFavoriteValue });
      loadLectures();
    } catch (error) {
      console.error('Error toggling favorite:', error);
    }
  };

  const deleteRecording = async (id: string) => {
    try {
      const recordings = getRecordings();
      const filtered = recordings.filter((r: any) => r.id !== id);
      localStorage.setItem(RECORDINGS_STORAGE_KEY, JSON.stringify(filtered));
      loadLectures();
    } catch (error) {
      console.error('Error deleting recording:', error);
      showAlert('Error', 'Error deleting recording', 'error');
    }
  };

  const deleteSupabaseLecture = async (id: string) => {
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

      loadLectures();
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

  // Filter the lectures based on selected tab
  const getFilteredLectures = () => {
    if (filter === 'all') return allLectures;
    if (filter === 'module' && selectedModule) {
      return allLectures.filter(lecture => lecture.module_id === selectedModule);
    }

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

    return allLectures.filter(lecture => {
      const lectureDate = new Date(lecture.created_at || lecture.createdAt);
      if (filter === 'today') {
        return lectureDate >= today;
      } else if (filter === 'week') {
        return lectureDate >= weekAgo;
      } else if (filter === 'favorites') {
        return lecture.favorite === true;
      }
      return true;
    });
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

  const filtered = getFilteredLectures();

  return (
    <div className="bg-slate-50 min-h-screen font-sans flex flex-col justify-between">
      <div id="app" className="flex-1 flex flex-col pb-20">
        {/* Header */}
        <div className="bg-white border-b border-slate-200 px-4 py-3 md:py-4 sticky top-0 z-10">
          <div className="mx-auto w-full max-w-[430px] md:max-w-[680px] lg:max-w-[800px] flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg">
                <img alt="Universite logo" className="w-6 h-6 md:w-7 md:h-7 object-contain" src="/assets/images/icon-white-removebg.png" />
              </div>
              <h1 className="text-lg md:text-xl font-semibold text-slate-800">My Lectures</h1>
            </div>
            <Link href="/dashboard" className="p-2 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 text-white active:scale-95 transition-transform">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
              </svg>
            </Link>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="bg-white border-b border-slate-200 px-4 sticky top-[57px] md:top-[61px] z-10">
          <div className="mx-auto w-full max-w-[430px] md:max-w-[680px] lg:max-w-[800px]">
            <div className="flex gap-4 overflow-x-auto pb-2 pt-2 scrollbar-none">
              <button
                onClick={() => setFilter('all')}
                className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                  filter === 'all' ? 'bg-indigo-100 text-indigo-700' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                All ({counts.all})
              </button>
              <button
                onClick={() => setFilter('today')}
                className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                  filter === 'today' ? 'bg-indigo-100 text-indigo-700' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                Today ({counts.today})
              </button>
              <button
                onClick={() => setFilter('week')}
                className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                  filter === 'week' ? 'bg-indigo-100 text-indigo-700' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                This Week ({counts.week})
              </button>
              <button
                onClick={() => setFilter('favorites')}
                className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                  filter === 'favorites' ? 'bg-indigo-100 text-indigo-700' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                Favorites ({counts.favorites})
              </button>
              {modules.length > 0 && (
                <div className="flex items-center gap-2">
                  <select
                    value={selectedModule || ''}
                    onChange={(e) => {
                      setSelectedModule(e.target.value || null);
                      setFilter(e.target.value ? 'module' : 'all');
                    }}
                    className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                      filter === 'module' ? 'bg-indigo-100 text-indigo-700' : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <option value="">Modules</option>
                    {modules.map((module) => (
                      <option key={module.id} value={module.id}>{module.name}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 mx-auto w-full max-w-[430px] md:max-w-[680px] lg:max-w-[800px] px-4 py-4">
          {filtered.length > 0 ? (
            <div className="space-y-3">
              {filtered.map((lecture) => {
                const dateStr = formatDate(new Date(lecture.created_at || lecture.createdAt));

                return (
                  <div key={lecture.id} className="bg-white border border-slate-200 rounded-2xl p-4">
                    <div className="flex items-start justify-between mb-2">
                      <Link href={`/lecture-detail?id=${lecture.id}`} className="flex-1 min-w-0">
                        <h3 className="text-base font-semibold text-slate-800 mb-1 truncate">{lecture.title}</h3>
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
                      </Link>
                      <div className="flex gap-1">
                        <button
                          onClick={() => toggleFavorite(lecture.id)}
                          className={`p-1 ${lecture.favorite ? 'text-amber-400' : 'text-slate-400'} hover:text-amber-500 transition-colors flex-shrink-0`}
                        >
                          <svg className="w-5 h-5" fill={lecture.favorite ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => deleteSupabaseLecture(lecture.id)}
                          className="p-1 text-slate-400 hover:text-red-600 transition-colors flex-shrink-0"
                          title="Delete"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                    {lecture.keyConcepts && lecture.keyConcepts.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mb-3">
                        {lecture.keyConcepts.slice(0, 3).map((concept: string, idx: number) => (
                          <span key={idx} className="px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-full text-xs font-medium">{concept}</span>
                        ))}
                      </div>
                    )}
                    <div className="flex gap-2">
                      <Link href={`/lecture-detail?id=${lecture.id}`} className="flex-1 px-3 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm font-medium text-center active:scale-95 transition-transform hover:bg-slate-200">
                        View Details
                      </Link>
                      <Link href={`/assistant?lecture=${lecture.id}`} className="flex-1 px-3 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium text-center active:scale-95 transition-transform hover:bg-indigo-700">
                        Chat
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div id="empty-state" className="text-center py-12 bg-white border border-slate-200 rounded-2xl">
              <p className="text-slate-500 mb-4 text-sm">No lectures found</p>
              <Link href="/dashboard" className="inline-block px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-medium">
                Record Your First Lecture
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

        <Alert
          isOpen={alertOpen}
          onClose={() => setAlertOpen(false)}
          title={alertTitle}
          message={alertMessage}
          type={alertType}
        />
      </div>
    </div>
  );
}

export default function LecturesPage() {
  return <LecturesPageContent />;
}
