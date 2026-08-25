import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

// PAYFAST_SANDBOX only controls behavior/URLs elsewhere — your merchant ID,
// key, and passphrase are always your own real credentials from env vars.
// There is no shared "generic" sandbox account to fall back to.
const PAYFAST_SANDBOX = process.env.PAYFAST_SANDBOX === 'true';
const PAYFAST_MERCHANT_ID = process.env.PAYFAST_MERCHANT_ID!;
const PAYFAST_MERCHANT_KEY = process.env.PAYFAST_MERCHANT_KEY!;
const PAYFAST_PASSPHRASE = process.env.PAYFAST_PASSPHRASE || '';

export async function POST(request: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Get PayFast notification data
    const formData = await request.formData();
    const data: Record<string, string> = {};

    for (const [key, value] of formData.entries()) {
      data[key] = value.toString();
    }

    // Verify signature
    const receivedSignature = data.signature;
    const calculatedSignature = generateSignature(data);

    if (receivedSignature !== calculatedSignature) {
      console.error('PayFast signature mismatch');
      return new Response('Invalid signature', { status: 400 });
    }

    // Verify merchant ID
    if (data.merchant_id !== PAYFAST_MERCHANT_ID) {
      console.error('PayFast merchant ID mismatch');
      return new Response('Invalid merchant', { status: 400 });
    }

    const paymentStatus = data.payment_status;
    const paymentId = data.m_payment_id;
    const userId = data.custom_str1;
    const planSlug = data.custom_str2;
    const token = data.token; // PayFast subscription token for recurring payments

    console.log('PayFast webhook received:', {
      paymentId,
      paymentStatus,
      userId,
      planSlug,
    });

    if (paymentStatus === 'COMPLETE') {
      // Get current subscription to check if this is an initial or a recurring payment
      const { data: currentSub } = await supabaseAdmin
        .from('user_subscriptions')
        .select('*')
        .eq('user_id', userId)
        .single();

      // Check if this is a recurring payment by checking if token exists and matches
      const isRecurring = token && currentSub?.subscription_token === token;

      if (isRecurring && currentSub && currentSub.status === 'active' && currentSub.plan_slug === planSlug) {
        // Recurring payment on the same plan the user is already active on — extend it
        const currentExpiry = new Date(currentSub.expires_at || new Date());
        const newExpiry = new Date(currentExpiry);

        if (planSlug.includes('month')) {
          newExpiry.setMonth(newExpiry.getMonth() + 1);
        } else if (planSlug.includes('year')) {
          newExpiry.setFullYear(newExpiry.getFullYear() + 1);
        }

        const { error: updateError } = await supabaseAdmin
          .from('user_subscriptions')
          .update({
            expires_at: newExpiry.toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('user_id', userId);

        if (updateError) {
          console.error('Error extending subscription:', updateError);
        }

        console.log('Subscription extended for user:', userId, 'New expiry:', newExpiry);
      } else {
        // Initial payment (or switching plans) - activate subscription
        const startedAt = new Date();
        const expiresAt = new Date();

        if (planSlug.includes('month')) {
          expiresAt.setMonth(expiresAt.getMonth() + 1);
        } else if (planSlug.includes('year')) {
          expiresAt.setFullYear(expiresAt.getFullYear() + 1);
        }

        const { error: updateError } = await supabaseAdmin
          .from('user_subscriptions')
          .upsert({
            user_id: userId,
            plan_slug: planSlug,
            status: 'active',
            payfast_payment_id: paymentId,
            subscription_token: token || null,
            started_at: startedAt.toISOString(),
            expires_at: expiresAt.toISOString()
          });

        if (updateError) {
          console.error('Error activating subscription:', updateError);
        }

        console.log('Subscription activated for user:', userId, 'Expires:', expiresAt, 'Token:', token ? 'Yes' : 'No');
      }
    } else if (paymentStatus === 'FAILED' || paymentStatus === 'CANCELLED') {
      // Only cancel if this notification matches the subscription's own payment ID —
      // guards against a stale/unrelated notification downgrading an active plan.
      const { error: updateError } = await supabaseAdmin
        .from('user_subscriptions')
        .update({
          status: 'cancelled',
          plan_slug: 'free',
          payfast_payment_id: null,
          subscription_token: null,
          expires_at: null
        })
        .eq('user_id', userId)
        .eq('payfast_payment_id', paymentId);

      if (updateError) {
        console.error('Error cancelling subscription:', updateError);
      }

      console.log('Subscription cancelled and downgraded to free for user:', userId);
    }

    return new Response('OK');

  } catch (error: any) {
    console.error('PayFast webhook error:', error);
    return new Response('Error processing webhook', { status: 500 });
  }
}

// JavaScript's encodeURIComponent and PHP's urlencode (what PayFast's backend
// uses) do not escape the same characters — encodeURIComponent leaves
// !, ', (, ), *, and ~ un-encoded, but PHP's urlencode escapes all of them.
// This replicates urlencode exactly so signatures match PayFast's recalculation.
function phpUrlEncode(str: string): string {
  return encodeURIComponent(str)
    .replace(/!/g, '%21')
    .replace(/'/g, '%27')
    .replace(/\(/g, '%28')
    .replace(/\)/g, '%29')
    .replace(/\*/g, '%2A')
    .replace(/~/g, '%7E')
    .replace(/%20/g, '+');
}

function generateSignature(data: any): string {
  // Create a copy and remove signature
  const dataCopy = { ...data };
  delete dataCopy.signature;

  // IMPORTANT: PayFast requires fields to be sorted alphabetically for signature
  // generation according to their official documentation.
  //
  // PayFast's own reference implementation SKIPS any field with a blank
  // value entirely (not just trims it) when computing the signature.
  const paramString = Object.keys(dataCopy)
    .filter((key) => String(dataCopy[key]).trim() !== '')
    .sort()
    .map(key => `${key}=${phpUrlEncode(String(dataCopy[key]).trim())}`)
    .join('&');

  console.log('Webhook signature calculation:', paramString);
  console.log('Webhook received signature:', data.signature);
  console.log('Webhook calculated signature:', crypto.createHash('md5').update(paramString).digest('hex'));

  // Generate MD5 signature
  return crypto.createHash('md5').update(paramString).digest('hex');
}