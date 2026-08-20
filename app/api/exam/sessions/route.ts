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

    const body = await request.json();
    const { module_id, duration_minutes, questions_count } = body;

    if (!module_id || duration_minutes === undefined || duration_minutes === null || !questions_count) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Validate duration (allow 0 for practice questions without timer)
    if (duration_minutes !== 0 && ![15, 30, 60].includes(duration_minutes)) {
      return NextResponse.json({ error: 'Invalid duration. Must be 0, 15, 30, or 60 minutes' }, { status: 400 });
    }

    // Validate questions count
    if (![5, 10, 20].includes(questions_count)) {
      return NextResponse.json({ error: 'Invalid questions count. Must be 5, 10, or 20' }, { status: 400 });
    }

    // Create exam session
    const { data: examSession, error: sessionError } = await supabaseAdmin
      .from('exam_sessions')
      .insert({
        user_id: user.id,
        module_id,
        duration_minutes,
        questions_count,
        status: 'in_progress'
      })
      .select()
      .single();

    if (sessionError) {
      console.error('Error creating exam session:', sessionError);
      return NextResponse.json({ error: 'Failed to create exam session' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      exam_session: examSession
    });

  } catch (error: any) {
    console.error('Error in exam sessions API:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
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

    const { searchParams } = new URL(request.url);
    const module_id = searchParams.get('module_id');

    let query = supabaseAdmin
      .from('exam_sessions')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (module_id) {
      query = query.eq('module_id', module_id);
    }

    const { data: sessions, error } = await query;

    if (error) {
      console.error('Error fetching exam sessions:', error);
      return NextResponse.json({ error: 'Failed to fetch exam sessions' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      sessions
    });

  } catch (error: any) {
    console.error('Error in exam sessions API:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
