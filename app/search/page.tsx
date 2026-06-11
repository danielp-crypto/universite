'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiGet } from '@/lib/api/client';
import { getSession } from '@/lib/supabase/auth';
import { useRouter } from 'next/navigation';

interface Lecture {
  id: string;
  title: string;
  createdAt: string;
  created_at?: string;
  duration?: string;
  transcript?: string;
  keyConcepts?: string[];
}

function SearchContent() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Lecture[]>([]);
  const [allLectures, setAllLectures] = useState<Lecture[]>([]);
  const [showEmpty, setShowEmpty] = useState(true);
  const [showNoResults, setShowNoResults] = useState(false);
  const [loading, setLoading] = useState(true);

  const RECORDINGS_STORAGE_KEY = 'universite_recordings';

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
        created_at: recording.createdAt,
        duration: recording.duration,
        keyConcepts: recording.keyConcepts || ['local recording'],
        transcript: recording.transcription || ''
      }));

      const merged = [...localLectures, ...apiLectures];
      merged.sort((a, b) => new Date(b.created_at || b.createdAt).getTime() - new Date(a.created_at || a.createdAt).getTime());
      setAllLectures(merged);
      setLoading(false);
    } catch (error) {
      console.error('Error loading lectures:', error);
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLectures();
  }, []);

  function highlightText(text: string, q: string) {
    if (!q) return text;
    const regex = new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    return text.replace(regex, '<mark class="bg-yellow-200">$1</mark>');
  }

  function performSearch(value: string) {
    setQuery(value);
    if (!value.trim()) {
      setResults([]);
      setShowEmpty(true);
      setShowNoResults(false);
      return;
    }

    const searchLower = value.toLowerCase();
    const filtered = allLectures.filter(lecture => {
      const titleMatch = lecture.title.toLowerCase().includes(searchLower);
      const conceptsMatch = lecture.keyConcepts?.some(c => c.toLowerCase().includes(searchLower));
      const transcriptMatch = lecture.transcript?.toLowerCase().includes(searchLower);
      return titleMatch || conceptsMatch || transcriptMatch;
    });

    if (filtered.length === 0) {
      setResults([]);
      setShowEmpty(false);
      setShowNoResults(true);
    } else {
      setResults(filtered);
      setShowEmpty(false);
      setShowNoResults(false);
    }
  }

  return (
    <div className="flex flex-col min-h-screen pb-20 bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-4 py-3 md:py-4 sticky top-0 z-10">
        <div className="mx-auto w-full max-w-[430px] md:max-w-[680px] lg:max-w-[800px]">
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="p-1 text-slate-600">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <div className="flex-1 relative">
              <input
                type="text"
                id="search-input"
                value={query}
                onChange={e => performSearch(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && performSearch(query)}
                placeholder="Search lectures, concepts, transcripts..."
                className="w-full px-4 py-2 bg-slate-50 border-2 border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 text-sm"
              />
              <svg className="w-5 h-5 absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 mx-auto w-full max-w-[430px] md:max-w-[680px] lg:max-w-[800px] px-4 py-4">
        {loading && (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-4 border-indigo-600 border-t-transparent mx-auto"></div>
            <p className="text-slate-500 mt-4 text-sm">Loading lectures...</p>
          </div>
        )}
        {!loading && showEmpty && (
          <div className="text-center py-12">
            <svg className="w-16 h-16 mx-auto text-slate-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <p className="text-slate-600 mb-2">Search across all your lectures</p>
            <p className="text-sm text-slate-500">Enter keywords to find lectures, concepts, or transcript content</p>
          </div>
        )}
        {!loading && showNoResults && (
          <div className="text-center py-12">
            <p className="text-slate-600 mb-2">No results found</p>
            <p className="text-sm text-slate-500">Try different keywords or check your spelling</p>
          </div>
        )}
        <div className="space-y-3">
          {results.map(lecture => {
            const matchingConcepts = lecture.keyConcepts?.filter(c => c.toLowerCase().includes(query.toLowerCase())) || [];
            return (
              <Link key={lecture.id} href={`/lecture-detail?id=${lecture.id}`} className="block bg-white border border-slate-200 rounded-2xl p-4 active:scale-[0.98] transition-transform">
                <h3 className="text-base font-semibold text-slate-800 mb-1" dangerouslySetInnerHTML={{ __html: highlightText(lecture.title, query) }} />
                <div className="flex items-center gap-3 text-xs text-slate-500 mb-2">
                  <span>{new Date(lecture.createdAt || lecture.created_at || new Date()).toLocaleDateString()}</span>
                  <span>•</span>
                  <span>{lecture.duration || 'N/A'}</span>
                </div>
                {matchingConcepts.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {matchingConcepts.map(concept => (
                      <span key={concept} className="px-2 py-1 bg-indigo-50 text-indigo-700 rounded-full text-xs font-medium" dangerouslySetInnerHTML={{ __html: highlightText(concept, query) }} />
                    ))}
                  </div>
                )}
                {lecture.transcript && (
                  <p className="text-sm text-slate-600 line-clamp-2" dangerouslySetInnerHTML={{ __html: highlightText(lecture.transcript.substring(0, 150), query) + '...' }} />
                )}
              </Link>
            );
          })}
        </div>
      </div>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200">
        <div className="mx-auto w-full max-w-[430px] md:max-w-[680px] lg:max-w-[800px]">
          <div className="flex items-center justify-around py-2">
            <Link href="/dashboard" className="flex flex-col items-center py-2 px-4 text-slate-400">
              <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
              <span className="text-xs font-medium">Home</span>
            </Link>
            <Link href="/lectures" className="flex flex-col items-center py-2 px-4 text-slate-400">
              <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
              <span className="text-xs font-medium">Lectures</span>
            </Link>
            <Link href="/search" className="flex flex-col items-center py-2 px-4 text-indigo-600">
              <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              <span className="text-xs font-medium">Search</span>
            </Link>
            <Link href="/settings" className="flex flex-col items-center py-2 px-4 text-slate-400">
              <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
              <span className="text-xs font-medium">Settings</span>
            </Link>
          </div>
        </div>
      </nav>
    </div>
  );
}

export default function SearchPage() {
  return <SearchContent />;
}
