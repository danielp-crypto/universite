'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSearchParams } from 'next/navigation';
import { apiGet, apiPost } from '@/lib/api/client';
import { Suspense } from 'react';

// PayFast's server-to-server webhook (ITN) that actually activates the
// subscription in our database fires independently of this page loading —
// there's no guarantee it has completed by the time the browser lands here.
// Rather than guessing at a fixed delay, poll /api/subscription until it
// actually confirms an active paid plan, or give up after a reasonable time.
const POLL_INTERVAL_MS = 1500;
const MAX_POLL_ATTEMPTS = 10; // ~15 seconds total

function PaymentSuccessContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<'confirming' | 'confirmed' | 'timed_out'>('confirming');

  useEffect(() => {
    let attempts = 0;
    let cancelled = false;

    const poll = async () => {
      try {
        const checkoutId = searchParams.get('checkoutId') || searchParams.get('checkout_id') || searchParams.get('id');
        if (checkoutId) {
          await apiPost('/api/payments/yoco/verify', { checkoutId });
        }
        const subscription = await apiGet('/api/subscription');
        if (cancelled) return;

        if (subscription?.status === 'active' && subscription?.plan_slug !== 'free') {
          setStatus('confirmed');
          setTimeout(() => router.push('/dashboard'), 1200);
          return;
        }
      } catch (error) {
        console.error('Error checking subscription status:', error);
      }

      attempts += 1;
      if (attempts >= MAX_POLL_ATTEMPTS) {
        if (!cancelled) setStatus('timed_out');
        return;
      }

      if (!cancelled) {
        setTimeout(poll, POLL_INTERVAL_MS);
      }
    };

    poll();

    return () => {
      cancelled = true;
    };
  }, [router, searchParams]);

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full mx-4 text-center">
        <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center">
          <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>

        <h1 className="text-2xl font-bold text-slate-900 mb-2">Payment Successful!</h1>
        <p className="text-slate-600 mb-6">
          Thank you for your subscription.
        </p>

        <div className="bg-slate-50 rounded-xl p-4 mb-6">
          {status === 'confirming' && (
            <p className="text-sm text-slate-600 flex items-center justify-center gap-2">
              <span className="inline-block w-4 h-4 border-2 border-slate-300 border-t-indigo-600 rounded-full animate-spin"></span>
              Confirming your upgrade...
            </p>
          )}
          {status === 'confirmed' && (
            <p className="text-sm text-emerald-600 font-medium">
              Your account has been upgraded! Redirecting to dashboard...
            </p>
          )}
          {status === 'timed_out' && (
            <p className="text-sm text-amber-600">
              This is taking longer than expected. Your payment was received — if your account
              doesn't show as upgraded within a minute or two, please contact support.
            </p>
          )}
        </div>

        <button
          onClick={() => router.push('/dashboard')}
          className="w-full py-3 px-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-semibold hover:shadow-lg transition-all"
        >
          Go to Dashboard
        </button>
      </div>
    </div>
  );
}

export default function PaymentSuccessPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-50" />}>
      <PaymentSuccessContent />
    </Suspense>
  );
}
