-- Restore balanced free tier system for transcript-focused app
-- Unlimited transcriptions, controlled AI usage

-- 1. Add new quota fields to plans table
ALTER TABLE public.plans
ADD COLUMN IF NOT EXISTS monthly_transcripts_unlimited BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS monthly_flashcard_generations INT DEFAULT 20,
ADD COLUMN IF NOT EXISTS monthly_ai_requests INT DEFAULT 50,
ADD COLUMN IF NOT EXISTS monthly_qa_generations INT DEFAULT 10,
ADD COLUMN IF NOT EXISTS monthly_summaries INT DEFAULT 5;

-- 2. Update free plan with balanced limits
UPDATE public.plans
SET
  -- Core value: unlimited transcriptions
  monthly_transcripts_unlimited = TRUE,
  -- Controlled AI features
  monthly_flashcard_generations = 10, -- Generous but limited
  monthly_ai_requests = 25,          -- Total AI budget
  monthly_qa_generations = 5,        -- Limited Q&A
  monthly_summaries = 2,             -- Limited summaries
  -- Legacy fields (effectively unlimited due to architecture)
  monthly_lecture_uploads = 999,
  monthly_transcription_minutes = 999
WHERE plan_slug = 'free';

-- 3. Update premium plans with higher limits
UPDATE public.plans
SET
  monthly_transcripts_unlimited = TRUE,
  monthly_flashcard_generations = 200,
  monthly_ai_requests = 1000,
  monthly_qa_generations = 100,
  monthly_summaries = 50,
  monthly_lecture_uploads = 999,
  monthly_transcription_minutes = 999
WHERE plan_slug IN ('premium', 'pro');

-- 4. Add new usage event actions
ALTER TABLE public.usage_events
DROP CONSTRAINT IF EXISTS usage_events_action_check;

ALTER TABLE public.usage_events
ADD CONSTRAINT usage_events_action_check
CHECK (action IN (
  'chat_messages',
  'flashcard_generations',
  'lecture_uploads',
  'lecture_transcriptions',
  'qa_generations',
  'summary_generations',
  'ai_requests'
));

-- 5. Create updated consume_quota function
CREATE OR REPLACE FUNCTION public.consume_quota(p_action text, p_amount int default 1)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_plan public.plans%rowtype;
  v_used int := 0;
  v_limit int := 0;
  v_remaining int := 0;
  v_unlimited boolean := false;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'invalid_amount';
  END IF;

  -- Get plan
  SELECT p.*
  INTO v_plan
  FROM public.user_subscriptions s
  JOIN public.plans p ON p.plan_slug = s.plan_slug
  WHERE s.user_id = v_uid;

  IF NOT FOUND THEN
    -- Fallback: treat as free
    SELECT * INTO v_plan FROM public.plans WHERE plan_slug = 'free';
  END IF;

  -- Handle unlimited transcriptions for free users
  IF p_action = 'lecture_transcriptions' AND v_plan.monthly_transcripts_unlimited = TRUE THEN
    INSERT INTO public.usage_events(user_id, action, amount)
    VALUES (v_uid, p_action, p_amount);

    RETURN jsonb_build_object(
      'ok', true,
      'action', p_action,
      'used', -1,
      'limit', -1,
      'remaining', -1
    );
  END IF;

  -- Get usage for current month
  SELECT COALESCE(SUM(amount), 0)::int
  INTO v_used
  FROM public.usage_events
  WHERE user_id = v_uid
    AND action = p_action
    AND created_at >= date_trunc('month', now());

  -- Set limits based on action
  CASE p_action
    WHEN 'flashcard_generations' THEN
      v_limit := v_plan.monthly_flashcard_generations;
    WHEN 'qa_generations' THEN
      v_limit := v_plan.monthly_qa_generations;
    WHEN 'summary_generations' THEN
      v_limit := v_plan.monthly_summaries;
    WHEN 'ai_requests' THEN
      v_limit := v_plan.monthly_ai_requests;
    WHEN 'chat_messages' THEN
      v_limit := v_plan.monthly_chat_messages;
    WHEN 'lecture_uploads' THEN
      v_limit := v_plan.monthly_lecture_uploads;
    WHEN 'lecture_transcriptions' THEN
      v_limit := v_plan.monthly_transcription_minutes;
    ELSE
      RAISE EXCEPTION 'invalid_action';
  END CASE;

  v_remaining := v_limit - v_used;

  IF v_remaining < p_amount THEN
    RETURN jsonb_build_object(
      'ok', false,
      'action', p_action,
      'used', v_used,
      'limit', v_limit,
      'remaining', GREATEST(v_remaining, 0),
      'message', CASE p_action
        WHEN 'flashcard_generations' THEN 'Flashcard generation limit reached. Upgrade for unlimited AI-powered study tools!'
        WHEN 'qa_generations' THEN 'Q&A generation limit reached. Upgrade for unlimited contextual questions!'
        WHEN 'summary_generations' THEN 'Summary generation limit reached. Upgrade for unlimited lecture insights!'
        WHEN 'ai_requests' THEN 'AI usage limit reached. Upgrade for unlimited AI features!'
        ELSE 'Usage limit reached. Upgrade for more!'
      END
    );
  END IF;

  -- Record usage
  INSERT INTO public.usage_events(user_id, action, amount)
  VALUES (v_uid, p_action, p_amount);

  RETURN jsonb_build_object(
    'ok', true,
    'action', p_action,
    'used', v_used + p_amount,
    'limit', v_limit,
    'remaining', (v_limit - (v_used + p_amount))
  );
END;
$$;

-- 6. Create quota status function for UI
CREATE OR REPLACE FUNCTION public.get_quota_status(p_user_id uuid DEFAULT auth.uid())
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_plan public.plans%rowtype;
  v_result jsonb := '{}';
  v_used int;
BEGIN
  -- Get plan
  SELECT p.*
  INTO v_plan
  FROM public.user_subscriptions s
  JOIN public.plans p ON p.plan_slug = s.plan_slug
  WHERE s.user_id = p_user_id;

  IF NOT FOUND THEN
    SELECT * INTO v_plan FROM public.plans WHERE plan_slug = 'free';
  END IF;

  -- Build quota status for each action
  FOREACH action IN ARRAY ARRAY[
    'flashcard_generations',
    'qa_generations',
    'summary_generations',
    'ai_requests',
    'lecture_transcriptions'
  ] LOOP
    -- Get usage for current month
    SELECT COALESCE(SUM(amount), 0)::int
    INTO v_used
    FROM public.usage_events
    WHERE user_id = p_user_id
      AND action = action
      AND created_at >= date_trunc('month', now());

    -- Add to result
    v_result := v_result || jsonb_build_object(
      action, jsonb_build_object(
        'used', v_used,
        'limit', CASE action
          WHEN 'flashcard_generations' THEN v_plan.monthly_flashcard_generations
          WHEN 'qa_generations' THEN v_plan.monthly_qa_generations
          WHEN 'summary_generations' THEN v_plan.monthly_summaries
          WHEN 'ai_requests' THEN v_plan.monthly_ai_requests
          WHEN 'lecture_transcriptions' THEN CASE WHEN v_plan.monthly_transcripts_unlimited THEN -1 ELSE v_plan.monthly_transcription_minutes END
          ELSE 0
        END,
        'unlimited', CASE action
          WHEN 'lecture_transcriptions' THEN v_plan.monthly_transcripts_unlimited
          ELSE FALSE
        END
      )
    );
  END LOOP;

  RETURN v_result;
END;
$$;
