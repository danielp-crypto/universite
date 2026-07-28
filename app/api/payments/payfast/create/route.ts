import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const PAYFAST_MERCHANT_ID = process.env.PAYFAST_MERCHANT_ID!;
const PAYFAST_MERCHANT_KEY = process.env.PAYFAST_MERCHANT_KEY!;
const PAYFAST_PASSPHRASE = process.env.PAYFAST_PASSPHRASE || '';
const NEXT_PUBLIC_APP_URL = process.env.NEXT_PUBLIC_APP_URL!;

export async function POST(request: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);

    if (userError || !user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const body = await request.json();
    const { plan_slug } = body;

    if (!plan_slug) {
      return NextResponse.json({ error: 'Plan slug is required' }, { status: 400 });
    }

    // Get plan details
    const { data: plan, error: planError } = await supabaseAdmin
      .from('plans')
      .select('*')
      .eq('plan_slug', plan_slug)
      .single();

    if (planError || !plan) {
      return NextResponse.json({ error: 'Plan not found' }, { status: 404 });
    }

    // Generate unique payment ID
    const paymentId = `PF-${Date.now()}-${user.id.slice(0, 8)}`;

    // Calculate expiry date based on plan interval
    const expiresAt = new Date();
    if (plan.interval === 'month') {
      expiresAt.setMonth(expiresAt.getMonth() + 1);
    } else if (plan.interval === 'year') {
      expiresAt.setFullYear(expiresAt.getFullYear() + 1);
    }

    // Build PayFast data
    const payfastData: any = {
      merchant_id: PAYFAST_MERCHANT_ID,
      merchant_key: PAYFAST_MERCHANT_KEY,
      return_url: `${NEXT_PUBLIC_APP_URL}/payment/success`,
      cancel_url: `${NEXT_PUBLIC_APP_URL}/payment/cancelled`,
      notify_url: `${NEXT_PUBLIC_APP_URL}/api/payments/payfast/webhook`,
      name_first: user.user_metadata?.first_name || 'User',
      name_last: user.user_metadata?.last_name || '',
      email_address: user.email,
      m_payment_id: paymentId,
      amount: plan.price_zar,
      item_name: `${plan.name} Subscription`,
      item_description: `Universite ${plan.name} subscription`,
      custom_int1: user.id,
      custom_str1: plan_slug,
    };

    // Add passphrase if set
    if (PAYFAST_PASSPHRASE) {
      payfastData.passphrase = PAYFAST_PASSPHRASE;
    }

    // Generate signature
    const signature = generateSignature(payfastData);
    payfastData.signature = signature;

    // Remove passphrase from data sent to PayFast (it's only used for signature)
    delete payfastData.passphrase;

    // Store pending payment in database
    const { error: insertError } = await supabaseAdmin
      .from('user_subscriptions')
      .upsert({
        user_id: user.id,
        plan_slug: plan_slug,
        payfast_payment_id: paymentId,
        status: 'pending',
        expires_at: expiresAt.toISOString()
      });

    if (insertError) {
      console.error('Error storing pending payment:', insertError);
    }

    // Return PayFast URL and data
    const payfastUrl = 'https://www.payfast.co.za/eng/process';
    
    return NextResponse.json({
      success: true,
      payfastUrl,
      paymentData: payfastData,
      paymentId
    });

  } catch (error: any) {
    console.error('PayFast payment creation error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

function generateSignature(data: any): string {
  // Sort parameters alphabetically
  const sortedKeys = Object.keys(data).sort();
  
  // Build parameter string
  const paramString = sortedKeys
    .map(key => {
      const value = data[key];
      // Replace spaces with +, URL encode
      return `${key}=${encodeURIComponent(value).replace(/%20/g, '+')}`;
    })
    .join('&');

  // Generate MD5 signature
  return crypto.createHash('md5').update(paramString).digest('hex');
}
