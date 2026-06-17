-- Modules schema for organizing lectures
-- Run this in Supabase SQL Editor (or via migrations)

-- 1) Modules table
create table if not exists public.modules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text,
  color text default '#6366f1', -- Default indigo color
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.modules enable row level security;

drop policy if exists "modules_select_own" on public.modules;
create policy "modules_select_own"
on public.modules for select
using (auth.uid() = user_id);

drop policy if exists "modules_insert_own" on public.modules;
create policy "modules_insert_own"
on public.modules for insert
with check (auth.uid() = user_id);

drop policy if exists "modules_update_own" on public.modules;
create policy "modules_update_own"
on public.modules for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "modules_delete_own" on public.modules;
create policy "modules_delete_own"
on public.modules for delete
using (auth.uid() = user_id);

-- Trigger for updated_at
drop trigger if exists trg_modules_updated_at on public.modules;
create trigger trg_modules_updated_at
before update on public.modules
for each row execute function public.set_updated_at();

-- 2) Add module_id to lectures table
alter table public.lectures add column if not exists module_id uuid references public.modules(id) on delete set null;

-- 3) Create view for lectures with module info
create or replace view public.lectures_with_modules as
select 
  l.*,
  m.name as module_name,
  m.color as module_color
from public.lectures l
left join public.modules m on l.module_id = m.id;
