import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

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

    console.log('PayFast webhook received:', {
      paymentId,
      paymentStatus,
      userId,
      planSlug
    });

    if (paymentStatus === 'COMPLETE') {
      // Update subscription to active
      const { error: updateError } = await supabaseAdmin
        .from('user_subscriptions')
        .update({
          status: 'active',
          payfast_payment_id: paymentId,
          started_at: new Date().toISOString()
        })
        .eq('user_id', userId)
        .eq('plan_slug', planSlug);

      if (updateError) {
        console.error('Error updating subscription:', updateError);
      }

      console.log('Subscription activated for user:', userId);
    } else if (paymentStatus === 'FAILED' || paymentStatus === 'CANCELLED') {
      // Update subscription to cancelled
      const { error: updateError } = await supabaseAdmin
        .from('user_subscriptions')
        .update({
          status: 'cancelled'
        })
        .eq('user_id', userId)
        .eq('payfast_payment_id', paymentId);

      if (updateError) {
        console.error('Error updating subscription:', updateError);
      }

      console.log('Subscription cancelled for user:', userId);
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

  // Add passphrase if set
  if (PAYFAST_PASSPHRASE) {
    dataCopy.passphrase = PAYFAST_PASSPHRASE;
  }

  // IMPORTANT: PayFast requires fields hashed in the order they were received
  // in the POST body — NOT sorted alphabetically. Object.keys() here preserves
  // the order fields were inserted into `data` in the handler above, which
  // matches formData.entries() order (i.e. the order PayFast actually sent them).
  const paramString = Object.keys(dataCopy)
    .map(key => `${key}=${phpUrlEncode(String(dataCopy[key]).trim())}`)
    .join('&');

  // Generate MD5 signature
  return crypto.createHash('md5').update(paramString).digest('hex');
}