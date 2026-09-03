import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getYocoCheckoutStatus } from '@/lib/yoco/api';

export async function POST(request: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const body = await request.json();
    const { checkoutId } = body;

    if (!checkoutId) {
      return NextResponse.json({ error: 'Checkout ID is required' }, { status: 400 });
    }

    console.log('Verifying Yoco checkout:', checkoutId);

    // Get checkout status from Yoco
    const statusResult = await getYocoCheckoutStatus(checkoutId);

    if (!statusResult.success || !statusResult.checkout) {
      console.error('Failed to get checkout status:', statusResult.error);
      return NextResponse.json(
        { error: 'Failed to verify checkout', details: statusResult.error },
        { status: 500 }
      );
    }

    const checkout = statusResult.checkout;
    console.log('Checkout status:', checkout.status);

    // Check if payment was successful
    if (!['successful', 'succeeded', 'completed'].includes(checkout.status)) {
      return NextResponse.json({
        success: false,
        status: checkout.status,
        message: 'Payment not completed yet'
      });
    }

    // Extract metadata from checkout
    const metadata = checkout.metadata || {};
    const userId = metadata.userId;
    const planSlug = metadata.planSlug;
    const paymentId = metadata.paymentId;

    if (!userId || !planSlug) {
      console.error('Missing required metadata:', metadata);
      return NextResponse.json({ error: 'Missing required metadata' }, { status: 400 });
    }

    // Get current subscription
    const { data: currentSub } = await supabaseAdmin
      .from('user_subscriptions')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (currentSub && currentSub.status === 'active' && currentSub.plan_slug === planSlug) {
      // Recurring payment on the same plan — extend it
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
          yoco_payment_id: paymentId,
          yoco_checkout_id: checkoutId,
          started_at: startedAt.toISOString(),
          expires_at: expiresAt.toISOString()
        });

      if (updateError) {
        console.error('Error activating subscription:', updateError);
      }

      console.log('Subscription activated for user:', userId, 'Expires:', expiresAt);
    }

    return NextResponse.json({
      success: true,
      status: checkout.status,
      message: 'Payment verified and subscription activated'
    });

  } catch (error: any) {
    console.error('Payment verification error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
