import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase/client';
import { getSession } from '@/lib/supabase/auth';

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'unauthorized' },
        { status: 401 }
      );
    }

    const data = await request.json();
    const { title, duration, audioUrl, transcription, summary } = data;

    if (!title) {
      return NextResponse.json(
        { success: false, error: 'title_required' },
        { status: 400 }
      );
    }

    // Create lecture in Supabase
    const { data: lecture, error } = await supabase
      .from('lectures')
      .insert({
        user_id: session.user.id,
        title,
        description: '',
        duration_seconds: duration || 0,
        transcription: transcription || null,
        summary: summary || null,
        status: 'completed',
        tags: []
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    return NextResponse.json({
      success: true,
      lecture
    });

  } catch (error) {
    console.error('Create lecture error:', error);
    return NextResponse.json(
      { success: false, error: 'create_failed' },
      { status: 500 }
    );
  }
}
