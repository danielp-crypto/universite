import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
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

    const { data: session, error } = await supabaseAdmin
      .from('exam_sessions')
      .select(`
        *,
        exam_questions (
          id,
          question,
          question_type,
          difficulty,
          options,
          correct_option,
          order_index
        ),
        student_answers (
          id,
          question_id,
          answer,
          score,
          feedback,
          is_correct
        )
      `)
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    if (error || !session) {
      return NextResponse.json({ error: 'Exam session not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      session
    });

  } catch (error: any) {
    console.error('Error fetching exam session:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
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
    const { status, score, readiness_score, correct_count } = body;

    const updateData: any = {};
    if (status) updateData.status = status;
    if (status === 'completed') updateData.submitted_at = new Date().toISOString();
    if (score !== undefined) updateData.score = score;
    if (readiness_score !== undefined) updateData.readiness_score = readiness_score;
    if (correct_count !== undefined) updateData.correct_count = correct_count;

    const { data: session, error } = await supabaseAdmin
      .from('exam_sessions')
      .update(updateData)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single();

    if (error) {
      console.error('Error updating exam session:', error);
      return NextResponse.json({ error: 'Failed to update exam session' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      session
    });

  } catch (error: any) {
    console.error('Error updating exam session:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
