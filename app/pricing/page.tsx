'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getSession } from '@/lib/supabase/auth';

interface Plan {
  plan_slug: string;
  name: string;
  monthly_chat_messages: number;
  monthly_flashcard_generations: number;
  monthly_lecture_uploads: number;
  monthly_transcription_minutes: number;
  price_zar: number;
  interval: string;
}

interface Subscription {
  plan_slug: string;
  status: string;
  expires_at: string | null;
}

export default function PricingPage() {
  const router = useRouter();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [currentSubscription, setCurrentSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);

  useEffect(() => {
    loadPlansAndSubscription();
  }, []);

  const loadPlansAndSubscription = async () => {
    try {
      const session = await getSession();
      if (!session) {
        router.push('/login');
        return;
      }

      // Load plans
      const plansResponse = await fetch('/api/plans');
      if (plansResponse.ok) {
        const plansData = await plansResponse.json();
        console.log('Plans loaded:', plansData);
        setPlans(plansData);
      } else {
        console.error('Failed to load plans:', plansResponse.status);
      }

      // Load current subscription
      const subResponse = await fetch('/api/subscription', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });
      if (subResponse.ok) {
        const subData = await subResponse.json();
        setCurrentSubscription(subData);
      }
    } catch (error) {
      console.error('Error loading plans:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubscribe = async (planSlug: string) => {
    try {
      setProcessing(planSlug);
      const session = await getSession();
      if (!session) return;

      const response = await fetch('/api/payments/payfast/create', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ plan_slug: planSlug })
      });

      if (response.ok) {
        const data = await response.json();
        
        // Create form and submit to PayFast
        const form = document.createElement('form');
        form.method = 'POST';
        form.action = data.payfastUrl;

        Object.entries(data.paymentData).forEach(([key, value]) => {
          const input = document.createElement('input');
          input.type = 'hidden';
          input.name = key;
          input.value = value as string;
          form.appendChild(input);
        });

        document.body.appendChild(form);
        form.submit();
      } else {
        const error = await response.json();
        alert('Failed to initiate payment: ' + error.error);
      }
    } catch (error) {
      console.error('Payment error:', error);
      alert('Failed to initiate payment');
    } finally {
      setProcessing(null);
    }
  };

  const isCurrentPlan = (planSlug: string) => {
    return currentSubscription?.plan_slug === planSlug && currentSubscription?.status === 'active';
  };

  const isFreePlan = (planSlug: string) => {
    return planSlug === 'free';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-slate-600">Loading pricing...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <button
              onClick={() => router.back()}
              className="flex items-center gap-2 text-slate-600 hover:text-slate-900"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back
            </button>
            <h1 className="text-xl font-semibold text-slate-900">Choose Your Plan</h1>
            <div className="w-20"></div>
          </div>
        </div>
      </div>

      {/* Pricing */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-slate-900 mb-4">Simple, Transparent Pricing</h2>
          <p className="text-lg text-slate-600">Choose the plan that fits your learning needs</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {plans.map((plan) => (
            <div
              key={plan.plan_slug}
              className={`bg-white rounded-2xl shadow-lg overflow-hidden ${
                !isFreePlan(plan.plan_slug) ? 'ring-2 ring-indigo-600' : ''
              }`}
            >
              {plan.interval === 'year' && (
                <div className="bg-indigo-600 text-white text-center py-2 text-sm font-semibold">
                  Save 17% with yearly billing
                </div>
              )}
              
              <div className="p-6">
                <h3 className="text-xl font-bold text-slate-900 mb-2">{plan.name}</h3>
                <div className="mb-6">
                  <span className="text-4xl font-bold text-slate-900">
                    R{plan.price_zar.toFixed(0)}
                  </span>
                  <span className="text-slate-600">/{plan.interval}</span>
                </div>

                <ul className="space-y-3 mb-6">
                  <li className="flex items-center gap-2 text-slate-700">
                    <svg className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    {plan.monthly_chat_messages.toLocaleString()} chat messages/month
                  </li>
                  <li className="flex items-center gap-2 text-slate-700">
                    <svg className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    {plan.monthly_flashcard_generations} flashcard generations
                  </li>
                  <li className="flex items-center gap-2 text-slate-700">
                    <svg className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    {plan.monthly_lecture_uploads} lecture uploads
                  </li>
                  <li className="flex items-center gap-2 text-slate-700">
                    <svg className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    {plan.monthly_transcription_minutes} transcription minutes
                  </li>
                </ul>

                <button
                  onClick={() => handleSubscribe(plan.plan_slug)}
                  disabled={isCurrentPlan(plan.plan_slug) || processing === plan.plan_slug}
                  className={`w-full py-3 px-4 rounded-xl font-semibold transition-all ${
                    isCurrentPlan(plan.plan_slug)
                      ? 'bg-slate-100 text-slate-500 cursor-not-allowed'
                      : !isFreePlan(plan.plan_slug)
                      ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:shadow-lg'
                      : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                  }`}
                >
                  {processing === plan.plan_slug ? (
                    'Processing...'
                  ) : isCurrentPlan(plan.plan_slug) ? (
                    'Current Plan'
                  ) : isFreePlan(plan.plan_slug) ? (
                    'Downgrade'
                  ) : (
                    'Subscribe'
                  )}
                </button>

                {isCurrentPlan(plan.plan_slug) && currentSubscription?.expires_at && (
                  <p className="text-center text-sm text-slate-500 mt-3">
                    Renews {new Date(currentSubscription.expires_at).toLocaleDateString()}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
