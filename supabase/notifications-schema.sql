-- Notification system schema for Universite
-- Includes notification preferences, notification history, and motivational messages

-- 1) Notification Preferences (user settings)
create table if not exists public.notification_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  daily_motivation boolean not null default true,
  quiz_reminders boolean not null default true,
  weekly_summary boolean not null default false,
  streak_reminders boolean not null default true,
  reminder_time time not null default '09:00:00'
);

-- Trigger for updated_at
drop trigger if exists trg_notification_preferences_updated_at on public.notification_preferences;
create trigger trg_notification_preferences_updated_at
before update on public.notification_preferences
for each row execute function public.set_updated_at();

-- Auto-create notification preferences for new users
create or replace function public.handle_new_user_notifications()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.notification_preferences(user_id)
  values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_notifications on auth.users;
create trigger on_auth_user_created_notifications
after insert on auth.users
for each row execute procedure public.handle_new_user_notifications();

-- RLS for notification_preferences
alter table public.notification_preferences enable row level security;

drop policy if exists "notification_preferences_select_own" on public.notification_preferences;
create policy "notification_preferences_select_own"
on public.notification_preferences for select
using (auth.uid() = user_id);

drop policy if exists "notification_preferences_update_own" on public.notification_preferences;
create policy "notification_preferences_update_own"
on public.notification_preferences for update
using (auth.uid() = user_id);

-- 2) Notifications (notification history)
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  type text not null check (type in ('motivation', 'quiz_reminder', 'weekly_summary', 'streak_reminder')),
  title text not null,
  message text not null,
  read boolean not null default false,
  read_at timestamptz,
  metadata jsonb
);

-- RLS for notifications
alter table public.notifications enable row level security;

drop policy if exists "notifications_select_own" on public.notifications;
create policy "notifications_select_own"
on public.notifications for select
using (auth.uid() = user_id);

drop policy if exists "notifications_update_own" on public.notifications;
create policy "notifications_update_own"
on public.notifications for update
using (auth.uid() = user_id);

-- Index for performance
create index if not exists idx_notifications_user_id on public.notifications(user_id);
create index if not exists idx_notifications_user_read on public.notifications(user_id, read);

-- 3) Motivation Messages (default messages)
create table if not exists public.motivation_messages (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  category text not null check (category in ('daily', 'study', 'exam', 'streak', 'achievement')),
  message text not null,
  is_active boolean not null default true
);

-- Insert default motivation messages
insert into public.motivation_messages (category, message) values
  ('daily', 'Every expert was once a beginner. Keep pushing forward!'),
  ('daily', 'Your future self will thank you for the effort you put in today.'),
  ('daily', 'Small progress is still progress. Celebrate every win!'),
  ('study', 'The best way to predict your future is to create it through your studies.'),
  ('study', 'Knowledge is power. Keep building your foundation.'),
  ('exam', 'You''ve prepared well. Trust in your hard work!'),
  ('exam', 'Stay calm, stay focused. You''ve got this!'),
  ('streak', 'Amazing consistency! Keep that streak going!'),
  ('streak', 'You''re on fire! Don''t break the momentum now.'),
  ('achievement', 'Congratulations on reaching this milestone!')
on conflict do nothing;

-- RLS for motivation_messages (read-only for authenticated users)
alter table public.motivation_messages enable row level security;

drop policy if exists "motivation_messages_select_all" on public.motivation_messages;
create policy "motivation_messages_select_all"
on public.motivation_messages for select
using (auth.role() = 'authenticated');

-- 4) Quiz Results (track quiz attempts)
create table if not exists public.quiz_results (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  lecture_id uuid not null,
  lecture_title text not null,
  score integer not null,
  total integer not null,
  completed_at timestamptz not null default now(),
  metadata jsonb
);

-- RLS for quiz_results
alter table public.quiz_results enable row level security;

drop policy if exists "quiz_results_select_own" on public.quiz_results;
create policy "quiz_results_select_own"
on public.quiz_results for select
using (auth.uid() = user_id);

drop policy if exists "quiz_results_insert_own" on public.quiz_results;
create policy "quiz_results_insert_own"
on public.quiz_results for insert
with check (auth.uid() = user_id);

-- Index for performance
create index if not exists idx_quiz_results_user_id on public.quiz_results(user_id);
create index if not exists idx_quiz_results_lecture_id on public.quiz_results(lecture_id);

-- 5) Helper Functions

-- Function to create a notification
create or replace function public.create_notification(
  p_user_id uuid,
  p_type text,
  p_title text,
  p_message text,
  p_metadata jsonb default '{}'
)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_notification_id uuid;
begin
  insert into public.notifications (user_id, type, title, message, metadata)
  values (p_user_id, p_type, p_title, p_message, p_metadata)
  returning id into v_notification_id;
  
  return v_notification_id;
end;
$$;

-- Function to mark notification as read
create or replace function public.mark_notification_read(p_notification_id uuid)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  update public.notifications
  set read = true, read_at = now()
  where id = p_notification_id and user_id = auth.uid();
  
  return found;
end;
$$;

-- Function to get random motivation message
create or replace function public.get_random_motivation(p_category text default null)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_message text;
begin
  if p_category is null then
    select message into v_message
    from public.motivation_messages
    where is_active = true
    order by random()
    limit 1;
  else
    select message into v_message
    from public.motivation_messages
    where category = p_category and is_active = true
    order by random()
    limit 1;
  end if;
  
  return v_message;
end;
$$;

-- Function to check if user needs quiz reminder (hasn't taken quiz in 24h)
create or replace function public.needs_quiz_reminder(p_user_id uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  v_last_quiz timestamptz;
  v_lecture_count integer;
  v_quizzed_lecture_count integer;
begin
  -- Check when user last took a quiz
  select max(completed_at) into v_last_quiz
  from public.quiz_results
  where user_id = p_user_id;
  
  -- Count total lectures for user
  select count(*) into v_lecture_count
  from public.lectures
  where user_id = p_user_id;
  
  -- Count lectures that have been quizzed
  select count(distinct lecture_id) into v_quizzed_lecture_count
  from public.quiz_results
  where user_id = p_user_id;
  
  -- Return true if: no quiz in 24h AND has lectures AND not all lectures quizzed
  return (v_last_quiz is null or v_last_quiz < now() - interval '24 hours')
    and v_lecture_count > 0
    and v_quizzed_lecture_count < v_lecture_count;
end;
$$;
