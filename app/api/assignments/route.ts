import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/client';
import { groq } from '@/lib/groq';

export const dynamic = 'force-dynamic';

const ANALYSIS_SYSTEM = `You are Universite Assignment Coach for university students, especially UNISA students.

Your job is to help a student understand and complete their OWN assignment. You must NOT write, draft, paraphrase, or complete the assignment for them.

When given an assignment brief, analyze it into practical guidance only:
- identify what the question is really asking;
- identify deliverables and constraints;
- identify command words such as discuss, compare, evaluate, analyze, critically discuss, calculate, or justify;
- identify concepts the student should understand;
- create a sequence of actions the student can follow;
- suggest questions the student should answer in their own words;
- identify common mistakes and checks they should make;
- suggest what evidence or course material they should look for.

Do not provide an essay, paragraphs that could be submitted, a completed solution, or fabricated sources/citations.

Return valid JSON with exactly these keys:
{
  "what_it_is_asking": ["..."],
  "deliverables": ["..."],
  "constraints": ["..."],
  "command_words": [{"word":"...","meaning":"..."}],
  "concepts_to_understand": ["..."],
  "action_plan": [{"step":1,"title":"...","task":"..."}],
  "questions_to_answer": ["..."],
  "common_mistakes": ["..."],
  "self_check": ["..."]
}`;

async function getUser(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.substring(7);
  const { data: { user } } = await supabaseAdmin.auth.getUser(token);
  return user || null;
}

export async function GET(request: NextRequest) {
  try {
    const user = await getUser(request);
    if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

    const { data, error } = await supabaseAdmin
      .from('assignments')
      .select('*')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false });

    if (error) throw error;
    return NextResponse.json({ assignments: data || [] });
  } catch (error) {
    console.error('Assignments GET error:', error);
    return NextResponse.json({ error: 'failed_to_load_assignments' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getUser(request);
    if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    if (!process.env.GROQ_API_KEY) return NextResponse.json({ error: 'missing_api_key' }, { status: 500 });

    const body = await request.json();
    const brief = typeof body.brief === 'string' ? body.brief.trim() : '';
    const title = typeof body.title === 'string' && body.title.trim() ? body.title.trim() : 'Untitled assignment';
    const moduleId = typeof body.module_id === 'string' && body.module_id ? body.module_id : null;

    if (brief.length < 20) {
      return NextResponse.json({ error: 'assignment_brief_too_short' }, { status: 400 });
    }
    if (brief.length > 30000) {
      return NextResponse.json({ error: 'assignment_brief_too_long' }, { status: 400 });
    }

    const completion = await groq.chat.completions.create({
      model: 'openai/gpt-oss-20b',
      messages: [
        { role: 'system', content: ANALYSIS_SYSTEM },
        { role: 'user', content: `Assignment brief:\n\n${brief}` },
      ],
      temperature: 0.2,
      max_tokens: 1800,
      response_format: { type: 'json_object' },
    });

    const raw = completion.choices[0]?.message?.content || '{}';
    let analysis: any;
    try {
      analysis = JSON.parse(raw);
    } catch {
      return NextResponse.json({ error: 'assignment_analysis_failed' }, { status: 502 });
    }

    const { data: assignment, error } = await supabaseAdmin
      .from('assignments')
      .insert({
        user_id: user.id,
        module_id: moduleId,
        title,
        brief,
        analysis,
      })
      .select('*')
      .single();

    if (error) throw error;
    return NextResponse.json({ assignment });
  } catch (error) {
    console.error('Assignments POST error:', error);
    return NextResponse.json({ error: 'failed_to_create_assignment' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const user = await getUser(request);
    if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

    const body = await request.json();
    const id = typeof body.id === 'string' ? body.id : '';
    if (!id) return NextResponse.json({ error: 'missing_assignment_id' }, { status: 400 });

    const updates: Record<string, any> = {};
    if (typeof body.student_work === 'string') updates.student_work = body.student_work;
    if (['in_progress', 'ready_to_submit', 'completed'].includes(body.status)) updates.status = body.status;
    if (typeof body.title === 'string' && body.title.trim()) updates.title = body.title.trim();

    const { data, error } = await supabaseAdmin
      .from('assignments')
      .update(updates)
      .eq('id', id)
      .eq('user_id', user.id)
      .select('*')
      .single();

    if (error) throw error;
    return NextResponse.json({ assignment: data });
  } catch (error) {
    console.error('Assignments PATCH error:', error);
    return NextResponse.json({ error: 'failed_to_update_assignment' }, { status: 500 });
  }
}
