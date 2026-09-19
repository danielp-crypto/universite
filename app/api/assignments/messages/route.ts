import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/client';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

    const token = authHeader.substring(7);
    const { data: { user } } = await supabaseAdmin.auth.getUser(token);
    if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

    const assignmentId = new URL(request.url).searchParams.get('assignment_id');
    if (!assignmentId) return NextResponse.json({ error: 'missing_assignment_id' }, { status: 400 });

    const { data: assignment } = await supabaseAdmin
      .from('assignments')
      .select('id')
      .eq('id', assignmentId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (!assignment) return NextResponse.json({ error: 'assignment_not_found' }, { status: 404 });

    const { data, error } = await supabaseAdmin
      .from('assignment_messages')
      .select('id, role, mode, content, created_at')
      .eq('assignment_id', assignmentId)
      .eq('user_id', user.id)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return NextResponse.json({ messages: data || [] });
  } catch (error) {
    console.error('Assignment messages GET error:', error);
    return NextResponse.json({ error: 'failed_to_load_messages' }, { status: 500 });
  }
}
