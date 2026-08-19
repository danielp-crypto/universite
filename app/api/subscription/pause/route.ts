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

    if (!subscription.subscription_token) {
      return NextResponse.json({ error: 'No subscription token found - cannot pause' }, { status: 400 });
    }

    // Pause subscription with PayFast
    try {
      const payfastUrl = process.env.PAYFAST_SANDBOX === 'true'
        ? 'https://api.payfast.co.za/subscriptions/pause'
        : 'https://api.payfast.co.za/subscriptions/pause';

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
        const errorData = await response.json();
        console.error('PayFast pause failed:', errorData);
        return NextResponse.json({ error: 'Failed to pause subscription with PayFast' }, { status: 500 });
      }
    } catch (error) {
      console.error('Error pausing with PayFast:', error);
      return NextResponse.json({ error: 'Failed to pause subscription' }, { status: 500 });
    }

    // Update local subscription status
    const { error: updateError } = await supabaseAdmin
      .from('user_subscriptions')
      .update({
        status: 'paused',
        updated_at: new Date().toISOString()
      })
      .eq('user_id', user.id);

    if (updateError) {
      console.error('Error pausing subscription:', updateError);
      return NextResponse.json({ error: 'Failed to pause subscription' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Subscription paused successfully'
    });

  } catch (error: any) {
    console.error('Subscription pause error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
