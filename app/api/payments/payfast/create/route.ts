import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

// PAYFAST_SANDBOX only controls which PayFast URL we hit — your merchant ID,
// key, and passphrase are always your own real credentials from env vars,
// whether you're pointed at the sandbox or live endpoint. There is no shared
// "generic" sandbox account to fall back to; every merchant (including test
// accounts) has their own actual credentials issued by PayFast.
const PAYFAST_SANDBOX_URL = 'https://sandbox.payfast.co.za/eng/process';
const PAYFAST_LIVE_URL = 'https://www.payfast.co.za/eng/process';

const PAYFAST_SANDBOX = process.env.PAYFAST_SANDBOX === 'true';
const PAYFAST_MERCHANT_ID = process.env.PAYFAST_MERCHANT_ID!;
const PAYFAST_MERCHANT_KEY = process.env.PAYFAST_MERCHANT_KEY!;
const PAYFAST_PASSPHRASE = process.env.PAYFAST_PASSPHRASE || '';
const NEXT_PUBLIC_APP_URL = process.env.NEXT_PUBLIC_SITE_URL!;

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
      amount: Number(plan.price_zar).toFixed(2),
      item_name: `${plan.name} Subscription`,
      item_description: `Universite ${plan.name} subscription`,
      custom_str1: user.id,
      custom_str2: plan_slug,
      email_confirmation: 1,
      confirmation_address: user.email,
      // TEMPORARILY DISABLED again for diagnostic purposes, now that merchant
      // credentials are correct — isolating whether recurring billing fields
      // require a setting enabled on the PayFast account.
      // subscription_type: 1, // 1 = recurring subscription
      // frequency: plan.interval === 'month' ? 3 : 6, // 3 = monthly, 6 = yearly
      // cycles: 0 // 0 = unlimited cycles
    };

    // Add passphrase for signature generation only — PayFast requires a signature
    // on every submission regardless of whether a passphrase is configured (if
    // none is set, the passphrase term is simply omitted from the hashed string,
    // but the signature field itself must still be present).
    if (PAYFAST_PASSPHRASE) {
      payfastData.passphrase = PAYFAST_PASSPHRASE;
    }

    const signature = generateSignature(payfastData);

    // Remove passphrase from data sent to PayFast (it's only used for signature)
    delete payfastData.passphrase;

    payfastData.signature = signature;

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
    const payfastUrl = PAYFAST_SANDBOX ? PAYFAST_SANDBOX_URL : PAYFAST_LIVE_URL;

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
  // IMPORTANT: PayFast requires fields to be hashed in the same order they are
  // submitted in the form — NOT sorted alphabetically. Object.keys() preserves
  // insertion order for string keys, which matches the order the hidden form
  // fields are rendered in on the frontend (see Object.entries(paymentData)).
  //
  // PayFast's own reference implementation also SKIPS any field with a blank
  // value entirely (not just trims it) — e.g. name_last='' for a user with no
  // last name on file must not appear in the hashed string at all.
  const paramString = Object.keys(data)
    .filter((key) => String(data[key]).trim() !== '')
    .map(key => `${key}=${phpUrlEncode(String(data[key]).trim())}`)
    .join('&');

  // Generate MD5 signature
  return crypto.createHash('md5').update(paramString).digest('hex');
}