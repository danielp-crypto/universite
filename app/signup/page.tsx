'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getSession, signInWithOAuth, signUpWithEmail } from '@/lib/supabase/auth';
import { supabase } from '@/lib/supabase/client';
import Alert from '../components/Alert';

function SignupPageContent() {
  const router = useRouter();
  const [googleLoading, setGoogleLoading] = useState(false);
  const [emailLoading, setEmailLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Multi-step form state
  const [step, setStep] = useState(1);
  const [profileData, setProfileData] = useState({
    full_name: '',
    university: '',
    major: '',
    year: '',
    study_time: '',
    learning_style: ''
  });
  const [moduleName, setModuleName] = useState('');

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

  useEffect(() => {
    // If already logged in with completed profile, redirect to dashboard
    const checkSession = async () => {
      try {
        const session = await getSession();
        if (session) {
          // Check if user has completed profile setup
          const { data: profile } = await supabase
            .from('profiles')
            .select('full_name, university, major, year, study_time, learning_style')
            .eq('user_id', session.user.id)
            .single();
          
          // Only redirect if profile has required fields
          if (profile && profile.full_name && profile.university && profile.major) {
            router.push('/dashboard');
          } else if (profile) {
            // User is logged in but hasn't completed profile, move to step 2
            setStep(2);
            if (profile.full_name) {
              setProfileData(prev => ({
                ...prev,
                full_name: profile.full_name || '',
                university: profile.university || '',
                major: profile.major || '',
                year: profile.year || '',
                study_time: profile.study_time || '',
                learning_style: profile.learning_style || ''
              }));
            }
          }
        }
      } catch (err) {
        console.error('Session check error:', err);
      }
    };
    checkSession();

    // Listen for auth state changes - move to step 2 if user just signed in
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session) {
        // Check if user has completed profile setup
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name, university, major, year, study_time, learning_style')
          .eq('user_id', session.user.id)
          .single();
        
        // Only redirect if profile has required fields
        if (profile && profile.full_name && profile.university && profile.major) {
          router.push('/dashboard');
        } else {
          // Move to step 2 to complete profile
          setStep(2);
        }
      }
    });

    return () => subscription.unsubscribe();
  }, [router]);

  const handleGoogleSignUp = async () => {
    setGoogleLoading(true);
    try {
      const redirectTo = `${window.location.origin}/signup`;
      const { error } = await signInWithOAuth('google', { redirectTo });
      if (error) {
        showAlert('Error', error.message, 'error');
        setGoogleLoading(false);
      }
    } catch (e: any) {
      console.error('Google signup error:', e);
      showAlert('Error', 'Google signup failed. Please try again.', 'error');
      setGoogleLoading(false);
    }
  };

  const handleEmailSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      showAlert('Error', 'Passwords do not match', 'error');
      return;
    }
    if (password.length < 6) {
      showAlert('Error', 'Password must be at least 6 characters', 'error');
      return;
    }
    setEmailLoading(true);
    try {
      const { error } = await signUpWithEmail(email, password);
      if (error) {
        showAlert('Error', error.message, 'error');
        setEmailLoading(false);
      } else {
        setStep(2);
        setEmailLoading(false);
      }
    } catch (e: any) {
      console.error('Email signup error:', e);
      showAlert('Error', 'Email signup failed. Please try again.', 'error');
      setEmailLoading(false);
    }
  };

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profileData.full_name || !profileData.university || !profileData.major) {
      showAlert('Error', 'Please fill in all required fields', 'error');
      return;
    }
    setStep(3);
  };

  const handleModuleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!moduleName) {
      showAlert('Error', 'Please enter a module name', 'error');
      return;
    }

    try {
      const session = await getSession();
      if (!session) {
        showAlert('Error', 'Not authenticated', 'error');
        return;
      }

      // Save profile
      const fullName = profileData.full_name;
      await supabase.from('profiles').upsert({
        user_id: session.user.id,
        full_name: fullName,
        first_name: fullName.split(' ')[0] || '',
        last_name: fullName.split(' ').slice(1).join(' ') || '',
        university: profileData.university,
        major: profileData.major,
        year: profileData.year,
        study_time: profileData.study_time,
        learning_style: profileData.learning_style,
        updated_at: new Date().toISOString()
      });

      // Create module
      const { data: module, error: moduleError } = await supabase.from('modules').insert({
        user_id: session.user.id,
        name: moduleName
      }).select().single();

      if (moduleError) {
        showAlert('Error', 'Failed to create module: ' + moduleError.message, 'error');
        return;
      }

      // Create 2 free credits for the module
      const { error: creditsError } = await supabase.from('credits').insert([
        {
          user_id: session.user.id,
          module_id: module.id,
          used_for: 'free_tier_credit',
          used_at: new Date().toISOString()
        },
        {
          user_id: session.user.id,
          module_id: module.id,
          used_for: 'free_tier_credit',
          used_at: new Date().toISOString()
        }
      ]);

      if (creditsError) {
        console.error('Failed to create credits:', creditsError);
      }

      router.push('/dashboard');
    } catch (error: any) {
      console.error('Error completing signup:', error);
      showAlert('Error', 'Failed to complete signup. Please try again.', 'error');
    }
  };

  return (
    <div className="bg-gradient-to-br from-indigo-550 via-white to-purple-50 min-h-screen font-sans flex flex-col justify-between">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link href="/" className="flex items-center">
              <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg mr-3">
                <img alt="Universite logo" className="w-6 h-6 md:w-7 md:h-7 object-contain" src="/assets/images/icon-white-removebg.png" />
              </div>
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
      <main className="flex-1 flex items-center justify-center px-4 py-8 sm:py-12">
        <div className="w-full max-w-md">
          {/* Signup Card */}
          <div className="bg-white rounded-2xl shadow-xl p-6 sm:p-8 md:p-10 border border-slate-200 animate-fade-in">
            <div className="text-center mb-6 sm:mb-8">
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-2">
                {step === 1 ? 'Get Started Free' : step === 2 ? 'Tell us about yourself' : 'Choose your module'}
              </h1>
              <p className="text-sm sm:text-base text-slate-600">
                {step === 1 ? 'Join thousands of students transforming their learning' : step === 2 ? 'Help us personalize your experience' : 'Start with 2 free credits'}
              </p>
            </div>

            {/* Step indicator */}
            <div className="flex items-center justify-center mb-6">
              <div className="flex items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${step >= 1 ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-600'}`}>1</div>
                <div className={`w-12 h-1 ${step >= 2 ? 'bg-indigo-600' : 'bg-slate-200'}`}></div>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${step >= 2 ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-600'}`}>2</div>
                <div className={`w-12 h-1 ${step >= 3 ? 'bg-indigo-600' : 'bg-slate-200'}`}></div>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${step >= 3 ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-600'}`}>3</div>
              </div>
            </div>

            {/* Step 1: Email Signup */}
            {step === 1 && (
              <>
                {/* Social Signup */}
                <div className="flex flex-col gap-4 mb-6">
                  <button
                    type="button"
                    onClick={handleGoogleSignUp}
                    disabled={googleLoading || emailLoading}
                    className="w-full px-4 py-3 bg-white border border-slate-300 rounded-xl font-semibold text-slate-800 hover:bg-slate-50 transition-all flex items-center justify-center relative active:scale-[0.99] disabled:opacity-50"
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
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Signing up...
                      </>
                    )}
                  </button>
                </div>

                {/* Divider */}
                <div className="relative mb-6">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-slate-300"></div>
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-4 bg-white text-slate-500">Or continue with email</span>
                  </div>
                </div>

            {/* Email Signup Form */}
            <form onSubmit={handleEmailSignUp} className="mb-6">
              <div className="space-y-4">
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={emailLoading || googleLoading}
                    className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all disabled:opacity-50 text-slate-900 placeholder:text-slate-400"
                    placeholder="you@example.com"
                  />
                </div>
                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-1">Password</label>
                  <div className="relative">
                    <input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      disabled={emailLoading || googleLoading}
                      className="w-full px-4 py-3 pr-12 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all disabled:opacity-50 text-slate-900 placeholder:text-slate-400"
                      placeholder="••••••••"
                      minLength={6}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      disabled={emailLoading || googleLoading}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 disabled:opacity-50"
                    >
                      {showPassword ? (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                        </svg>
                      ) : (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>
                <div>
                  <label htmlFor="confirmPassword" className="block text-sm font-medium text-slate-700 mb-1">Confirm Password</label>
                  <div className="relative">
                    <input
                      id="confirmPassword"
                      type={showConfirmPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      disabled={emailLoading || googleLoading}
                      className="w-full px-4 py-3 pr-12 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all disabled:opacity-50 text-slate-900 placeholder:text-slate-400"
                      placeholder="••••••••"
                      minLength={6}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      disabled={emailLoading || googleLoading}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 disabled:opacity-50"
                    >
                      {showConfirmPassword ? (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                        </svg>
                      ) : (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={emailLoading || googleLoading}
                  className="w-full px-4 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-semibold hover:shadow-lg transition-all flex items-center justify-center active:scale-[0.99] disabled:opacity-50"
                >
                  {emailLoading ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Signing up...
                    </>
                  ) : (
                    'Continue'
                  )}
                </button>
              </div>
            </form>
              </>
            )}

            {/* Step 2: Profile Info */}
            {step === 2 && (
              <form onSubmit={handleProfileSubmit} className="mb-6">
                <div className="space-y-4">
                  <div>
                    <label htmlFor="full_name" className="block text-sm font-medium text-slate-700 mb-1">Full Name *</label>
                    <input
                      id="full_name"
                      type="text"
                      value={profileData.full_name}
                      onChange={(e) => setProfileData({...profileData, full_name: e.target.value})}
                      required
                      className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all text-slate-900 placeholder:text-slate-400"
                      placeholder="John Doe"
                    />
                  </div>
                  <div>
                    <label htmlFor="university" className="block text-sm font-medium text-slate-700 mb-1">University *</label>
                    <input
                      id="university"
                      type="text"
                      value={profileData.university}
                      onChange={(e) => setProfileData({...profileData, university: e.target.value})}
                      required
                      className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all text-slate-900 placeholder:text-slate-400"
                      placeholder="Your University"
                    />
                  </div>
                  <div>
                    <label htmlFor="major" className="block text-sm font-medium text-slate-700 mb-1">Major *</label>
                    <input
                      id="major"
                      type="text"
                      value={profileData.major}
                      onChange={(e) => setProfileData({...profileData, major: e.target.value})}
                      required
                      className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all text-slate-900 placeholder:text-slate-400"
                      placeholder="Computer Science"
                    />
                  </div>
                  <div>
                    <label htmlFor="year" className="block text-sm font-medium text-slate-700 mb-1">Year</label>
                    <select
                      id="year"
                      value={profileData.year}
                      onChange={(e) => setProfileData({...profileData, year: e.target.value})}
                      className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all text-slate-900"
                    >
                      <option value="">Select your year</option>
                      <option value="1">1st Year</option>
                      <option value="2">2nd Year</option>
                      <option value="3">3rd Year</option>
                      <option value="4">4th Year</option>
                      <option value="5">5th Year+</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="study_time" className="block text-sm font-medium text-slate-700 mb-1">Preferred Study Time</label>
                    <select
                      id="study_time"
                      value={profileData.study_time}
                      onChange={(e) => setProfileData({...profileData, study_time: e.target.value})}
                      className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all text-slate-900"
                    >
                      <option value="">Select your preference</option>
                      <option value="morning">Morning (6AM - 12PM)</option>
                      <option value="afternoon">Afternoon (12PM - 6PM)</option>
                      <option value="evening">Evening (6PM - 12AM)</option>
                      <option value="night">Night (12AM - 6AM)</option>
                      <option value="flexible">Flexible</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="learning_style" className="block text-sm font-medium text-slate-700 mb-1">Learning Style</label>
                    <select
                      id="learning_style"
                      value={profileData.learning_style}
                      onChange={(e) => setProfileData({...profileData, learning_style: e.target.value})}
                      className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all text-slate-900"
                    >
                      <option value="">Select your style</option>
                      <option value="visual">Visual (diagrams, charts)</option>
                      <option value="auditory">Auditory (lectures, discussions)</option>
                      <option value="reading">Reading/Writing (notes, texts)</option>
                      <option value="kinesthetic">Hands-on (practice, projects)</option>
                      <option value="mixed">Mixed approach</option>
                    </select>
                  </div>
                  <button
                    type="submit"
                    className="w-full px-4 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-semibold hover:shadow-lg transition-all active:scale-[0.99]"
                  >
                    Continue
                  </button>
                </div>
              </form>
            )}

            {/* Step 3: Module Selection */}
            {step === 3 && (
              <form onSubmit={handleModuleSubmit} className="mb-6">
                <div className="space-y-4">
                  <div>
                    <label htmlFor="module_name" className="block text-sm font-medium text-slate-700 mb-1">Module Name *</label>
                    <input
                      id="module_name"
                      type="text"
                      value={moduleName}
                      onChange={(e) => setModuleName(e.target.value)}
                      required
                      className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all text-slate-900 placeholder:text-slate-400"
                      placeholder="e.g., Calculus 101, Physics, etc."
                    />
                  </div>
                  <div className="bg-indigo-50 rounded-xl p-4 border border-indigo-200">
                    <div className="flex items-center mb-2">
                      <svg className="w-5 h-5 text-indigo-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span className="text-sm font-semibold text-indigo-900">Free Trial Includes:</span>
                    </div>
                    <ul className="text-sm text-indigo-800 space-y-1 ml-7">
                      <li>• 1 module with 2 credits</li>
                      <li>• Each credit = 1 lecture recording/upload</li>
                      <li>• Transcript + AI notes included</li>
                    </ul>
                  </div>
                  <button
                    type="submit"
                    className="w-full px-4 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-semibold hover:shadow-lg transition-all active:scale-[0.99]"
                  >
                    Complete Setup
                  </button>
                </div>
              </form>
            )}

            {/* Sign In Link */}
            <div className="mt-6 text-center">
              <p className="text-slate-600">
                Already have an account?
                <Link href="/login" className="text-indigo-600 hover:text-indigo-700 font-semibold ml-1">Sign in</Link>
              </p>
            </div>
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

export default function SignupPage() {
  return <SignupPageContent />;
}
