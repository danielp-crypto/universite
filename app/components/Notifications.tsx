'use client';

import React, { useState, useEffect } from 'react';
import { getSession } from '@/lib/supabase/auth';

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  created_at: string;
}

interface NotificationsProps {
  onNotificationCountChange?: (count: number) => void;
}

export default function Notifications({ onNotificationCountChange }: NotificationsProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const maybeGenerateQuizReminder = async (accessToken: string) => {
    try {
      // Server-side checks the user's preferences, whether they actually have
      // an unquizzed lecture, and a 24h cooldown — safe to call on every
      // mount without spamming duplicate reminders.
      await fetch('/api/notifications/generate', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ type: 'quiz_reminder' })
      });
    } catch (error) {
      console.error('Error checking quiz reminder:', error);
    }
  };

  const fetchNotifications = async () => {
    try {
      const session = await getSession();
      if (!session) return;

      await maybeGenerateQuizReminder(session.access_token);

      const response = await fetch('/api/notifications', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setNotifications(data.notifications || []);
        const unreadCount = (data.notifications || []).filter((n: Notification) => !n.read).length;
        if (onNotificationCountChange) {
          onNotificationCountChange(unreadCount);
        }
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (notificationId: string) => {
    try {
      const session = await getSession();
      if (!session) return;

      const response = await fetch(`/api/notifications/${notificationId}/read`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });

      if (!response.ok) {
        console.error('Failed to mark notification as read:', response.status);
        return;
      }

      const result = await response.json();
      if (!result.marked) {
        console.error('Notification read update matched no rows:', notificationId);
        return;
      }

      setNotifications(prev =>
        prev.map(n => n.id === notificationId ? { ...n, read: true } : n)
      );
      
      const unreadCount = notifications.filter(n => n.id !== notificationId && !n.read).length;
      if (onNotificationCountChange) {
        onNotificationCountChange(unreadCount);
      }
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      const session = await getSession();
      if (!session) return;

      const unreadIds = notifications.filter(n => !n.read).map(n => n.id);
      
      const results = await Promise.all(
        unreadIds.map(id =>
          fetch(`/api/notifications/${id}/read`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${session.access_token}`
            }
          }).then(res => ({ id, ok: res.ok }))
        )
      );

      const succeededIds = new Set(results.filter(r => r.ok).map(r => r.id));
      if (succeededIds.size < unreadIds.length) {
        console.error('Some notifications failed to mark as read:', unreadIds.filter(id => !succeededIds.has(id)));
      }

      setNotifications(prev => prev.map(n => succeededIds.has(n.id) ? { ...n, read: true } : n));
      const remainingUnread = notifications.filter(n => !succeededIds.has(n.id) && !n.read).length;
      if (onNotificationCountChange) {
        onNotificationCountChange(remainingUnread);
      }
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  const unreadCount = notifications.filter(n => !n.read).length;

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'motivation':
        return '💪';
      case 'quiz_reminder':
        return '🎯';
      case 'weekly_summary':
        return '📊';
      case 'streak_reminder':
        return '🔥';
      case 'lecture_ready':
        return '📝';
      default:
        return '🔔';
    }
  };

  const getNotificationColor = (type: string) => {
    switch (type) {
      case 'motivation':
        return 'from-emerald-50 to-green-50 border-emerald-200';
      case 'quiz_reminder':
        return 'from-violet-50 to-purple-50 border-violet-200';
      case 'weekly_summary':
        return 'from-blue-50 to-indigo-50 border-blue-200';
      case 'streak_reminder':
        return 'from-amber-50 to-orange-50 border-amber-200';
      case 'lecture_ready':
        return 'from-indigo-50 to-blue-50 border-indigo-200';
      default:
        return 'from-slate-50 to-gray-50 border-slate-200';
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-lg hover:bg-slate-100 transition-colors"
      >
        <svg className="w-6 h-6 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 top-full mt-2 w-96 bg-white rounded-2xl shadow-2xl border border-slate-200 z-50 max-h-[500px] overflow-hidden">
            <div className="p-4 border-b border-slate-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-slate-900">Notifications</h3>
                {unreadCount > 0 && (
                  <button
                    onClick={markAllAsRead}
                    className="text-sm text-indigo-600 hover:text-indigo-700 font-medium"
                  >
                    Mark all read
                  </button>
                )}
              </div>
            </div>

            <div className="overflow-y-auto max-h-[400px]">
              {loading ? (
                <div className="p-8 text-center text-slate-500">
                  <div className="animate-spin rounded-full h-8 w-8 border-4 border-indigo-600 border-t-transparent mx-auto mb-2"></div>
                  Loading...
                </div>
              ) : notifications.length === 0 ? (
                <div className="p-8 text-center text-slate-500">
                  <div className="text-4xl mb-2">🔔</div>
                  <p>No notifications yet</p>
                </div>
              ) : (
                notifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={`p-4 border-b border-slate-100 hover:bg-slate-50 cursor-pointer transition-colors ${
                      !notification.read ? 'bg-indigo-50/50' : ''
                    }`}
                    onClick={() => markAsRead(notification.id)}
                  >
                    <div className={`p-3 rounded-xl border mb-2 ${getNotificationColor(notification.type)}`}>
                      <div className="flex items-start gap-3">
                        <span className="text-2xl">{getNotificationIcon(notification.type)}</span>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-slate-900 text-sm truncate">{notification.title}</p>
                          <p className="text-slate-700 text-sm mt-1 line-clamp-2">{notification.message}</p>
                        </div>
                      </div>
                    </div>
                    <p className="text-xs text-slate-400">{formatTime(notification.created_at)}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}