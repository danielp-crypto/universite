import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Force dynamic rendering for API routes with static export
export const dynamic = 'force-dynamic';

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

    const lectureId = request.nextUrl.searchParams.get('lectureId');
    if (!lectureId) {
      return NextResponse.json({ error: 'Missing lectureId parameter' }, { status: 400 });
    }

    // Call the can_generate_quiz function
    const { data, error } = await supabaseAdmin.rpc('can_generate_quiz', {
      p_lecture_id: lectureId
    });

    if (error) {
      console.error('Error checking quiz generation permission:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error in quiz-can-generate endpoint:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
