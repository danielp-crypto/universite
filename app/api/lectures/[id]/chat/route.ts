import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/client';

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

    const { id: lectureId } = await params;

    // Verify the lecture belongs to this user before returning any messages
    const { data: lecture, error: lectureError } = await supabaseAdmin
      .from('lectures')
      .select('id')
      .eq('id', lectureId)
      .eq('user_id', user.id)
      .single();

    if (lectureError || !lecture) {
      return NextResponse.json(
        { success: false, error: 'lecture_not_found' },
        { status: 404 }
      );
    }

    const { data: chatMessages, error } = await supabaseAdmin
      .from('chat_messages')
      .select('sender, content, created_at')
      .eq('lecture_id', lectureId)
      .eq('user_id', user.id)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Supabase fetch error:', error);
      return NextResponse.json(
        { success: false, error: 'fetch_failed' },
        { status: 500 }
      );
    }

    const formattedMessages = (chatMessages || []).map((msg: any) => ({
      sender: msg.sender,
      content: msg.content,
      timestamp: new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    }));

    return NextResponse.json({ success: true, messages: formattedMessages });

  } catch (error) {
    console.error('Get chat history error:', error);
    return NextResponse.json(
      { success: false, error: 'server_error' },
      { status: 500 }
    );
  }
}