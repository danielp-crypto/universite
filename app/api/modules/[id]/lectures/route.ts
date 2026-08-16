import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/client';

// Pulls just the bolded term out of each "**Term**: Definition" line under
// "## Key Concepts". Mirrors the parser in app/api/lectures/route.ts and
// app/api/lectures/[id]/route.ts — kept in sync deliberately, see the
// negative-lookahead note there for why this can't just split on '*' or '#'.
function parseKeyConcepts(summary: string | null | undefined): string[] {
  if (!summary) return [];

  const sectionMatch = summary.match(/##\s*Key Concepts[^\n]*\n([\s\S]*?)(?=\n##(?!#)|$)/i);
  if (!sectionMatch) return [];

  const termMatches = [...sectionMatch[1].matchAll(/\*\*([^*]+)\*\*/g)];
  return termMatches
    .map((m) => m[1].trim())
    .filter(Boolean);
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { success: false, error: 'unauthorized' },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'unauthorized' },
        { status: 401 }
      );
    }

    const { id: moduleId } = await params;

    // Verify the module belongs to this user before returning any lectures in it
    const { data: moduleRow, error: moduleError } = await supabaseAdmin
      .from('modules')
      .select('id, name, color')
      .eq('id', moduleId)
      .eq('user_id', user.id)
      .single();

    if (moduleError || !moduleRow) {
      return NextResponse.json(
        { success: false, error: 'module_not_found' },
        { status: 404 }
      );
    }

    const { data: lectures, error: lecturesError } = await supabaseAdmin
      .from('lectures')
      .select('id, title, description, duration_seconds, transcription, summary, slides_text, created_at')
      .eq('user_id', user.id)
      .eq('module_id', moduleId)
      .order('created_at', { ascending: true });

    if (lecturesError) {
      console.error('Supabase fetch error:', lecturesError);
      return NextResponse.json(
        { success: false, error: 'fetch_failed' },
        { status: 500 }
      );
    }

    const formattedLectures = (lectures || []).map((lecture: any) => {
      const durationSeconds = lecture.duration_seconds || 0;
      const minutes = Math.floor(durationSeconds / 60);
      const seconds = durationSeconds % 60;

      return {
        id: lecture.id,
        title: lecture.title,
        date: lecture.created_at,
        duration: `${minutes}:${String(seconds).padStart(2, '0')}`,
        transcription: lecture.transcription,
        summary: lecture.summary,
        slides_text: lecture.slides_text,
        keyConcepts: parseKeyConcepts(lecture.summary),
      };
    });

    return NextResponse.json({
      module: moduleRow,
      lectures: formattedLectures,
    });

  } catch (error) {
    console.error('Get module lectures error:', error);
    return NextResponse.json(
      { success: false, error: 'server_error' },
      { status: 500 }
    );
  }
}