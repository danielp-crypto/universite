'use client';

import React, { useEffect, useState } from 'react';

// Helper to load a script dynamically
const loadScript = (src: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    // Check if script is already loaded
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) {
      resolve();
      return;
    }

    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = (err) => reject(new Error(`Failed to load script: ${src}. ${err}`));
    document.head.appendChild(script);
  });
};

interface ClientLoaderProps {
  children: React.ReactNode;
  scripts?: string[];
  requiredGlobals?: string[];
}

export default function ClientLoader({
  children,
  scripts = [],
  requiredGlobals = [],
}: ClientLoaderProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const loadAll = async () => {
      try {
        // 1. Always load Supabase UMD first
        await loadScript('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2');
        
        // 2. Load other specified scripts in order
        for (const src of scripts) {
          if (!active) return;
          await loadScript(src);
        }

        // 3. Verify globals are present on window
        const checkGlobals = () => {
          if (!active) return;
          const missing = requiredGlobals.filter((g) => {
            const parts = g.split('.');
            let obj: any = window;
            for (const p of parts) {
              if (!obj || !(p in obj)) return true;
              obj = obj[p];
            }
            return false;
          });

          if (missing.length === 0) {
            setLoading(false);
          } else {
            console.log('Waiting for globals:', missing);
            setTimeout(checkGlobals, 50); // Poll every 50ms until ready
          }
        };

        checkGlobals();
      } catch (err: any) {
        console.error('ClientLoader error:', err);
        if (active) {
          setError(err.message || 'Error loading application dependencies');
        }
      }
    };

    loadAll();

    return () => {
      active = false;
    };
  }, [scripts, requiredGlobals]);

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-550 via-slate-900 to-purple-900 flex items-center justify-center p-4">
        <div className="bg-white/10 backdrop-blur-xl border border-white/20 p-8 rounded-3xl max-w-md w-full shadow-2xl text-center text-white">
          <div className="w-16 h-16 bg-red-500/20 border border-red-500 text-red-400 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold mb-2">Failed to Load Application</h2>
          <p className="text-slate-350 text-sm mb-6">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="w-full py-3 bg-gradient-to-r from-indigo-500 to-purple-600 hover:shadow-lg hover:shadow-indigo-500/25 text-white font-semibold rounded-xl transition-all"
          >
            Reload Page
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <div className="relative w-20 h-20 mx-auto mb-6">
            <div className="absolute inset-0 rounded-full border-4 border-indigo-100"></div>
            <div className="absolute inset-0 rounded-full border-4 border-indigo-600 border-t-transparent animate-spin"></div>
          </div>
          <h2 className="text-lg font-semibold text-slate-800 animate-pulse">Initializing Universite...</h2>
          <p className="text-sm text-slate-500 mt-2">Loading secure connection</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
