import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);

    if (userError || !user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const body = await request.json();
    const { type } = body;

    if (!type) {
      return NextResponse.json({ error: 'Missing notification type' }, { status: 400 });
    }

    // Get user's notification preferences
    const { data: preferences, error: prefError } = await supabaseAdmin
      .from('notification_preferences')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (prefError || !preferences) {
      return NextResponse.json({ error: 'Could not fetch preferences' }, { status: 500 });
    }

    let title = '';
    let message = '';
    let shouldSend = false;

    if (type === 'motivation' && preferences.daily_motivation) {
      // Get random motivation message
      const { data: motivationData, error: motivationError } = await supabaseAdmin.rpc('get_random_motivation', {
        p_category: 'daily'
      });

      if (!motivationError && motivationData) {
        title = 'Daily Motivation 💪';
        message = motivationData;
        shouldSend = true;
      }
    } else if (type === 'quiz_reminder' && preferences.quiz_reminders) {
      // Check if user needs quiz reminder
      const { data: needsReminder, error: reminderError } = await supabaseAdmin.rpc('needs_quiz_reminder', {
        p_user_id: user.id
      });

      if (!reminderError && needsReminder) {
        title = 'Time for a Quiz! 🎯';
        message = 'You have lectures waiting for a self-test. Take a quick quiz to reinforce your learning!';
        shouldSend = true;
      }
    } else if (type === 'weekly_summary' && preferences.weekly_summary) {
      // Get weekly stats (placeholder for now)
      title = 'Weekly Summary 📊';
      message = 'Great progress this week! Keep up the excellent work.';
      shouldSend = true;
    } else if (type === 'streak_reminder' && preferences.streak_reminders) {
      title = 'Keep the Streak Going! 🔥';
      message = "You're on a roll! Don't break your learning streak today.";
      shouldSend = true;
    }

    if (!shouldSend) {
      return NextResponse.json({ success: true, message: 'Notification not sent based on preferences' });
    }

    // Create notification
    const { data: notificationId, error: createError } = await supabaseAdmin.rpc('create_notification', {
      p_user_id: user.id,
      p_type: type,
      p_title: title,
      p_message: message,
      p_metadata: {}
    });

    if (createError) {
      return NextResponse.json({ error: createError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, notificationId, title, message });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
