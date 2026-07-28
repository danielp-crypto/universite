import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

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

    return NextResponse.json(subscription);
  } catch (error: any) {
    console.error('Error fetching subscription:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
