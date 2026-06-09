import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase/client';
import { getSession } from '@/lib/supabase/auth';

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'unauthorized' },
        { status: 401 }
      );
    }

    const lectureId = params.id;
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

    if (lecture.user_id !== session.user.id) {
      return NextResponse.json(
        { success: false, error: 'forbidden' },
        { status: 403 }
      );
    }

    // Update lecture
    const updateData: any = {};
    if (data.transcription !== undefined) updateData.transcription = data.transcription;
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
