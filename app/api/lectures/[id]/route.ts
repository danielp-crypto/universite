import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase/client';

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
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) {
      return NextResponse.json(
        { success: false, error: 'unauthorized' },
        { status: 401 }
      );
    }

    const { id: lectureId } = await params;
    const data = await request.json();

    // Verify user owns the lecture
    const { data: lecture, error: fetchError } = await supabase
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

    const { data: updatedLecture, error: updateError } = await supabase
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
