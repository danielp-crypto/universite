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

    // Fetch lectures for the user with module information
    const { data: lectures, error } = await supabaseAdmin
      .from('lectures')
      .select('*, modules(id, name, color)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Supabase fetch error:', error);
      return NextResponse.json(
        { success: false, error: 'fetch_failed' },
        { status: 500 }
      );
    }

    // Format duration and module information for each lecture
    const formattedLectures = (lectures || []).map((lecture: any) => {
      const durationSeconds = lecture.duration_seconds || 0;
      const minutes = Math.floor(durationSeconds / 60);
      const seconds = durationSeconds % 60;
      const duration = `${minutes}:${String(seconds).padStart(2, '0')}`;

      return {
        ...lecture,
        duration,
        favorite: lecture.favorite || false,
        module: lecture.modules || null,
        keyConcepts: parseKeyConcepts(lecture.summary)
      };
    });

    return NextResponse.json(formattedLectures);

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

    const data = await request.json();
    const { title, duration, audioUrl, transcription, summary, stored_locally, local_audio_size, module_id } = data;

    console.log('Creating lecture with data:', { title, duration, stored_locally, local_audio_size, hasTranscription: !!transcription });

    if (!title) {
      return NextResponse.json(
        { success: false, error: 'title_required' },
        { status: 400 }
      );
    }

    // Create lecture in Supabase
    const { data: lecture, error } = await supabaseAdmin
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
        transcription_completed_at: transcription ? new Date().toISOString() : null,
        module_id: module_id || null
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