import { NextRequest, NextResponse } from 'next/server';
import { createUserClient } from '@/lib/supabase/client';

// Force dynamic rendering for API routes with static export
export const dynamic = 'force-dynamic';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.substring(7);

    // can_generate_quiz works out who is asking with auth.uid(), so it has to
    // be called as the student, not with the service-role client. The service
    // role has no user attached: inside the database auth.uid() is NULL, and
    // the function answered "Not authenticated" for every student.
    const userClient = createUserClient(token);

    const { data: { user }, error: userError } = await userClient.auth.getUser(token);

    if (userError || !user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const lectureId = request.nextUrl.searchParams.get('lectureId');
    if (!lectureId) {
      return NextResponse.json({ error: 'Missing lectureId parameter' }, { status: 400 });
    }

    // The database function takes a uuid. Anything else would come back as a
    // confusing 500 from Postgres, so it is rejected here.
    if (!UUID_PATTERN.test(lectureId)) {
      return NextResponse.json({ error: 'Invalid lectureId parameter' }, { status: 400 });
    }

    const { data, error } = await userClient.rpc('can_generate_quiz', {
      p_lecture_id: lectureId
    });

    if (error) {
      console.error('Error checking quiz generation permission:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error: unknown) {
    console.error('Error in quiz-can-generate endpoint:', error);
    const message = error instanceof Error ? error.message : 'Unexpected error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
