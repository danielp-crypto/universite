'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiGet, apiPost } from '@/lib/api/client';

// Yoco appends checkout id as query parameter to success URL
// We need to verify the payment server-side before activating subscription
const POLL_INTERVAL_MS = 1500;
const MAX_POLL_ATTEMPTS = 10; // ~15 seconds total

export default function PaymentSuccessPage() {
  const router = useRouter();
  const [status, setStatus] = useState<'verifying' | 'confirming' | 'confirmed' | 'timed_out'>('verifying');

  useEffect(() => {
    // Get checkoutId from URL search params
    const urlParams = new URLSearchParams(window.location.search);
    const checkoutId = urlParams.get('checkoutId');
    console.log('Payment success page loaded with checkoutId:', checkoutId);

    let attempts = 0;
    let cancelled = false;

    const verifyAndPoll = async () => {
      try {
        // First, verify the payment with Yoco if we have a checkout ID
        if (checkoutId) {
          console.log('Verifying Yoco payment...');
          const verifyResult = await apiPost('/api/payments/yoco/verify', { checkoutId });
          console.log('Verification result:', verifyResult);

          if (verifyResult.success) {
            console.log('Payment verified successfully');
          } else {
            console.warn('Payment verification returned:', verifyResult);
          }
        }

        setStatus('confirming');

        // Then poll for subscription activation
        const poll = async () => {
          try {
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
      } catch (error) {
        console.error('Error during payment verification:', error);
        setStatus('timed_out');
      }
    };

    verifyAndPoll();

    return () => {
      cancelled = true;
    };
  }, [router]);

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
          {status === 'verifying' && (
            <p className="text-sm text-slate-600 flex items-center justify-center gap-2">
              <span className="inline-block w-4 h-4 border-2 border-slate-300 border-t-indigo-600 rounded-full animate-spin"></span>
              Verifying payment with Yoco...
            </p>
          )}
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