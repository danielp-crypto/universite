import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase/client';

export async function GET(request: NextRequest) {
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
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'unauthorized' },
        { status: 401 }
      );
    }

    // Fetch lectures for the user
    const { data: lectures, error } = await supabase
      .from('lectures')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Supabase fetch error:', error);
      return NextResponse.json(
        { success: false, error: 'fetch_failed' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      lectures: lectures || []
    });

  } catch (error) {
    console.error('Get lectures error:', error);
    return NextResponse.json(
      { success: false, error: 'server_error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
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
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'unauthorized' },
        { status: 401 }
      );
    }

    const data = await request.json();
    const { title, duration, audioUrl, transcription, summary, stored_locally, local_audio_size } = data;

    console.log('Creating lecture with data:', { title, duration, stored_locally, local_audio_size, hasTranscription: !!transcription });

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
        user_id: user.id,
        title,
        description: '',
        duration_seconds: duration || 0,
        transcription: transcription || null,
        summary: summary || null,
        status: 'completed',
        tags: [],
        stored_locally: stored_locally || false,
        local_audio_size: local_audio_size || 0,
        transcription_status: transcription ? 'completed' : 'pending',
        has_transcription: !!transcription,
        transcription_completed_at: transcription ? new Date().toISOString() : null
      })
      .select()
      .single();

    if (error) {
      console.error('Supabase insert error:', error);
      console.error('Error details:', JSON.stringify(error, null, 2));
      return NextResponse.json(
        { success: false, error: 'supabase_error', details: error.message },
        { status: 500 }
      );
    }

    console.log('Lecture created successfully:', lecture.id);

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
