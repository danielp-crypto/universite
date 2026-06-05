-- Add lecture_uploads quota support (run after schema.sql).
-- Free plan: 3 lecture uploads per month.

-- 1) Add column to plans
alter table public.plans
add column if not exists monthly_lecture_uploads int not null default 3;

-- 2) Allow 'lecture_uploads' in usage_events
alter table public.usage_events
drop constraint if exists usage_events_action_check;

alter table public.usage_events
add constraint usage_events_action_check
check (action in ('chat_messages', 'flashcard_generations', 'lecture_uploads'));

-- 3) Set limits for existing plans
update public.plans set monthly_lecture_uploads = 3 where plan_slug = 'free';
-- Example for a future plus plan:
-- update public.plans set monthly_lecture_uploads = 999 where plan_slug = 'plus';

-- 4) Update consume_quota to handle lecture_uploads
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

  select p.*
  into v_plan
  from public.user_subscriptions s
  join public.plans p on p.plan_slug = s.plan_slug
  where s.user_id = v_uid;

  if not found then
    select * into v_plan from public.plans where plan_slug = 'free';
  end if;

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
