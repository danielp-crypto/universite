'use client';

import React from 'react';

interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  feature: string;
  onUpgrade?: () => void;
}

export default function UpgradeModal({ isOpen, onClose, feature, onUpgrade }: UpgradeModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl animate-fade-in">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <h3 className="text-xl font-bold text-slate-900 mb-2">Upgrade to Premium</h3>
          <p className="text-slate-600 mb-6">
            {feature} is a premium feature. Upgrade to unlock unlimited access to all AI-powered study tools.
          </p>
          <div className="space-y-3">
            <button
              onClick={onUpgrade || onClose}
              className="w-full px-4 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-semibold hover:shadow-lg transition-all active:scale-95"
            >
              Upgrade Now
            </button>
            <button
              onClick={onClose}
              className="w-full px-4 py-3 bg-slate-100 text-slate-700 rounded-xl font-semibold hover:bg-slate-200 transition-all active:scale-95"
            >
              Maybe Later
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
