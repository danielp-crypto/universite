'use client';

import React from 'react';

interface AlertProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  message: string;
  type?: 'error' | 'warning' | 'info' | 'success';
  actionUrl?: string;
}

export default function Alert({ isOpen, onClose, title, message, type = 'info', actionUrl }: AlertProps) {
  if (!isOpen) return null;

  const handleAction = () => {
    if (actionUrl) {
      window.location.href = actionUrl;
    }
    onClose();
  };

  const colors = {
    error: 'bg-red-50 border-red-200 text-red-800',
    warning: 'bg-amber-50 border-amber-200 text-amber-800',
    info: 'bg-blue-50 border-blue-200 text-blue-800',
    success: 'bg-emerald-50 border-emerald-200 text-emerald-800'
  };

  const iconColors = {
    error: 'text-red-600',
    warning: 'text-amber-600',
    info: 'text-blue-600',
    success: 'text-emerald-600'
  };

  const icons = {
    error: '⚠️',
    warning: '⚠️',
    info: 'ℹ️',
    success: '✅'
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className={`bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl animate-fade-in border-2 ${colors[type]}`}>
        <div className="flex items-start gap-4">
          <div className={`text-2xl ${iconColors[type]}`}>{icons[type]}</div>
          <div className="flex-1">
            <h3 className="text-lg font-bold text-slate-900 mb-1">{title}</h3>
            <p className="text-sm text-slate-600">{message}</p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="mt-4">
          <button
            onClick={handleAction}
            className="w-full px-4 py-2 bg-slate-100 text-slate-700 rounded-xl font-medium hover:bg-slate-200 transition-colors"
          >
            {actionUrl ? 'View' : 'OK'}
          </button>
        </div>
      </div>
    </div>
  );
}
