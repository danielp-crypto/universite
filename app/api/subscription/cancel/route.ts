import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

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

    // Get current subscription
    const { data: subscription } = await supabaseAdmin
      .from('user_subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (!subscription || subscription.status !== 'active') {
      return NextResponse.json({ error: 'No active subscription found' }, { status: 400 });
    }

    // Cancel subscription with PayFast if token exists
    if (subscription.subscription_token) {
      try {
        const payfastUrl = process.env.PAYFAST_SANDBOX === 'true'
          ? 'https://api.payfast.co.za/subscriptions/cancel'
          : 'https://api.payfast.co.za/subscriptions/cancel';

        const response = await fetch(payfastUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            token: subscription.subscription_token,
            merchant_id: process.env.PAYFAST_MERCHANT_ID,
            merchant_key: process.env.PAYFAST_MERCHANT_KEY,
          }),
        });

        if (!response.ok) {
          console.error('PayFast cancellation failed:', response.statusText);
          // Continue with local cancellation even if PayFast fails
        }
      } catch (error) {
        console.error('Error cancelling with PayFast:', error);
        // Continue with local cancellation even if PayFast fails
      }
    }

    // Update local subscription status
    const { error: updateError } = await supabaseAdmin
      .from('user_subscriptions')
      .update({
        status: 'cancelled',
        plan_slug: 'free',
        subscription_token: null,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', user.id);

    if (updateError) {
      console.error('Error cancelling subscription:', updateError);
      return NextResponse.json({ error: 'Failed to cancel subscription' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Subscription cancelled successfully'
    });

  } catch (error: any) {
    console.error('Subscription cancellation error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
