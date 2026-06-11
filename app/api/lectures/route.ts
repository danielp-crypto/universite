import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/client';

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
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'unauthorized' },
        { status: 401 }
      );
    }

    // Fetch lectures for the user
    const { data: lectures, error } = await supabaseAdmin
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

    return NextResponse.json(lectures || []);

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
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'unauthorized' },
        { status: 401 }
      );
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const title = formData.get('title') as string;

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'file_required' },
        { status: 400 }
      );
    }

    // Validate file type
    const validTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (!validTypes.includes(file.type)) {
      return NextResponse.json(
        { success: false, error: 'Invalid file type. Please upload a PDF or Word document.' },
        { status: 400 }
      );
    }

    // Convert file to base64 for storage
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const base64 = buffer.toString('base64');

    // Create lecture in Supabase
    const { data: lecture, error } = await supabaseAdmin
      .from('lectures')
      .insert({
        user_id: user.id,
        title: title || file.name,
        description: '',
        duration_seconds: 0,
        transcription: null,
        summary: null,
        status: 'processing',
        tags: [],
        stored_locally: false,
        local_audio_size: 0,
        transcription_status: 'pending',
        has_transcription: false,
        transcription_completed_at: null,
        file_name: file.name,
        file_type: file.type,
        file_size: file.size,
        file_content: base64
      })
      .select()
      .single();

    if (error) {
      console.error('Supabase insert error:', error);
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
