import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/client';

const VALID_EVENT_TYPES = ['self_test', 'ai_chat'] as const;
type EventType = (typeof VALID_EVENT_TYPES)[number];

async function getAuthedUser(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { user: null, error: 'unauthorized' as const };
  }

  const token = authHeader.substring(7);
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) {
    return { user: null, error: 'unauthorized' as const };
  }

  return { user, error: null };
}

// GET /api/analytics/event?since=<ISO8601>
// Returns counts of self_test / ai_chat events since the given timestamp
// (defaults to 7 days ago) for the authenticated user.
export async function GET(request: NextRequest) {
  try {
    const { user, error: authError } = await getAuthedUser(request);
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'unauthorized' }, { status: 401 });
    }

    const sinceParam = request.nextUrl.searchParams.get('since');
    const since = sinceParam
      ? new Date(sinceParam)
      : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    if (isNaN(since.getTime())) {
      return NextResponse.json({ success: false, error: 'invalid_since' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('study_events')
      .select('event_type')
      .eq('user_id', user.id)
      .gte('created_at', since.toISOString());

    if (error) {
      console.error('study_events fetch error:', error);
      return NextResponse.json({ success: false, error: 'fetch_failed' }, { status: 500 });
    }

    const counts = { self_test: 0, ai_chat: 0 };
    for (const row of data || []) {
      if (row.event_type === 'self_test') counts.self_test += 1;
      else if (row.event_type === 'ai_chat') counts.ai_chat += 1;
    }

    return NextResponse.json({ success: true, counts });
  } catch (error) {
    console.error('Get study events error:', error);
    return NextResponse.json({ success: false, error: 'server_error' }, { status: 500 });
  }
}

// POST /api/analytics/event
// Body: { event_type: 'self_test' | 'ai_chat', metadata?: object }
export async function POST(request: NextRequest) {
  try {
    const { user, error: authError } = await getAuthedUser(request);
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { event_type, metadata } = body || {};

    if (!VALID_EVENT_TYPES.includes(event_type)) {
      return NextResponse.json({ success: false, error: 'invalid_event_type' }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from('study_events')
      .insert({
        user_id: user.id,
        event_type: event_type as EventType,
        metadata: metadata && typeof metadata === 'object' ? metadata : {},
      });

    if (error) {
      console.error('study_events insert error:', error);
      return NextResponse.json({ success: false, error: 'insert_failed' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Log study event error:', error);
    return NextResponse.json({ success: false, error: 'server_error' }, { status: 500 });
  }
}
