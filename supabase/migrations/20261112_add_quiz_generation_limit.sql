-- Track quiz generations per lecture for free tier limit
-- Free tier users: 1 quiz per lecture
-- Premium users: unlimited quizzes per lecture

-- Create table to track quiz generations
CREATE TABLE IF NOT EXISTS public.quiz_generations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lecture_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, lecture_id)
);

-- Enable RLS
ALTER TABLE public.quiz_generations ENABLE ROW LEVEL SECURITY;

-- Policy: users can only see their own quiz generations
CREATE POLICY "quiz_generations_select_own"
ON public.quiz_generations FOR SELECT
USING (auth.uid() = user_id);

-- Policy: users can insert their own quiz generations
CREATE POLICY "quiz_generations_insert_own"
ON public.quiz_generations FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Function to check if user can generate quiz for a lecture
CREATE OR REPLACE FUNCTION public.can_generate_quiz(p_lecture_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_plan public.plans%rowtype;
  v_existing_count int;
  v_can_generate boolean := false;
  v_message text := '';
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object(
      'can_generate', false,
      'message', 'Not authenticated'
    );
  END IF;

  -- Get user's plan
  SELECT p.*
  INTO v_plan
  FROM public.user_subscriptions s
  JOIN public.plans p ON p.plan_slug = s.plan_slug
  WHERE s.user_id = v_uid;

  IF NOT FOUND THEN
    -- Fallback to free plan
    SELECT * INTO v_plan FROM public.plans WHERE plan_slug = 'free';
  END IF;

  -- Check if user has premium plan (unlimited quizzes)
  IF v_plan.plan_slug IN ('premium', 'premium_monthly', 'pro') THEN
    v_can_generate := true;
    v_message := 'Unlimited quizzes available';
  ELSE
    -- Free tier: check if quiz already generated for this lecture
    SELECT COUNT(*)
    INTO v_existing_count
    FROM public.quiz_generations
    WHERE user_id = v_uid AND lecture_id = p_lecture_id;

    IF v_existing_count = 0 THEN
      v_can_generate := true;
      v_message := 'Quiz available for this lecture';
    ELSE
      v_can_generate := false;
      v_message := 'Free tier: Only 1 quiz per lecture. Upgrade for unlimited quizzes.';
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'can_generate', v_can_generate,
    'message', v_message,
    'plan_slug', v_plan.plan_slug
  );
END;
$$;

-- Function to record quiz generation
CREATE OR REPLACE FUNCTION public.record_quiz_generation(p_lecture_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Not authenticated');
  END IF;

  -- Insert quiz generation record (will fail if already exists due to UNIQUE constraint)
  INSERT INTO public.quiz_generations(user_id, lecture_id)
  VALUES (v_uid, p_lecture_id)
  ON CONFLICT (user_id, lecture_id) DO NOTHING;

  RETURN jsonb_build_object('ok', true, 'message', 'Quiz generation recorded');
END;
$$;
