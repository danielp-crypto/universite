import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/client';

// Pulls just the bolded term out of each "**Term**: Definition" line under
// "## Key Concepts". We deliberately do NOT split on '*' or '-' here — the
// definition text often contains hyphens, and splitting on '*' shreds the
// "**Term**" markers themselves, turning each definition sentence into a
// bogus extra "concept" (e.g. a stray "9" or "Switch" pulled from the first
// word of a definition instead of the actual term).
function parseKeyConcepts(summary: string | null | undefined): string[] {
  if (!summary) return [];

  const sectionMatch = summary.match(/##\s*Key Concepts[^\n]*\n([\s\S]*?)(?=\n##|$)/i);
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
    // Get token from Authorization header
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { success: false, error: 'unauthorized' },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);

    // Verify token with Supabase
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !user) {
      return NextResponse.json(
        { success: false, error: 'unauthorized' },
        { status: 401 }
      );
    }

    const { id: lectureId } = await params;

    // Fetch lecture and verify ownership with module information
    const { data: lecture, error: fetchError } = await supabaseAdmin
      .from('lectures')
      .select('*, modules(id, name, color)')
      .eq('id', lectureId)
      .eq('user_id', user.id)
      .single();

    if (fetchError || !lecture) {
      return NextResponse.json(
        { success: false, error: 'lecture_not_found' },
        { status: 404 }
      );
    }

    // Format duration for the lecture
    const durationSeconds = lecture.duration_seconds || 0;
    const minutes = Math.floor(durationSeconds / 60);
    const seconds = durationSeconds % 60;
    const duration = `${minutes}:${String(seconds).padStart(2, '0')}`;

    const formattedLecture = {
      ...lecture,
      duration,
      favorite: lecture.favorite || false,
      module: lecture.modules || null,
      keyConcepts: parseKeyConcepts(lecture.summary)
    };

    return NextResponse.json(formattedLecture);

  } catch (error) {
    console.error('Get lecture error:', error);
    return NextResponse.json(
      { success: false, error: 'server_error' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Get token from Authorization header
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { success: false, error: 'unauthorized' },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);

    // Verify token with Supabase
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !user) {
      return NextResponse.json(
        { success: false, error: 'unauthorized' },
        { status: 401 }
      );
    }

    const { id: lectureId } = await params;
    const data = await request.json();

    // Verify user owns the lecture
    const { data: lecture, error: fetchError } = await supabaseAdmin
      .from('lectures')
      .select('user_id')
      .eq('id', lectureId)
      .single();

    if (fetchError || !lecture) {
      return NextResponse.json(
        { success: false, error: 'lecture_not_found' },
        { status: 404 }
      );
    }

    if (lecture.user_id !== user.id) {
      return NextResponse.json(
        { success: false, error: 'forbidden' },
        { status: 403 }
      );
    }

    // Update lecture
    const updateData: any = {};
    if (data.transcription !== undefined) {
      updateData.transcription = data.transcription;
      updateData.transcription_status = 'completed';
      updateData.has_transcription = true;
      updateData.transcription_completed_at = new Date().toISOString();
    }
    if (data.summary !== undefined) updateData.summary = data.summary;
    if (data.title !== undefined) updateData.title = data.title;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.favorite !== undefined) updateData.favorite = data.favorite;
    if (data.module_id !== undefined) updateData.module_id = data.module_id;

    const { data: updatedLecture, error: updateError } = await supabaseAdmin
      .from('lectures')
      .update(updateData)
      .eq('id', lectureId)
      .select()
      .single();

    if (updateError) {
      throw updateError;
    }

    return NextResponse.json({
      success: true,
      lecture: updatedLecture
    });

  } catch (error) {
    console.error('Update lecture error:', error);
    return NextResponse.json(
      { success: false, error: 'update_failed' },
      { status: 500 }
    );
  }
}