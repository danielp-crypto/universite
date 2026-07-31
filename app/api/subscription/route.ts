import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cancelPayfastSubscription } from '@/lib/payfast/api';

export async function GET(request: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Missing Supabase config in subscription route');
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      console.error('Missing authorization header');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);

    if (userError || !user) {
      console.error('Invalid token:', userError);
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // Fetch user's subscription with plan details
    const { data: subscription, error } = await supabaseAdmin
      .from('user_subscriptions')
      .select('*, plans(*)')
      .eq('user_id', user.id)
      .single();

    if (error) {
      console.error('Supabase error fetching subscription:', error);
      // If no subscription found, return default free plan
      if (error.code === 'PGRST116') {
        const { data: freePlan } = await supabaseAdmin
          .from('plans')
          .select('*')
          .eq('plan_slug', 'free')
          .single();

        return NextResponse.json({
          plan_slug: 'free',
          status: 'active',
          expires_at: null,
          plans: freePlan
        });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // A row that isn't status: 'active' (pending, cancelled, or a failed
    // payment that never completed) must never be reported as a real
    // subscription — otherwise a click on "Subscribe" that never actually
    // completes payment leaves the user looking premium indefinitely, since
    // this table only ever holds one row per user_id.
    if (subscription.status !== 'active') {
      const { data: freePlan } = await supabaseAdmin
        .from('plans')
        .select('*')
        .eq('plan_slug', 'free')
        .single();

      return NextResponse.json({
        plan_slug: 'free',
        status: 'active',
        expires_at: null,
        plans: freePlan,
        pending_plan_slug: subscription.plan_slug, // surfaced in case the UI wants to show "payment pending"
      });
    }

    return NextResponse.json(subscription);
  } catch (error: any) {
    console.error('Error fetching subscription:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Missing Supabase config in subscription route');
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      console.error('Missing authorization header');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);

    if (userError || !user) {
      console.error('Invalid token:', userError);
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const body = await request.json();
    const { action } = body;

    if (action !== 'cancel') {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    // Look up the current subscription first — we need the PayFast token to
    // actually stop billing, not just the plan_slug.
    const { data: currentSub, error: fetchError } = await supabaseAdmin
      .from('user_subscriptions')
      .select('subscription_token, plan_slug')
      .eq('user_id', user.id)
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') {
      console.error('Error fetching subscription before cancel:', fetchError);
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    // Only call PayFast if there's actually a recurring token to cancel — a
    // free-plan user has nothing billing them, so there's nothing to stop.
    if (currentSub?.subscription_token) {
      const result = await cancelPayfastSubscription(currentSub.subscription_token);

      if (!result.ok) {
        console.error('Error cancelling subscription at PayFast:', result.error);
        // Do NOT downgrade the database if PayFast itself didn't confirm the
        // cancellation — otherwise the user thinks they're cancelled while
        // still being billed, with no token left on file to retry with.
        return NextResponse.json(
          {
            error: 'We could not confirm the cancellation with PayFast. Please try again, or contact support if this keeps happening.',
          },
          { status: 502 }
        );
      }
    }

    // Update subscription to free plan now that PayFast billing is actually stopped
    const { data: subscription, error } = await supabaseAdmin
      .from('user_subscriptions')
      .update({
        plan_slug: 'free',
        status: 'active',
        payfast_payment_id: null,
        subscription_token: null,
        expires_at: null,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', user.id)
      .select('*, plans(*)')
      .single();

    if (error) {
      console.error('Error cancelling subscription:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(subscription);
  } catch (error: any) {
    console.error('Error updating subscription:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}