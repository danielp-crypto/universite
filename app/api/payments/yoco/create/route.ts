import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createYocoCheckout } from '@/lib/yoco/api';

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

    // Calculate expiry date based on plan interval
    const expiresAt = new Date();
    if (plan.interval === 'month') {
      expiresAt.setMonth(expiresAt.getMonth() + 1);
    } else if (plan.interval === 'year') {
      expiresAt.setFullYear(expiresAt.getFullYear() + 1);
    }

    // Convert amount to cents (Yoco uses cents)
    const amountInCents = Math.round(Number(plan.price_zar) * 100);

    // Generate unique payment ID
    const paymentId = `YOCO-${Date.now()}-${user.id.slice(0, 8)}`;

    // Create Yoco checkout session
    const checkoutResult = await createYocoCheckout({
      amount: amountInCents,
      currency: 'ZAR',
      successUrl: `${NEXT_PUBLIC_APP_URL}/payment/success`,
      cancelUrl: `${NEXT_PUBLIC_APP_URL}/payment/cancelled`,
      metadata: {
        userId: user.id,
        planSlug: plan_slug,
        paymentId: paymentId,
      },
    });

    if (!checkoutResult.success) {
      console.error('Yoco checkout creation failed:', checkoutResult.error);
      return NextResponse.json(
        { error: 'Failed to create checkout session', details: checkoutResult.error },
        { status: 500 }
      );
    }

    // Store pending payment in database
    const { error: insertError } = await supabaseAdmin
      .from('user_subscriptions')
      .upsert({
        user_id: user.id,
        plan_slug: plan_slug,
        yoco_payment_id: paymentId,
        yoco_checkout_id: checkoutResult.id,
        status: 'pending',
        expires_at: expiresAt.toISOString()
      });

    if (insertError) {
      console.error('Error storing pending payment:', insertError);
    }

    return NextResponse.json({
      success: true,
      checkoutUrl: checkoutResult.checkoutUrl,
      paymentId,
      checkoutId: checkoutResult.id,
    });

  } catch (error: any) {
    console.error('Yoco payment creation error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

