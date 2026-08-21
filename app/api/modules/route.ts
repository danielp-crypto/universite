import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/client';

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json(
        { success: false, error: 'unauthorized' },
        { status: 401 }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'unauthorized' },
        { status: 401 }
      );
    }

    // Fetch modules for the user
    const { data: modules, error } = await supabaseAdmin
      .from('modules')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    // Count global credits for the user (exclude free_tier_credit)
    const { data: globalCreditsData } = await supabaseAdmin
      .from('credits')
      .select('id')
      .eq('user_id', user.id)
      .neq('used_for', 'free_tier_credit');

    const globalCreditsUsed = globalCreditsData?.length || 0;
    const globalCreditsAllocated = 4; // Free tier gets 4 credits globally

    // Add global credit info to each module
    const modulesWithCredits = (modules || []).map(module => ({
      ...module,
      credits_allocated: globalCreditsAllocated,
      credits_used: globalCreditsUsed
    }));

    if (error) {
      console.error('Supabase fetch error:', error);
      return NextResponse.json(
        { success: false, error: 'fetch_failed' },
        { status: 500 }
      );
    }

    return NextResponse.json(modulesWithCredits || []);

  } catch (error) {
    console.error('Get modules error:', error);
    return NextResponse.json(
      { success: false, error: 'server_error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json(
        { success: false, error: 'unauthorized' },
        { status: 401 }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { name, description, color } = body;

    if (!name) {
      return NextResponse.json(
        { success: false, error: 'name_required' },
        { status: 400 }
      );
    }

    // Create module
    const { data: module, error } = await supabaseAdmin
      .from('modules')
      .insert({
        user_id: user.id,
        name,
        description: description || null,
        color: color || '#6366f1'
      })
      .select()
      .single();

    if (error) {
      console.error('Supabase insert error:', error);
      return NextResponse.json(
        { success: false, error: 'insert_failed' },
        { status: 500 }
      );
    }

    return NextResponse.json(module);

  } catch (error) {
    console.error('Create module error:', error);
    return NextResponse.json(
      { success: false, error: 'server_error' },
      { status: 500 }
    );
  }
}
