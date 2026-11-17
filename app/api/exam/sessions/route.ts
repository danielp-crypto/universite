import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Force dynamic rendering for API routes with static export
export const dynamic = 'force-dynamic';

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

    if (!module_id || duration_minutes === undefined || !questions_count) {
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

    // The module must belong to this student. Exams are limited per module,
    // and the question generator reads the module's lectures, so a module id
    // that is not theirs must never get as far as creating a session.
    const { data: ownedModule } = await supabaseAdmin
      .from('modules')
      .select('id')
      .eq('id', module_id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (!ownedModule) {
      return NextResponse.json({ error: 'Module not found' }, { status: 404 });
    }

    const { data: subscription } = await supabaseAdmin
      .from('user_subscriptions')
      .select('status, plan_slug')
      .eq('user_id', user.id)
      .maybeSingle();
    const isPremium = subscription?.status === 'active' && subscription.plan_slug !== 'free';

    // Free accounts get ONE exam per module. Any session that exists for the
    // module counts, whether it was finished or abandoned, because the
    // questions were generated either way. (A session whose question
    // generation failed is deleted again by /api/exam/questions/generate, so a
    // failure does not use up the exam.)
    const limitReached = (existingSessionId: string | null) =>
      NextResponse.json({
        error: 'Free accounts can generate one exam per module. Upgrade to Premium for unlimited exams.',
        code: 'FREE_EXAM_LIMIT_REACHED',
        existing_session_id: existingSessionId
      }, { status: 403 });

    const earliestExistingSession = async () => {
      const { data, error } = await supabaseAdmin
        .from('exam_sessions')
        .select('id')
        .eq('user_id', user.id)
        .eq('module_id', module_id)
        .order('created_at', { ascending: true })
        .order('id', { ascending: true })
        .limit(1)
        .maybeSingle();
      return { id: (data?.id as string | undefined) ?? null, error };
    };

    if (!isPremium) {
      const existing = await earliestExistingSession();

      if (existing.error) {
        console.error('Error checking free exam limit:', existing.error);
        return NextResponse.json({ error: 'Unable to check exam limit' }, { status: 500 });
      }

      if (existing.id) {
        return limitReached(existing.id);
      }
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
      return NextResponse.json({
        error: 'Failed to create exam session',
        details: sessionError.message,
        code: sessionError.code,
        hint: sessionError.hint,
      }, { status: 500 });
    }

    // Two requests sent at the same moment (a double-click, or someone
    // scripting the endpoint) can both pass the check above before either
    // session exists. So the new session is ranked against the student's other
    // sessions for this module, ordered by (created_at, id). Only the first
    // one is kept; any other is removed again and refused.
    if (!isPremium) {
      const [{ count: earlier, error: earlierError }, { count: sameInstantEarlierId, error: tieError }] = await Promise.all([
        supabaseAdmin
          .from('exam_sessions')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .eq('module_id', module_id)
          .lt('created_at', examSession.created_at),
        supabaseAdmin
          .from('exam_sessions')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .eq('module_id', module_id)
          .eq('created_at', examSession.created_at)
          .lt('id', examSession.id),
      ]);

      if (earlierError || tieError) {
        console.error('Error verifying free exam limit:', earlierError || tieError);
        await supabaseAdmin.from('exam_sessions').delete().eq('id', examSession.id);
        return NextResponse.json({ error: 'Unable to check exam limit' }, { status: 500 });
      }

      if ((earlier || 0) + (sameInstantEarlierId || 0) > 0) {
        await supabaseAdmin.from('exam_sessions').delete().eq('id', examSession.id);
        const existing = await earliestExistingSession();
        return limitReached(existing.id);
      }
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
