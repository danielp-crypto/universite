'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiGet, apiPut } from '@/lib/api/client';
import { getSession } from '@/lib/supabase/auth';
import { useRouter } from 'next/navigation';
import AudioPlayer from '../components/AudioPlayer';

function LecturesPageContent() {
  const router = useRouter();
  const [filter, setFilter] = useState<'all' | 'today' | 'week' | 'favorites'>('all');
  const [allLectures, setAllLectures] = useState<any[]>([]);
  const [counts, setCounts] = useState({ all: 0, today: 0, week: 0, favorites: 0 });
  const [loading, setLoading] = useState(true);

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

  const loadLectures = async () => {
    try {
      const session = await getSession();
      if (!session) {
        router.push('/login');
        return;
      }

      // Load lectures from API
      const apiLectures = await apiGet('/api/lectures').catch(() => []);

      const localRecordings = getRecordings();
      const localLectures = localRecordings.map((recording: any) => ({
        id: recording.id,
        title: recording.name,
        createdAt: recording.createdAt,
        duration: recording.duration,
        keyConcepts: ['local recording'],
        isLocal: true,
        audioUrl: recording.audioUrl,
        favorite: false
      }));

      const merged = [...localLectures, ...apiLectures];
      merged.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setAllLectures(merged);

      // Calculate Counts
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

      const countAll = merged.length;
      const countToday = merged.filter(lecture => new Date(lecture.createdAt) >= today).length;
      const countWeek = merged.filter(lecture => new Date(lecture.createdAt) >= weekAgo).length;
      const countFavorites = merged.filter(lecture => lecture.favorite === true).length;

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
  }, []);

  const toggleFavorite = async (lectureId: string) => {
    try {
      // Update local state
      setAllLectures(prev => prev.map(lecture => 
        lecture.id === lectureId ? { ...lecture, favorite: !lecture.favorite } : lecture
      ));

      // Update via API
      await apiPut(`/api/lectures/${lectureId}`, { favorite: !allLectures.find(l => l.id === lectureId)?.favorite });
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
      alert('Error deleting recording');
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
        alert('Link copied to clipboard');
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
      alert('Error downloading recording');
    }
  };

  // Filter the lectures based on selected tab
  const getFilteredLectures = () => {
    if (filter === 'all') return allLectures;

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

    return allLectures.filter(lecture => {
      const lectureDate = new Date(lecture.createdAt);
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
            <h1 className="text-lg md:text-xl font-semibold text-slate-800">My Lectures</h1>
            <Link href="/home" className="p-2 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 text-white active:scale-95 transition-transform">
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
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 mx-auto w-full max-w-[430px] md:max-w-[680px] lg:max-w-[800px] px-4 py-4">
          {filtered.length > 0 ? (
            <div className="space-y-3">
              {filtered.map((lecture) => {
                const dateStr = formatDate(new Date(lecture.createdAt));
                const isLocal = lecture.isLocal || false;

                if (isLocal) {
                  return (
                    <div key={lecture.id} className="bg-gradient-to-br from-white to-slate-50 border border-slate-200 rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow">
                      <div className="flex items-start justify-between mb-3">
                        <Link href={`/lecture-detail?id=${lecture.id}`} className="flex-1">
                          <h3 className="text-base font-semibold text-slate-800 mb-1">{lecture.title}</h3>
                          <div className="flex items-center gap-2 text-xs text-slate-500">
                            <span>{dateStr}</span>
                            <span>•</span>
                            <span>{lecture.duration || 'N/A'}</span>
                            <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs font-medium">Local</span>
                          </div>
                        </Link>
                      </div>
                      <AudioPlayer src={lecture.audioUrl} className="mb-3" />
                      <div className="flex gap-2">
                        <Link href={`/lecture-detail?id=${lecture.id}`} className="flex-1 px-3 py-2 bg-slate-100 text-slate-700 rounded-xl text-sm font-medium text-center active:scale-95 transition-transform hover:bg-slate-200">
                          View Details
                        </Link>
                        <Link href={`/assistant?lecture=${lecture.id}`} className="flex-1 px-3 py-2 bg-indigo-600 text-white rounded-xl text-sm font-medium text-center active:scale-95 transition-transform hover:bg-indigo-700">
                          Chat
                        </Link>
                        <button
                          onClick={() => downloadRecording(lecture)}
                          className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-sm transition-colors flex items-center justify-center"
                          title="Download"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                          </svg>
                        </button>
                        <button
                          onClick={() => shareRecording(lecture)}
                          className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm transition-colors flex items-center justify-center"
                          title="Share"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => deleteRecording(lecture.id)}
                          className="px-3 py-2 bg-red-100 hover:bg-red-200 text-red-700 rounded-xl text-sm transition-colors flex items-center justify-center"
                          title="Delete"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                      {lecture.keyConcepts && lecture.keyConcepts.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-3">
                          {lecture.keyConcepts.slice(0, 3).map((concept: string, idx: number) => (
                            <span key={idx} className="px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-full text-xs font-medium">{concept}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                } else {
                  return (
                    <div key={lecture.id} className="bg-white border border-slate-200 rounded-2xl p-4">
                      <div className="flex items-start justify-between mb-2">
                        <Link href={`/lecture-detail?id=${lecture.id}`} className="flex-1">
                          <h3 className="text-base font-semibold text-slate-800 mb-1">{lecture.title}</h3>
                          <div className="flex items-center gap-3 text-xs text-slate-500 mb-3">
                            <span>{dateStr}</span>
                            <span>•</span>
                            <span>{lecture.duration || 'N/A'}</span>
                          </div>
                        </Link>
                        <button
                          onClick={() => toggleFavorite(lecture.id)}
                          className={`p-1 ${lecture.favorite ? 'text-amber-400' : 'text-slate-400'} hover:text-amber-500 transition-colors`}
                        >
                          <svg className="w-5 h-5" fill={lecture.favorite ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                          </svg>
                        </button>
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
                }
              })}
            </div>
          ) : (
            <div id="empty-state" className="text-center py-12 bg-white border border-slate-200 rounded-2xl">
              <p className="text-slate-500 mb-4 text-sm">No lectures found</p>
              <Link href="/home" className="inline-block px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-medium">
                Record Your First Lecture
              </Link>
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

export default function LecturesPage() {
  return <LecturesPageContent />;
}
