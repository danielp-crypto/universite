-- Universite Assignment Coach
-- Run this once in Supabase SQL Editor.

create table if not exists public.assignments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  module_id uuid null,
  title text not null default 'Untitled assignment',
  brief text not null,
  analysis jsonb not null default '{}'::jsonb,
  student_work text not null default '',
  status text not null default 'in_progress' check (status in ('in_progress','ready_to_submit','completed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists assignments_user_id_idx on public.assignments(user_id);
create index if not exists assignments_module_id_idx on public.assignments(module_id);

create table if not exists public.assignment_messages (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.assignments(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('user','assistant')),
  mode text not null default 'coach',
  content text not null,
  created_at timestamptz not null default now()
);

create index if not exists assignment_messages_assignment_id_idx on public.assignment_messages(assignment_id, created_at);

alter table public.assignments enable row level security;
alter table public.assignment_messages enable row level security;

drop policy if exists "Users can view their assignments" on public.assignments;
drop policy if exists "Users can create their assignments" on public.assignments;
drop policy if exists "Users can update their assignments" on public.assignments;
drop policy if exists "Users can delete their assignments" on public.assignments;

create policy "Users can view their assignments"
  on public.assignments for select
  using (auth.uid() = user_id);

create policy "Users can create their assignments"
  on public.assignments for insert
  with check (auth.uid() = user_id);

create policy "Users can update their assignments"
  on public.assignments for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete their assignments"
  on public.assignments for delete
  using (auth.uid() = user_id);

drop policy if exists "Users can view their assignment messages" on public.assignment_messages;
drop policy if exists "Users can create their assignment messages" on public.assignment_messages;

create policy "Users can view their assignment messages"
  on public.assignment_messages for select
  using (auth.uid() = user_id);

create policy "Users can create their assignment messages"
  on public.assignment_messages for insert
  with check (auth.uid() = user_id);

create or replace function public.set_assignments_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists assignments_updated_at on public.assignments;
create trigger assignments_updated_at
before update on public.assignments
for each row execute function public.set_assignments_updated_at();
