import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

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
      .from('weak_topics')
      .select('*')
      .eq('user_id', user.id)
      .order('mistake_count', { ascending: false });

    if (module_id) {
      query = query.eq('module_id', module_id);
    }

    const { data: weakTopics, error } = await query;

    if (error) {
      console.error('Error fetching weak topics:', error);
      return NextResponse.json({ error: 'Failed to fetch weak topics' }, { status: 500 });
    }

    const conceptWeakTopics = (weakTopics || []).filter(
      (weakTopic) => !/^review\s*:/i.test(weakTopic.topic || '')
    );

    return NextResponse.json({
      success: true,
      weak_topics: conceptWeakTopics
    });

  } catch (error: any) {
    console.error('Error in weak topics API:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
