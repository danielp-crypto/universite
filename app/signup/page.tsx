'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import ClientLoader from '../components/ClientLoader';

function SignupPageContent() {
  const [googleLoading, setGoogleLoading] = useState(false);
  const [appleLoading, setAppleLoading] = useState(false);

  useEffect(() => {
    // If already logged in, redirect straight to the app
    const checkSession = async () => {
      try {
        const session = await (window as any).UniSupabase.getSession();
        if (session) {
          window.location.href = "/home";
        }
      } catch (err) {
        console.error('Session check error:', err);
      }
    };
    checkSession();
  }, []);

  const handleGoogleSignUp = async () => {
    setGoogleLoading(true);
    try {
      const redirectTo = `${window.location.origin}/home`;
      const { error } = await (window as any).UniSupabase.signInWithOAuth('google', { redirectTo });
      if (error) {
        alert(error.message);
        setGoogleLoading(false);
      }
    } catch (e: any) {
      console.error('Google signup error:', e);
      alert("Google signup failed. Please try again.");
      setGoogleLoading(false);
    }
  };

  const handleAppleSignUp = async () => {
    setAppleLoading(true);
    try {
      const redirectTo = `${window.location.origin}/home`;
      const { error } = await (window as any).UniSupabase.signInWithOAuth('apple', { redirectTo });
      if (error) {
        alert(error.message);
        setAppleLoading(false);
      }
    } catch (e: any) {
      console.error('Apple signup error:', e);
      alert("Apple signup failed. Please try again.");
      setAppleLoading(false);
    }
  };

  return (
    <div className="bg-gradient-to-br from-indigo-550 via-white to-purple-50 min-h-screen font-sans flex flex-col justify-between">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link href="/" className="flex items-center">
              <img src="/assets/images/new-logo-white-removebg-preview.png-1-192x192.png" alt="Universite logo" className="h-10 w-10 mr-3" />
              <span className="text-xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">Universite</span>
            </Link>
            <div className="flex items-center space-x-4">
              <Link href="/" className="text-slate-600 hover:text-indigo-600 font-medium transition-colors">Home</Link>
              <Link href="/login" className="text-slate-600 hover:text-indigo-600 font-medium transition-colors">Login</Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          {/* Signup Card */}
          <div className="bg-white rounded-2xl shadow-xl p-8 md:p-10 border border-slate-200 animate-fade-in">
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold text-slate-900 mb-2">Get Started Free</h1>
              <p className="text-slate-600">Join thousands of students transforming their learning</p>
            </div>

            {/* Social Signup */}
            <div className="flex flex-col gap-4 mb-6">
              <button
                type="button"
                onClick={handleGoogleSignUp}
                disabled={googleLoading || appleLoading}
                className="w-full px-4 py-3 bg-white border border-slate-300 rounded-xl font-semibold text-slate-800 hover:bg-slate-50 transition-all flex items-center justify-center relative active:scale-[0.99]"
              >
                {!googleLoading ? (
                  <>
                    <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                    Sign up with Google
                  </>
                ) : (
                  <>
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-slate-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                      <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Signing up...
                  </>
                )}
              </button>
              
              <button
                type="button"
                onClick={handleAppleSignUp}
                disabled={googleLoading || appleLoading}
                className="w-full px-4 py-3 bg-slate-900 text-white rounded-xl font-semibold hover:bg-slate-800 transition-all flex items-center justify-center relative active:scale-[0.99]"
              >
                {!appleLoading ? (
                  <>
                    <svg className="w-5 h-5 mr-3" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
                    </svg>
                    Sign up with Apple
                  </>
                ) : (
                  <>
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                      <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Signing up...
                  </>
                )}
              </button>
            </div>

            {/* Sign In Link */}
            <div className="mt-6 text-center">
              <p className="text-slate-600">
                Already have an account?
                <Link href="/login" className="text-indigo-600 hover:text-indigo-700 font-semibold ml-1">Sign in</Link>
              </p>
            </div>
          </div>

          {/* Benefits Section */}
          <div className="mt-8 bg-white rounded-xl p-6 border border-slate-200">
            <h3 className="font-semibold text-slate-900 mb-4 text-center">What you get on the Free plan:</h3>
            <ul className="space-y-3 text-slate-705">
              <li className="flex items-start">
                <svg className="w-5 h-5 text-indigo-600 mr-3 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                </svg>
                <span><strong>3 lecture uploads per month</strong> with up to <strong>15 minutes</strong> of transcription per lecture</span>
              </li>
              <li className="flex items-start">
                <svg className="w-5 h-5 text-indigo-600 mr-3 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                </svg>
                <span><strong>Basic AI summaries</strong> of your recorded lectures</span>
              </li>
              <li className="flex items-start">
                <svg className="w-5 h-5 text-indigo-600 mr-3 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                </svg>
                <span>Access to the Universite dashboard and assistant</span>
              </li>
              <li className="flex items-start">
                <svg className="w-5 h-5 text-indigo-600 mr-3 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                </svg>
                <span><strong>Free forever plan</strong> – no credit card required.</span>
              </li>
            </ul>
          </div>

          {/* Privacy Note */}
          <div className="mt-6 text-center text-sm text-slate-500">
            <p>
              By signing up, you agree to our{' '}
              <Link href="/terms" className="text-indigo-600 hover:underline">Terms of Service</Link>
              {' '}and{' '}
              <Link href="/privacy" className="text-indigo-600 hover:underline">Privacy Policy</Link>
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-slate-900 text-slate-300 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="mb-4 md:mb-0">
              <p className="text-sm">&copy; 2026 Universite. All rights reserved.</p>
            </div>
            <div className="flex space-x-6 text-sm">
              <Link href="/privacy" className="hover:text-white transition-colors">Privacy Policy</Link>
              <Link href="/terms" className="hover:text-white transition-colors">Terms of Service</Link>
              <a href="mailto:support@universite.co.za" className="hover:text-white transition-colors">Support</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default function SignupPage() {
  return (
    <ClientLoader
      scripts={['/js/config.js', '/js/supabase-client.js']}
      requiredGlobals={['UniSupabase']}
    >
      <SignupPageContent />
    </ClientLoader>
  );
}
