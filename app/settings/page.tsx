'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { signOut, getSession } from '@/lib/supabase/auth';
import { supabase } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import Alert from '../components/Alert';
import { useTheme } from '../components/ThemeProvider';

export default function SettingsPage() {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [showNotifications, setShowNotifications] = useState(false);
  const [showAppearance, setShowAppearance] = useState(false);
  const [showDailyGoal, setShowDailyGoal] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);
  const [subscription, setSubscription] = useState<any>(null);
  const [loadingSubscription, setLoadingSubscription] = useState(false);

  // Notification preferences state
  const [notificationPrefs, setNotificationPrefs] = useState({
    daily_motivation: true,
    quiz_reminders: true,
    weekly_summary: false,
    streak_reminders: true,
    reminder_time: '09:00'
  });
  const [loadingPrefs, setLoadingPrefs] = useState(false);
  const [dailyGoal, setDailyGoal] = useState(3);
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const formRef = useRef<HTMLFormElement>(null);

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
    loadUserData();
    loadNotificationPreferences();
    loadSubscription();
  }, []);

  const loadNotificationPreferences = async () => {
    try {
      const session = await getSession();
      if (!session) return;

      setLoadingPrefs(true);
      const response = await fetch('/api/notifications/preferences', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.preferences) {
          setNotificationPrefs({
            daily_motivation: data.preferences.daily_motivation,
            quiz_reminders: data.preferences.quiz_reminders,
            weekly_summary: data.preferences.weekly_summary,
            streak_reminders: data.preferences.streak_reminders,
            reminder_time: data.preferences.reminder_time?.substring(0, 5) || '09:00'
          });
        }
      }
    } catch (error) {
      console.error('Error loading notification preferences:', error);
    } finally {
      setLoadingPrefs(false);
    }
  };

  const saveNotificationPreferences = async () => {
    try {
      const session = await getSession();
      if (!session) return;

      setLoadingPrefs(true);
      const response = await fetch('/api/notifications/preferences', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(notificationPrefs)
      });

      if (response.ok) {
        showAlert('Success', 'Notification preferences saved', 'success');
        setShowNotifications(false);
      } else {
        showAlert('Error', 'Failed to save notification preferences', 'error');
      }
    } catch (error) {
      console.error('Error saving notification preferences:', error);
      showAlert('Error', 'Failed to save notification preferences', 'error');
    } finally {
      setLoadingPrefs(false);
    }
  };

  const loadUserData = async () => {
    try {
      const session = await getSession();
      if (session?.user) {
        setUser(session.user);

        // Load profile from profiles table
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('user_id', session.user.id)
          .single();

        if (profile) {
          setProfile(profile);
        } else {
          setProfile(session.user.user_metadata || {});
        }
      }
    } catch (error) {
      console.error('Error loading user data:', error);
    }
  };

  const loadSubscription = async () => {
    try {
      const session = await getSession();
      if (!session) return;

      setLoadingSubscription(true);
      const response = await fetch('/api/subscription', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setSubscription(data);
      }
    } catch (error) {
      console.error('Error loading subscription:', error);
    } finally {
      setLoadingSubscription(false);
    }
  };

  const handleCancelSubscription = async () => {
    try {
      const session = await getSession();
      if (!session) return;

      setLoadingSubscription(true);
      const response = await fetch('/api/subscription', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ action: 'cancel' })
      });

      if (response.ok) {
        const data = await response.json();
        setSubscription(data);
        showAlert('Success', 'Your subscription has been cancelled and you have been downgraded to the free plan.', 'success');
        setShowSubscriptionModal(false);
      } else {
        showAlert('Error', 'Failed to cancel subscription', 'error');
      }
    } catch (error) {
      console.error('Error cancelling subscription:', error);
      showAlert('Error', 'Failed to cancel subscription', 'error');
    } finally {
      setLoadingSubscription(false);
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

      // Save to profiles table
      const fullName = profileData.full_name?.toString() || '';
      const { data, error } = await supabase
        .from('profiles')
        .upsert({
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
        })
        .select()
        .single();

      if (error) {
        console.error('Supabase error:', error);
        throw error;
      }

      console.log('Profile saved successfully:', data);

      // Update local state with the new profile data
      if (data) {
        setProfile(data);
      }

      setShowProfileModal(false);
    } catch (error: any) {
      console.error('Error saving profile:', error);
      showAlert('Error', `Error saving profile: ${error.message || 'Unknown error'}`, 'error');
    }
  };

  return (
    <div className="bg-slate-50 dark:bg-slate-900 min-h-screen flex flex-col pb-20">
      {/* Header */}
      <div className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-4 py-3 md:py-4 sticky top-0 z-50">
        <div className="mx-auto w-full max-w-[430px] md:max-w-[680px] lg:max-w-[800px] flex items-center gap-3">
          <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg">
            <img alt="Universite logo" className="w-6 h-6 md:w-7 md:h-7 object-contain" src="/assets/images/icon-white-removebg.png" />
          </div>
          <h1 className="text-lg md:text-xl font-semibold text-slate-800 dark:text-slate-100">Settings</h1>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 mx-auto w-full max-w-[430px] md:max-w-[680px] lg:max-w-[800px] px-4 py-4">
        {/* Profile Section */}
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 mb-4">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-xl font-bold">
              {getInitials()}
            </div>
            <div className="flex-1">
              <div className="text-lg font-semibold text-slate-800 dark:text-slate-100">{getDisplayName()}</div>
              <div className="text-sm text-slate-500 dark:text-slate-400">{getEmail()}</div>
            </div>
          </div>
          <button 
            onClick={() => setShowProfileModal(true)}
            className="w-full px-4 py-2 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl font-medium active:scale-95 transition-transform mb-2"
          >
            Edit Profile
          </button>
          <button
            onClick={handleSignOut}
            className="w-full px-4 py-2 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 rounded-xl font-medium active:scale-95 transition-transform hover:bg-red-50 dark:hover:bg-red-900/20"
          >
            Sign Out
          </button>
        </div>

        {/* General Settings */}
        <div className="mb-4">
          <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2 px-2">General</h2>
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden divide-y divide-slate-200 dark:divide-slate-700">
            <button
              onClick={() => setShowNotifications(true)}
              className="w-full flex items-center justify-between p-4 active:bg-slate-50 dark:active:bg-slate-700 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center">
                  🔔
                </div>
                <div className="text-left">
                  <div className="font-medium text-slate-800 dark:text-slate-100">Notifications</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">Manage notification preferences</div>
                </div>
              </div>
              <span className="text-slate-400 dark:text-slate-500">→</span>
            </button>

            <button
              onClick={() => setShowAppearance(true)}
              className="w-full flex items-center justify-between p-4 active:bg-slate-50 dark:active:bg-slate-700 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
                  🎨
                </div>
                <div className="text-left">
                  <div className="font-medium text-slate-800 dark:text-slate-100">Appearance</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">Theme and display options</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-500 dark:text-slate-400 capitalize">{theme}</span>
                <span className="text-slate-400 dark:text-slate-500">→</span>
              </div>
            </button>
          </div>
        </div>

        {/* Study Settings */}
        <div className="mb-4">
          <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2 px-2">Study</h2>
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden divide-y divide-slate-200 dark:divide-slate-700">
            <button
              onClick={() => setShowDailyGoal(true)}
              className="w-full flex items-center justify-between p-4 active:bg-slate-50 dark:active:bg-slate-700 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center">
                  ⏰
                </div>
                <div className="text-left">
                  <div className="font-medium text-slate-800 dark:text-slate-100">Daily Study Goal</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">{dailyGoal} hours per day</div>
                </div>
              </div>
              <span className="text-slate-400 dark:text-slate-500">→</span>
            </button>

          </div>
        </div>

        {/* Subscription Settings */}
        {subscription && subscription.plan_slug !== 'free' && (
          <div className="mb-4">
            <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2 px-2">Subscription</h2>
            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden divide-y divide-slate-200 dark:divide-slate-700">
              <button
                onClick={() => setShowSubscriptionModal(true)}
                className="w-full flex items-center justify-between p-4 active:bg-slate-50 dark:active:bg-slate-700 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
                    💎
                  </div>
                  <div className="text-left">
                    <div className="font-medium text-slate-800 dark:text-slate-100">Manage Subscription</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">Current plan: {subscription.plans?.name || subscription.plan_slug}</div>
                  </div>
                </div>
                <span className="text-slate-400 dark:text-slate-500">→</span>
              </button>
            </div>
          </div>
        )}

        {/* About */}
        <div className="mb-4">
          <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2 px-2">About</h2>
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden divide-y divide-slate-200 dark:divide-slate-700">
            <button
              onClick={() => setShowHelp(true)}
              className="w-full flex items-center justify-between p-4 active:bg-slate-50 dark:active:bg-slate-700 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center">
                  ❓
                </div>
                <div className="text-left">
                  <div className="font-medium text-slate-800 dark:text-slate-100">Help & Support</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">Get help using the app</div>
                </div>
              </div>
              <span className="text-slate-400 dark:text-slate-500">→</span>
            </button>

            <Link href="/privacy" className="w-full flex items-center justify-between p-4 active:bg-slate-50 transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center">
                  📄
                </div>
                <div className="text-left">
                  <div className="font-medium text-slate-800 dark:text-slate-100">Privacy Policy</div>
                </div>
              </div>
              <span className="text-slate-400 dark:text-slate-500">→</span>
            </Link>

            <Link href="/terms" className="w-full flex items-center justify-between p-4 active:bg-slate-50 transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center">
                  📋
                </div>
                <div className="text-left">
                  <div className="font-medium text-slate-800 dark:text-slate-100">Terms of Service</div>
                </div>
              </div>
              <span className="text-slate-400 dark:text-slate-500">→</span>
            </Link>

            <div className="w-full flex items-center justify-between p-4 active:bg-slate-50 transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center">
                  ℹ️
                </div>
                <div className="text-left">
                  <div className="font-medium text-slate-800 dark:text-slate-100">About</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">Version 1.0.0</div>
                </div>
              </div>
              <span className="text-slate-400 dark:text-slate-500">→</span>
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      {showNotifications && (
        <div className="fixed inset-0 z-50">
          <div className="modal-overlay flex items-end sm:items-center justify-center min-h-screen p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white dark:bg-slate-800 rounded-t-2xl sm:rounded-2xl w-full max-w-md mx-auto p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-100">Notifications</h2>
                <button onClick={() => setShowNotifications(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg">
                  ✕
                </button>
              </div>

              {loadingPrefs ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-4 border-indigo-600 border-t-transparent"></div>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium text-slate-800 dark:text-slate-100">Daily Motivation 💪</div>
                      <div className="text-sm text-slate-500 dark:text-slate-400">Get daily motivational messages</div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={notificationPrefs.daily_motivation}
                        onChange={(e) => setNotificationPrefs(prev => ({ ...prev, daily_motivation: e.target.checked }))}
                        className="sr-only peer" 
                      />
                      <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                    </label>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium text-slate-800 dark:text-slate-100">Quiz Reminders 🎯</div>
                      <div className="text-sm text-slate-500 dark:text-slate-400">Remind to take quizzes on lectures</div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={notificationPrefs.quiz_reminders}
                        onChange={(e) => setNotificationPrefs(prev => ({ ...prev, quiz_reminders: e.target.checked }))}
                        className="sr-only peer" 
                      />
                      <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                    </label>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium text-slate-800 dark:text-slate-100">Weekly Summary 📊</div>
                      <div className="text-sm text-slate-500 dark:text-slate-400">Get weekly progress summaries</div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={notificationPrefs.weekly_summary}
                        onChange={(e) => setNotificationPrefs(prev => ({ ...prev, weekly_summary: e.target.checked }))}
                        className="sr-only peer" 
                      />
                      <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                    </label>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium text-slate-800 dark:text-slate-100">Streak Reminders 🔥</div>
                      <div className="text-sm text-slate-500 dark:text-slate-400">Remind to maintain learning streak</div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={notificationPrefs.streak_reminders}
                        onChange={(e) => setNotificationPrefs(prev => ({ ...prev, streak_reminders: e.target.checked }))}
                        className="sr-only peer" 
                      />
                      <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                    </label>
                  </div>

                  <div>
                    <label className="block font-medium text-slate-700 dark:text-slate-300 mb-2">Reminder Time</label>
                    <input
                      type="time"
                      value={notificationPrefs.reminder_time}
                      onChange={(e) => setNotificationPrefs(prev => ({ ...prev, reminder_time: e.target.value }))}
                      className="w-full px-4 py-2 border border-slate-200 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 dark:text-slate-100 dark:bg-slate-700"
                    />
                  </div>
                </div>
              )}

              <div className="mt-8 flex gap-3">
                <button 
                  onClick={() => setShowNotifications(false)} 
                  className="flex-1 px-4 py-3 bg-slate-100 text-slate-700 rounded-xl font-medium hover:bg-slate-200"
                  disabled={loadingPrefs}
                >
                  Cancel
                </button>
                <button 
                  onClick={saveNotificationPreferences} 
                  className="flex-1 px-4 py-3 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 disabled:opacity-50"
                  disabled={loadingPrefs}
                >
                  {loadingPrefs ? 'Saving...' : 'Save Settings'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showAppearance && (
        <div className="fixed inset-0 z-50">
          <div className="modal-overlay flex items-end sm:items-center justify-center min-h-screen p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white dark:bg-slate-800 rounded-t-2xl sm:rounded-2xl w-full max-w-md mx-auto p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-100">Appearance</h2>
                <button onClick={() => setShowAppearance(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg">
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
                        <div className="font-medium text-slate-800 dark:text-slate-100 capitalize">{t}</div>
                        <div className="text-sm text-slate-500 dark:text-slate-400">
                          {t === 'light' ? 'Clean and bright interface' : t === 'dark' ? 'Easy on the eyes in low light' : 'Follow your device settings'}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-8 flex gap-3">
                <button onClick={() => setShowAppearance(false)} className="flex-1 px-4 py-3 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700">
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showDailyGoal && (
        <div className="fixed inset-0 z-50">
          <div className="modal-overlay flex items-end sm:items-center justify-center min-h-screen p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white dark:bg-slate-800 rounded-t-2xl sm:rounded-2xl w-full max-w-md mx-auto p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-100">Daily Study Goal</h2>
                <button onClick={() => setShowDailyGoal(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg">
                  ✕
                </button>
              </div>

              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Set Daily Goal</label>
                  <div className="grid grid-cols-4 gap-2">
                    {[1, 2, 3, 4].map((hours) => (
                      <button
                        key={hours}
                        onClick={() => setDailyGoal(hours)}
                        className={`px-3 py-2 border rounded-lg text-sm text-slate-800 dark:text-slate-100 transition-colors ${
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


      {showHelp && (
        <div className="fixed inset-0 z-50">
          <div className="modal-overlay flex items-end sm:items-center justify-center min-h-screen p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white dark:bg-slate-800 rounded-t-2xl sm:rounded-2xl w-full max-w-md mx-auto p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-100">Help & Support</h2>
                <button onClick={() => setShowHelp(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg">
                  ✕
                </button>
              </div>

              <div className="space-y-4">
                <a href="mailto:support@universite.co.za" className="block p-4 border border-slate-200 rounded-xl hover:border-indigo-300 transition-colors">
                  <div className="font-medium text-slate-800 dark:text-slate-100">Email Support</div>
                  <div className="text-sm text-slate-500 dark:text-slate-400">support@universite.co.za</div>
                </a>

                <a href="mailto:legal@universite.co.za" className="block p-4 border border-slate-200 rounded-xl hover:border-indigo-300 transition-colors">
                  <div className="font-medium text-slate-800 dark:text-slate-100">Legal Contact</div>
                  <div className="text-sm text-slate-500 dark:text-slate-400">legal@universite.co.za</div>
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
                <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-100">Edit Profile</h2>
                <button onClick={() => setShowProfileModal(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg">
                  ✕
                </button>
              </div>

              <form ref={formRef} onSubmit={handleSaveProfile} className="space-y-5">
                <div>
                  <label htmlFor="full_name" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Full Name</label>
                  <input
                    type="text"
                    id="full_name"
                    name="full_name"
                    defaultValue={profile?.full_name || user?.user_metadata?.full_name || ''}
                    className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all outline-none text-sm text-slate-800 dark:text-slate-100 dark:bg-slate-700"
                    placeholder="Your full name"
                    required
                  />
                </div>

                <div>
                  <label htmlFor="university" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">University/College</label>
                  <input
                    type="text"
                    id="university"
                    name="university"
                    defaultValue={profile?.university || ''}
                    className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all outline-none text-sm text-slate-800 dark:text-slate-100 dark:bg-slate-700"
                    placeholder="Your university or college"
                    required
                  />
                </div>

                <div>
                  <label htmlFor="major" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Major/Field of Study</label>
                  <input
                    type="text"
                    id="major"
                    name="major"
                    defaultValue={profile?.major || ''}
                    className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all outline-none text-sm text-slate-800 dark:text-slate-100 dark:bg-slate-700"
                    placeholder="e.g., Computer Science, Biology"
                    required
                  />
                </div>

                <div>
                  <label htmlFor="year" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Year of Study</label>
                  <select
                    id="year"
                    name="year"
                    defaultValue={profile?.year || ''}
                    className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all outline-none text-sm text-slate-800 dark:text-slate-100 dark:bg-slate-700"
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
                  <label htmlFor="study_time" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Preferred Study Time</label>
                  <select
                    id="study_time"
                    name="study_time"
                    defaultValue={profile?.study_time || ''}
                    className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all outline-none text-sm text-slate-800 dark:text-slate-100 dark:bg-slate-700"
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
                  <label htmlFor="learning_style" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Learning Style</label>
                  <select
                    id="learning_style"
                    name="learning_style"
                    defaultValue={profile?.learning_style || ''}
                    className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all outline-none text-sm text-slate-800 dark:text-slate-100 dark:bg-slate-700"
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
                    className="flex-1 px-4 py-3 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl font-medium hover:bg-slate-300 dark:hover:bg-slate-600"
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

      {showSubscriptionModal && (
        <div className="fixed inset-0 z-50">
          <div className="modal-overlay flex items-end sm:items-center justify-center min-h-screen p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white dark:bg-slate-800 rounded-t-2xl sm:rounded-2xl w-full max-w-md mx-auto p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-100">Manage Subscription</h2>
                <button onClick={() => setShowSubscriptionModal(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg">
                  ✕
                </button>
              </div>

              <div className="space-y-4">
                <div className="p-4 bg-purple-50 border border-purple-200 rounded-xl">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
                      💎
                    </div>
                    <div>
                      <div className="font-semibold text-slate-800 dark:text-slate-100">{subscription?.plans?.name || 'Premium'}</div>
                      <div className="text-sm text-slate-600 dark:text-slate-400">Current plan</div>
                    </div>
                  </div>
                  {subscription?.expires_at && (
                    <div className="text-sm text-slate-600">
                      Expires: {new Date(subscription.expires_at).toLocaleDateString()}
                    </div>
                  )}
                </div>

                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center">
                      🆓
                    </div>
                    <div>
                      <div className="font-semibold text-slate-800 dark:text-slate-100">Free Beta</div>
                      <div className="text-sm text-slate-600 dark:text-slate-400">After cancellation</div>
                    </div>
                  </div>
                  <div className="text-sm text-slate-600 mt-2">
                    • 200 chat messages per month<br />
                    • 30 flashcard generations per month<br />
                    • 4 lecture uploads per month<br />
                    • 360 transcription minutes per month
                  </div>
                </div>

                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                  <div className="flex items-start gap-2">
                    <span className="text-amber-600">⚠️</span>
                    <div className="text-sm text-amber-800">
                      <strong>Important:</strong> Cancelling will immediately downgrade your account to the free plan. You will lose access to premium features and your quotas will be reduced.
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-8 flex gap-3">
                <button
                  onClick={() => setShowSubscriptionModal(false)}
                  className="flex-1 px-4 py-3 bg-slate-100 text-slate-700 rounded-xl font-medium hover:bg-slate-200"
                  disabled={loadingSubscription}
                >
                  Keep Premium
                </button>
                <button
                  onClick={handleCancelSubscription}
                  className="flex-1 px-4 py-3 bg-red-600 text-white rounded-xl font-medium hover:bg-red-700 disabled:opacity-50"
                  disabled={loadingSubscription}
                >
                  {loadingSubscription ? 'Cancelling...' : 'Cancel Subscription'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 safe-area-inset-bottom z-10">
        <div className="mx-auto w-full max-w-[430px] md:max-w-[680px] lg:max-w-[800px]">
          <div className="flex items-center justify-around py-2">
            <Link href="/dashboard" className="flex flex-col items-center py-2 px-4 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300">
              <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
              <span className="text-xs font-medium">Home</span>
            </Link>
            <Link href="/lectures" className="flex flex-col items-center py-2 px-4 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300">
              <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
              <span className="text-xs font-medium">Lectures</span>
            </Link>
            <Link href="/settings" className="flex flex-col items-center py-2 px-4 text-indigo-600 dark:text-indigo-400">
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
  );
}
