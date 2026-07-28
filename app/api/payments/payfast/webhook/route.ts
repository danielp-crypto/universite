import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

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
      return NextResponse.text('Invalid signature', { status: 400 });
    }

    // Verify merchant ID
    if (data.merchant_id !== PAYFAST_MERCHANT_ID) {
      console.error('PayFast merchant ID mismatch');
      return NextResponse.text('Invalid merchant', { status: 400 });
    }

    const paymentStatus = data.payment_status;
    const paymentId = data.m_payment_id;
    const userId = data.custom_int1;
    const planSlug = data.custom_str1;

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

    return NextResponse.text('OK');

  } catch (error: any) {
    console.error('PayFast webhook error:', error);
    return NextResponse.text('Error processing webhook', { status: 500 });
  }
}

function generateSignature(data: any): string {
  // Create a copy and remove signature
  const dataCopy = { ...data };
  delete dataCopy.signature;

  // Add passphrase if set
  if (PAYFAST_PASSPHRASE) {
    dataCopy.passphrase = PAYFAST_PASSPHRASE;
  }

  // Sort parameters alphabetically
  const sortedKeys = Object.keys(dataCopy).sort();
  
  // Build parameter string
  const paramString = sortedKeys
    .map(key => {
      const value = dataCopy[key];
      // Replace spaces with +, URL encode
      return `${key}=${encodeURIComponent(value).replace(/%20/g, '+')}`;
    })
    .join('&');

  // Generate MD5 signature
  return crypto.createHash('md5').update(paramString).digest('hex');
}
