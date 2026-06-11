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
  duration?: string;
  transcript?: string;
  keyConcepts?: string[];
}

function NotesContent() {
  const router = useRouter();
  const [lectures, setLectures] = useState<Lecture[]>([]);
  const [empty, setEmpty] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadLectures = async () => {
      try {
        const session = await getSession();
        if (!session) {
          router.push('/login');
          return;
        }

        const data: Lecture[] = await apiGet('/api/lectures').catch(() => []);
        if (data.length === 0) {
          setEmpty(true);
        } else {
          setLectures(data);
        }
      } catch (error) {
        console.error('Error loading lectures:', error);
        setEmpty(true);
      } finally {
        setLoading(false);
      }
    };

    loadLectures();
  }, []);

  async function exportNote(lectureId: string) {
    try {
      const lecture = await apiGet(`/api/lectures/${lectureId}`);
      if (!lecture) return;
      const content = `Lecture Notes: ${lecture.title}\n\nDate: ${new Date(lecture.createdAt).toLocaleDateString()}\nDuration: ${lecture.duration || 'N/A'}\n\nKey Concepts: ${lecture.keyConcepts?.join(', ') || 'N/A'}\n\nTranscript:\n${lecture.transcript || 'No transcript available yet.'}`;
      const blob = new Blob([content], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${lecture.title.replace(/[^a-z0-9]/gi, '_')}_notes.txt`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error exporting note:', error);
    }
  }

  async function exportAllNotes() {
    if (lectures.length === 0) {
      alert('No notes to export');
      return;
    }
    const content = lectures.map((l: Lecture) =>
      `=== ${l.title} ===\nDate: ${new Date(l.createdAt).toLocaleDateString()}\nDuration: ${l.duration || 'N/A'}\n\nKey Concepts: ${l.keyConcepts?.join(', ') || 'N/A'}\n\nTranscript:\n${l.transcript || 'No transcript available yet.'}\n\n`
    ).join('\n\n');
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `all_lecture_notes_${new Date().toISOString().split('T')[0]}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex flex-col min-h-screen pb-20 bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-4 py-3 md:py-4 sticky top-0 z-10">
        <div className="mx-auto w-full max-w-[430px] md:max-w-[680px] lg:max-w-[800px] flex items-center gap-3">
          <Link href="/dashboard" className="p-1 text-slate-600">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg">
            <img alt="Universite logo" className="w-6 h-6 md:w-7 md:h-7 object-contain" src="/assets/images/icon-white-removebg.png" />
          </div>
          <h1 className="text-lg md:text-xl font-semibold text-slate-800 flex-1">Notes</h1>
          <button onClick={exportAllNotes} className="p-2 text-slate-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 mx-auto w-full max-w-[430px] md:max-w-[680px] lg:max-w-[800px] px-4 py-4">
        {empty ? (
          <div className="text-center py-12">
            <p className="text-slate-600 mb-4">No notes available yet.</p>
            <p className="text-sm text-slate-500 mb-6">Record or upload a lecture to generate notes.</p>
            <Link href="/assistant" className="inline-block px-6 py-3 bg-indigo-600 text-white rounded-xl">Record Lecture</Link>
          </div>
        ) : (
          <div className="space-y-3">
            {lectures.map(lecture => (
              <div key={lecture.id} className="bg-white border border-slate-200 rounded-2xl p-4">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <h3 className="text-base font-semibold text-slate-800 mb-1">{lecture.title}</h3>
                    <div className="flex items-center gap-3 text-xs text-slate-500 mb-3">
                      <span>{new Date(lecture.createdAt).toLocaleDateString()}</span>
                      <span>•</span>
                      <span>{lecture.duration || 'N/A'}</span>
                    </div>
                  </div>
                </div>
                {lecture.transcript && (
                  <div className="text-sm text-slate-600 mb-3 line-clamp-3">{lecture.transcript.substring(0, 200)}...</div>
                )}
                {lecture.keyConcepts && lecture.keyConcepts.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {lecture.keyConcepts.slice(0, 5).map(concept => (
                      <span key={concept} className="px-2 py-1 bg-indigo-50 text-indigo-700 rounded-full text-xs font-medium">{concept}</span>
                    ))}
                  </div>
                )}
                <div className="flex gap-2">
                  <Link href={`/lecture-detail?id=${lecture.id}`} className="flex-1 px-3 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm font-medium text-center active:scale-95 transition-transform">
                    View Details
                  </Link>
                  <button onClick={() => exportNote(lecture.id)} className="px-3 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium active:scale-95 transition-transform">
                    Export
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
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
            <Link href="/search" className="flex flex-col items-center py-2 px-4 text-slate-400">
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

export default function NotesPage() {
  return <NotesContent />;
}
