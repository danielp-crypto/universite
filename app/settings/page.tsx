'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { signOut, getSession } from '@/lib/supabase/auth';
import { supabase } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

export default function SettingsPage() {
  const router = useRouter();
  const [showNotifications, setShowNotifications] = useState(false);
  const [showAppearance, setShowAppearance] = useState(false);
  const [showDailyGoal, setShowDailyGoal] = useState(false);
  const [showAudioQuality, setShowAudioQuality] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [theme, setTheme] = useState('light');
  const [dailyGoal, setDailyGoal] = useState(3);
  const [audioQuality, setAudioQuality] = useState('high');
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    loadUserData();
  }, []);

  const loadUserData = async () => {
    try {
      const session = await getSession();
      if (session?.user) {
        setUser(session.user);
        setProfile(session.user.user_metadata || {});
      }
    } catch (error) {
      console.error('Error loading user data:', error);
    }
  };

  const getInitials = () => {
    const name = profile?.full_name || user?.user_metadata?.full_name || user?.email || 'U';
    return name
      .split(' ')
      .map((n: string) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getDisplayName = () => {
    return profile?.full_name || user?.user_metadata?.full_name || 'User';
  };

  const getEmail = () => {
    return user?.email || 'user@example.com';
  };

  const handleSignOut = async () => {
    await signOut();
    router.push('/login');
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const session = await getSession();
      if (!session) {
        router.push('/login');
        return;
      }

      const formData = new FormData(formRef.current!);
      const profileData = {
        full_name: formData.get('full_name'),
        university: formData.get('university'),
        major: formData.get('major'),
        year: formData.get('year'),
        study_time: formData.get('study_time'),
        learning_style: formData.get('learning_style'),
      };

      console.log('Saving profile data:', profileData);

      // Update user metadata (same approach as settings.html)
      const { data, error } = await supabase.auth.updateUser({
        data: profileData
      });

      if (error) {
        console.error('Supabase error:', error);
        throw error;
      }

      console.log('Profile saved successfully:', data);

      // Update local state with the new metadata
      if (data.user) {
        setUser(data.user);
        setProfile(data.user.user_metadata || {});
      }

      setShowProfileModal(false);
    } catch (error: any) {
      console.error('Error saving profile:', error);
      alert(`Error saving profile: ${error.message || 'Unknown error'}`);
    }
  };

  return (
    <div className="bg-slate-50 min-h-screen flex flex-col pb-20">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-4 py-3 md:py-4 sticky top-0 z-50">
        <div className="mx-auto w-full max-w-[430px] md:max-w-[680px] lg:max-w-[800px] flex items-center gap-3">
          <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg">
            <img alt="Universite logo" className="w-6 h-6 md:w-7 md:h-7 object-contain" src="/assets/images/icon-white-removebg.png" />
          </div>
          <h1 className="text-lg md:text-xl font-semibold text-slate-800">Settings</h1>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 mx-auto w-full max-w-[430px] md:max-w-[680px] lg:max-w-[800px] px-4 py-4">
        {/* Profile Section */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 mb-4">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-xl font-bold">
              {getInitials()}
            </div>
            <div className="flex-1">
              <div className="text-lg font-semibold text-slate-800">{getDisplayName()}</div>
              <div className="text-sm text-slate-500">{getEmail()}</div>
            </div>
          </div>
          <button 
            onClick={() => setShowProfileModal(true)}
            className="w-full px-4 py-2 bg-slate-100 text-slate-700 rounded-xl font-medium active:scale-95 transition-transform mb-2"
          >
            Edit Profile
          </button>
          <button
            onClick={handleSignOut}
            className="w-full px-4 py-2 border border-red-200 text-red-600 rounded-xl font-medium active:scale-95 transition-transform hover:bg-red-50"
          >
            Sign Out
          </button>
        </div>

        {/* General Settings */}
        <div className="mb-4">
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-2 px-2">General</h2>
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden divide-y divide-slate-200">
            <button
              onClick={() => setShowNotifications(true)}
              className="w-full flex items-center justify-between p-4 active:bg-slate-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center">
                  🔔
                </div>
                <div className="text-left">
                  <div className="font-medium text-slate-800">Notifications</div>
                  <div className="text-xs text-slate-500">Manage notification preferences</div>
                </div>
              </div>
              <span className="text-slate-400">→</span>
            </button>

            <button
              onClick={() => setShowAppearance(true)}
              className="w-full flex items-center justify-between p-4 active:bg-slate-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
                  🎨
                </div>
                <div className="text-left">
                  <div className="font-medium text-slate-800">Appearance</div>
                  <div className="text-xs text-slate-500">Theme and display options</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-500 capitalize">{theme}</span>
                <span className="text-slate-400">→</span>
              </div>
            </button>
          </div>
        </div>

        {/* Study Settings */}
        <div className="mb-4">
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-2 px-2">Study</h2>
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden divide-y divide-slate-200">
            <button
              onClick={() => setShowDailyGoal(true)}
              className="w-full flex items-center justify-between p-4 active:bg-slate-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center">
                  ⏰
                </div>
                <div className="text-left">
                  <div className="font-medium text-slate-800">Daily Study Goal</div>
                  <div className="text-xs text-slate-500">{dailyGoal} hours per day</div>
                </div>
              </div>
              <span className="text-slate-400">→</span>
            </button>

            <button
              onClick={() => setShowAudioQuality(true)}
              className="w-full flex items-center justify-between p-4 active:bg-slate-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
                  🎵
                </div>
                <div className="text-left">
                  <div className="font-medium text-slate-800">Audio Quality</div>
                  <div className="text-xs text-slate-500 capitalize">{audioQuality} (better transcripts)</div>
                </div>
              </div>
              <span className="text-slate-400">→</span>
            </button>

            <div className="flex items-center justify-between p-4">
              <div className="text-left flex-1">
                <div className="font-medium text-slate-800">Auto-save Recordings</div>
                <div className="text-xs text-slate-500">Automatically save lecture recordings</div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" defaultChecked className="sr-only peer" />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
              </label>
            </div>
          </div>
        </div>

        {/* About */}
        <div className="mb-4">
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-2 px-2">About</h2>
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden divide-y divide-slate-200">
            <button
              onClick={() => setShowHelp(true)}
              className="w-full flex items-center justify-between p-4 active:bg-slate-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center">
                  ❓
                </div>
                <div className="text-left">
                  <div className="font-medium text-slate-800">Help & Support</div>
                  <div className="text-xs text-slate-500">Get help using the app</div>
                </div>
              </div>
              <span className="text-slate-400">→</span>
            </button>

            <Link href="/privacy" className="w-full flex items-center justify-between p-4 active:bg-slate-50 transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center">
                  📄
                </div>
                <div className="text-left">
                  <div className="font-medium text-slate-800">Privacy Policy</div>
                </div>
              </div>
              <span className="text-slate-400">→</span>
            </Link>

            <Link href="/terms" className="w-full flex items-center justify-between p-4 active:bg-slate-50 transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center">
                  📋
                </div>
                <div className="text-left">
                  <div className="font-medium text-slate-800">Terms of Service</div>
                </div>
              </div>
              <span className="text-slate-400">→</span>
            </Link>

            <div className="w-full flex items-center justify-between p-4 active:bg-slate-50 transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center">
                  ℹ️
                </div>
                <div className="text-left">
                  <div className="font-medium text-slate-800">About</div>
                  <div className="text-xs text-slate-500">Version 1.0.0</div>
                </div>
              </div>
              <span className="text-slate-400">→</span>
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      {showNotifications && (
        <div className="fixed inset-0 z-50">
          <div className="modal-overlay flex items-end sm:items-center justify-center min-h-screen p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-md mx-auto p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-slate-800">Notifications</h2>
                <button onClick={() => setShowNotifications(false)} className="p-2 hover:bg-slate-100 rounded-lg">
                  ✕
                </button>
              </div>

              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-slate-800">Email Notifications</div>
                    <div className="text-sm text-slate-500">Receive updates via email</div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" defaultChecked className="sr-only peer" />
                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                  </label>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-slate-800">Push Notifications</div>
                    <div className="text-sm text-slate-500">Get notified in your browser</div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer" />
                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                  </label>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-slate-800">Study Reminders</div>
                    <div className="text-sm text-slate-500">Daily study goal reminders</div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" defaultChecked className="sr-only peer" />
                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                  </label>
                </div>
              </div>

              <div className="mt-8 flex gap-3">
                <button onClick={() => setShowNotifications(false)} className="flex-1 px-4 py-3 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700">
                  Save Settings
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showAppearance && (
        <div className="fixed inset-0 z-50">
          <div className="modal-overlay flex items-end sm:items-center justify-center min-h-screen p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-md mx-auto p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-slate-800">Appearance</h2>
                <button onClick={() => setShowAppearance(false)} className="p-2 hover:bg-slate-100 rounded-lg">
                  ✕
                </button>
              </div>

              <div className="space-y-4">
                {['light', 'dark', 'system'].map((t) => (
                  <div
                    key={t}
                    onClick={() => setTheme(t)}
                    className={`p-4 border rounded-xl cursor-pointer transition-colors ${
                      theme === t ? 'border-indigo-300 bg-indigo-50' : 'border-slate-200 hover:border-indigo-300'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-4 h-4 rounded-full flex-shrink-0 ${
                        t === 'light' ? 'bg-yellow-400' : t === 'dark' ? 'bg-slate-800' : 'bg-gradient-to-r from-yellow-400 to-slate-800'
                      }`}></div>
                      <div>
                        <div className="font-medium text-slate-800 capitalize">{t}</div>
                        <div className="text-sm text-slate-500">
                          {t === 'light' ? 'Clean and bright interface' : t === 'dark' ? 'Easy on the eyes in low light' : 'Follow your device settings'}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-8 flex gap-3">
                <button onClick={() => setShowAppearance(false)} className="flex-1 px-4 py-3 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700">
                  Apply Theme
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showDailyGoal && (
        <div className="fixed inset-0 z-50">
          <div className="modal-overlay flex items-end sm:items-center justify-center min-h-screen p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-md mx-auto p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-slate-800">Daily Study Goal</h2>
                <button onClick={() => setShowDailyGoal(false)} className="p-2 hover:bg-slate-100 rounded-lg">
                  ✕
                </button>
              </div>

              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Set Daily Goal</label>
                  <div className="grid grid-cols-4 gap-2">
                    {[1, 2, 3, 4].map((hours) => (
                      <button
                        key={hours}
                        onClick={() => setDailyGoal(hours)}
                        className={`px-3 py-2 border rounded-lg text-sm transition-colors ${
                          dailyGoal === hours ? 'border-indigo-300 bg-indigo-50 font-medium' : 'border-slate-200 hover:border-indigo-300 hover:bg-indigo-50'
                        }`}
                      >
                        {hours}h
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-8 flex gap-3">
                <button onClick={() => setShowDailyGoal(false)} className="flex-1 px-4 py-3 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700">
                  Save Goal
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showAudioQuality && (
        <div className="fixed inset-0 z-50">
          <div className="modal-overlay flex items-end sm:items-center justify-center min-h-screen p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-md mx-auto p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-slate-800">Audio Quality</h2>
                <button onClick={() => setShowAudioQuality(false)} className="p-2 hover:bg-slate-100 rounded-lg">
                  ✕
                </button>
              </div>

              <div className="space-y-4">
                {['low', 'medium', 'high', 'ultra'].map((quality) => (
                  <div
                    key={quality}
                    onClick={() => setAudioQuality(quality)}
                    className={`p-4 border rounded-xl cursor-pointer transition-colors ${
                      audioQuality === quality ? 'border-indigo-300 bg-indigo-50' : 'border-slate-200 hover:border-indigo-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium text-slate-800 capitalize">{quality} Quality</div>
                        <div className="text-sm text-slate-500">
                          {quality === 'low' && '64 kbps • Faster uploads • Basic transcripts'}
                          {quality === 'medium' && '128 kbps • Balanced performance • Good transcripts'}
                          {quality === 'high' && '256 kbps • Best transcripts • Slower uploads'}
                          {quality === 'ultra' && '320 kbps • Premium transcripts • Slowest uploads'}
                        </div>
                      </div>
                      {audioQuality === quality && <span className="text-xs text-green-600">Current setting</span>}
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-xl">
                <div className="flex items-start gap-3">
                  <span className="text-amber-600 mt-0.5">⚠️</span>
                  <div>
                    <div className="text-sm font-medium text-amber-800">Higher quality = Better transcripts</div>
                    <div className="text-xs text-amber-700 mt-1">But uploads may take longer with high-quality audio</div>
                  </div>
                </div>
              </div>

              <div className="mt-8 flex gap-3">
                <button onClick={() => setShowAudioQuality(false)} className="flex-1 px-4 py-3 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700">
                  Save Quality
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showHelp && (
        <div className="fixed inset-0 z-50">
          <div className="modal-overlay flex items-end sm:items-center justify-center min-h-screen p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-md mx-auto p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-slate-800">Help & Support</h2>
                <button onClick={() => setShowHelp(false)} className="p-2 hover:bg-slate-100 rounded-lg">
                  ✕
                </button>
              </div>

              <div className="space-y-4">
                <a href="mailto:support@universite.co.za" className="block p-4 border border-slate-200 rounded-xl hover:border-indigo-300 transition-colors">
                  <div className="font-medium text-slate-800">Email Support</div>
                  <div className="text-sm text-slate-500">support@universite.co.za</div>
                </a>

                <a href="mailto:legal@universite.co.za" className="block p-4 border border-slate-200 rounded-xl hover:border-indigo-300 transition-colors">
                  <div className="font-medium text-slate-800">Legal Contact</div>
                  <div className="text-sm text-slate-500">legal@universite.co.za</div>
                </a>
              </div>

              <div className="mt-8 flex gap-3">
                <button onClick={() => setShowHelp(false)} className="flex-1 px-4 py-3 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700">
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showProfileModal && (
        <div className="fixed inset-0 z-50">
          <div className="modal-overlay flex items-end sm:items-center justify-center min-h-screen p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-md mx-auto p-6 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-slate-800">Edit Profile</h2>
                <button onClick={() => setShowProfileModal(false)} className="p-2 hover:bg-slate-100 rounded-lg">
                  ✕
                </button>
              </div>

              <form ref={formRef} onSubmit={handleSaveProfile} className="space-y-5">
                <div>
                  <label htmlFor="full_name" className="block text-sm font-medium text-slate-700 mb-2">Full Name</label>
                  <input
                    type="text"
                    id="full_name"
                    name="full_name"
                    defaultValue={profile?.full_name || user?.user_metadata?.full_name || ''}
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
                    defaultValue={profile?.university || ''}
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
                    defaultValue={profile?.major || ''}
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
                    defaultValue={profile?.year || ''}
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
                    defaultValue={profile?.study_time || ''}
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
                    defaultValue={profile?.learning_style || ''}
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

                <div className="mt-8 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setShowProfileModal(false)}
                    className="flex-1 px-4 py-3 bg-slate-200 text-slate-700 rounded-xl font-medium hover:bg-slate-300"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-3 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700"
                  >
                    Save
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

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
            <Link href="/lectures" className="flex flex-col items-center py-2 px-4 text-slate-400 hover:text-slate-600">
              <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
              <span className="text-xs font-medium">Lectures</span>
            </Link>
            <Link href="/assistant" className="flex flex-col items-center py-2 px-4 text-slate-400 hover:text-slate-600">
              <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
              </svg>
              <span className="text-xs font-medium">Chat</span>
            </Link>
            <Link href="/settings" className="flex flex-col items-center py-2 px-4 text-indigo-600">
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
  );
}
