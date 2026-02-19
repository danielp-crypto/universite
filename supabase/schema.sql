-- Supabase schema for Universite: profiles + plans/subscriptions + usage quotas.
-- Run this in Supabase SQL Editor (or via migrations).

-- 1) Profiles (user database)
create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  first_name text,
  last_name text,
  date_of_birth date,
  gender text,
  phone text,
  newsletter boolean not null default false
);

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

-- Auto-create profile row for new auth users
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles(user_id)
  values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

-- RLS for profiles
alter table public.profiles enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
on public.profiles for select
using (auth.uid() = user_id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
on public.profiles for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);


-- 2) Plans + subscription (simple, no payments yet)
create table if not exists public.plans (
  plan_slug text primary key,
  name text not null,
  monthly_chat_messages int not null,
  monthly_flashcard_generations int not null
);

create table if not exists public.user_subscriptions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  plan_slug text not null references public.plans(plan_slug),
  started_at timestamptz not null default now()
);

alter table public.user_subscriptions enable row level security;

drop policy if exists "subs_select_own" on public.user_subscriptions;
create policy "subs_select_own"
on public.user_subscriptions for select
using (auth.uid() = user_id);

-- Seed a default free plan (adjust to taste)
insert into public.plans(plan_slug, name, monthly_chat_messages, monthly_flashcard_generations)
values ('free', 'Free', 200, 30)
on conflict (plan_slug) do update
set name = excluded.name,
    monthly_chat_messages = excluded.monthly_chat_messages,
    monthly_flashcard_generations = excluded.monthly_flashcard_generations;

-- Ensure every user has a subscription row (defaults to free)
create or replace function public.ensure_subscription()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.user_subscriptions(user_id, plan_slug)
  values (new.id, 'free')
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_subscription on auth.users;
create trigger on_auth_user_created_subscription
after insert on auth.users
for each row execute procedure public.ensure_subscription();


-- 3) Usage events + quota consumption
create table if not exists public.usage_events (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  action text not null check (action in ('chat_messages', 'flashcard_generations')),
  amount int not null default 1 check (amount > 0),
  created_at timestamptz not null default now()
);

alter table public.usage_events enable row level security;

drop policy if exists "usage_select_own" on public.usage_events;
create policy "usage_select_own"
on public.usage_events for select
using (auth.uid() = user_id);

drop policy if exists "usage_insert_own" on public.usage_events;
create policy "usage_insert_own"
on public.usage_events for insert
with check (auth.uid() = user_id);

-- Helper view: current month usage by action
create or replace view public.usage_monthly as
select
  user_id,
  action,
  date_trunc('month', created_at) as month_start,
  sum(amount)::int as used
from public.usage_events
group by user_id, action, date_trunc('month', created_at);

-- RPC: consume quota atomically-ish (single transaction).
-- Call via PostgREST: POST /rest/v1/rpc/consume_quota with user JWT.
create or replace function public.consume_quota(p_action text, p_amount int default 1)
returns jsonb
language plpgsql
as $$
declare
  v_uid uuid := auth.uid();
  v_plan public.plans%rowtype;
  v_used int := 0;
  v_limit int := 0;
  v_remaining int := 0;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'invalid_amount';
  end if;

  -- Get plan
  select p.*
  into v_plan
  from public.user_subscriptions s
  join public.plans p on p.plan_slug = s.plan_slug
  where s.user_id = v_uid;

  if not found then
    -- Fallback: treat as free
    select * into v_plan from public.plans where plan_slug = 'free';
  end if;

  -- Compute usage in current month
  select coalesce(sum(amount), 0)::int
  into v_used
  from public.usage_events
  where user_id = v_uid
    and action = p_action
    and created_at >= date_trunc('month', now());

  if p_action = 'chat_messages' then
    v_limit := v_plan.monthly_chat_messages;
  elsif p_action = 'flashcard_generations' then
    v_limit := v_plan.monthly_flashcard_generations;
  else
    raise exception 'invalid_action';
  end if;

  v_remaining := v_limit - v_used;
  if v_remaining < p_amount then
    return jsonb_build_object(
      'ok', false,
      'action', p_action,
      'used', v_used,
      'limit', v_limit,
      'remaining', greatest(v_remaining, 0)
    );
  end if;

  insert into public.usage_events(user_id, action, amount)
  values (v_uid, p_action, p_amount);

  return jsonb_build_object(
    'ok', true,
    'action', p_action,
    'used', v_used + p_amount,
    'limit', v_limit,
    'remaining', (v_limit - (v_used + p_amount))
  );
end;
$$;


-- 4) Lecture metadata and storage
create table if not exists public.lectures (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text,
  duration_seconds int,
  file_path text, -- Supabase Storage path
  file_size bigint,
  mime_type text,
  transcription text,
  summary text,
  status text not null default 'processing' check (status in ('processing', 'completed', 'failed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  favorite boolean default false,
  tags text[] default '{}'
);

alter table public.lectures enable row level security;

drop policy if exists "lectures_select_own" on public.lectures;
create policy "lectures_select_own"
on public.lectures for select
using (auth.uid() = user_id);

drop policy if exists "lectures_insert_own" on public.lectures;
create policy "lectures_insert_own"
on public.lectures for insert
with check (auth.uid() = user_id);

drop policy if exists "lectures_update_own" on public.lectures;
create policy "lectures_update_own"
on public.lectures for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "lectures_delete_own" on public.lectures;
create policy "lectures_delete_own"
on public.lectures for delete
using (auth.uid() = user_id);

-- Trigger for updated_at
drop trigger if exists trg_lectures_updated_at on public.lectures;
create trigger trg_lectures_updated_at
before update on public.lectures
for each row execute function public.set_updated_at();

-- Lecture segments for better organization
create table if not exists public.lecture_segments (
  id uuid primary key default gen_random_uuid(),
  lecture_id uuid not null references public.lectures(id) on delete cascade,
  start_time_seconds int not null,
  end_time_seconds int not null,
  title text,
  content text,
  key_concepts text[] default '{}',
  created_at timestamptz not null default now()
);

alter table public.lecture_segments enable row level security;

drop policy if exists "segments_select_own" on public.lecture_segments;
create policy "segments_select_own"
on public.lecture_segments for select
using (auth.uid() = (select user_id from public.lectures where id = lecture_id));

drop policy if exists "segments_insert_own" on public.lecture_segments;
create policy "segments_insert_own"
on public.lecture_segments for insert
with check (auth.uid() = (select user_id from public.lectures where id = lecture_id));

drop policy if exists "segments_update_own" on public.lecture_segments;
create policy "segments_update_own"
on public.lecture_segments for update
using (auth.uid() = (select user_id from public.lectures where id = lecture_id))
with check (auth.uid() = (select user_id from public.lectures where id = lecture_id));

drop policy if exists "segments_delete_own" on public.lecture_segments;
create policy "segments_delete_own"
on public.lecture_segments for delete
using (auth.uid() = (select user_id from public.lectures where id = lecture_id));

-- Lecture view with aggregated data
create or replace view public.lectures_with_stats as
select 
  l.*,
  count(ls.id) as segment_count,
  array_agg(distinct unnest(ls.key_concepts)) filter (where ls.key_concepts is not null) as all_concepts,
  case 
    when l.transcription is not null and l.transcription != '' then 
      array_length(regexp_split_to_array(l.transcription, '\s'), 1)
    else 0 
  end as word_count
from public.lectures l
left join public.lecture_segments ls on l.id = ls.lecture_id
group by l.id, l.user_id, l.title, l.description, l.duration_seconds, l.file_path, 
         l.file_size, l.mime_type, l.transcription, l.summary, l.status, 
         l.created_at, l.updated_at, l.favorite, l.tags;

-- Usage quota for lecture uploads
alter table public.usage_events add constraint usage_events_action_check 
  check (action in ('chat_messages', 'flashcard_generations', 'lecture_uploads', 'lecture_transcriptions'));

-- Update plans to include lecture quotas
alter table public.plans add column if not exists monthly_lecture_uploads int default 10;
alter table public.plans add column if not exists monthly_transcription_minutes int default 60;

-- Update existing free plan
update public.plans 
set monthly_lecture_uploads = 10, monthly_transcription_minutes = 60
where plan_slug = 'free';

-- Update consume_quota function to handle lecture actions
create or replace function public.consume_quota(p_action text, p_amount int default 1)
returns jsonb
language plpgsql
as $$
declare
  v_uid uuid := auth.uid();
  v_plan public.plans%rowtype;
  v_used int := 0;
  v_limit int := 0;
  v_remaining int := 0;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'invalid_amount';
  end if;

  -- Get plan
  select p.*
  into v_plan
  from public.user_subscriptions s
  join public.plans p on p.plan_slug = s.plan_slug
  where s.user_id = v_uid;

  if not found then
    -- Fallback: treat as free
    select * into v_plan from public.plans where plan_slug = 'free';
  end if;

  -- Compute usage in current month
  select coalesce(sum(amount), 0)::int
  into v_used
  from public.usage_events
  where user_id = v_uid
    and action = p_action
    and created_at >= date_trunc('month', now());

  if p_action = 'chat_messages' then
    v_limit := v_plan.monthly_chat_messages;
  elsif p_action = 'flashcard_generations' then
    v_limit := v_plan.monthly_flashcard_generations;
  elsif p_action = 'lecture_uploads' then
    v_limit := v_plan.monthly_lecture_uploads;
  elsif p_action = 'lecture_transcriptions' then
    v_limit := v_plan.monthly_transcription_minutes;
  else
    raise exception 'invalid_action';
  end if;

  v_remaining := v_limit - v_used;
  if v_remaining < p_amount then
    return jsonb_build_object(
      'ok', false,
      'action', p_action,
      'used', v_used,
      'limit', v_limit,
      'remaining', greatest(v_remaining, 0)
    );
  end if;

  insert into public.usage_events(user_id, action, amount)
  values (v_uid, p_action, p_amount);

  return jsonb_build_object(
    'ok', true,
    'action', p_action,
    'used', v_used + p_amount,
    'limit', v_limit,
    'remaining', (v_limit - (v_used + p_amount))
  );
end;
$$;

