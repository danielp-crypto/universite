-- OPTIONAL. Not needed for the "Not authenticated" fix (that is a code change).
--
-- The quiz functions in the live database treat only 'premium', 'premium_monthly'
-- and 'pro' as paid plans, so a student on 'semester_monthly' was handled as Free
-- and limited to one quiz per lecture despite paying. This makes ANY active, unexpired
-- plan other than 'free' count as paid, so new plans work without editing this again.
--
-- It is otherwise identical to the functions currently live (uuid argument, lecture
-- ownership check, active + unexpired subscription, advisory lock). The older file
-- 20261112_add_quiz_generation_limit.sql is out of date (text argument) and should not
-- be re-run.

CREATE OR REPLACE FUNCTION public.can_generate_quiz(p_lecture_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_plan_slug text;
  v_exists boolean;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('can_generate', false, 'message', 'Not authenticated');
  END IF;

  IF p_lecture_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.lectures l
    WHERE l.id = p_lecture_id AND l.user_id = v_uid
  ) THEN
    RETURN jsonb_build_object('can_generate', false, 'message', 'Lecture not found');
  END IF;

  SELECT p.plan_slug INTO v_plan_slug
  FROM public.user_subscriptions s
  JOIN public.plans p ON p.plan_slug = s.plan_slug
  WHERE s.user_id = v_uid
    AND s.status = 'active'
    AND (s.expires_at IS NULL OR s.expires_at > now())
  LIMIT 1;

  v_plan_slug := COALESCE(v_plan_slug, 'free');

  IF v_plan_slug <> 'free' THEN
    RETURN jsonb_build_object(
      'can_generate', true,
      'message', 'Unlimited quizzes available',
      'plan_slug', v_plan_slug
    );
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.quiz_generations qg
    WHERE qg.user_id = v_uid AND qg.lecture_id = p_lecture_id
  ) INTO v_exists;

  RETURN jsonb_build_object(
    'can_generate', NOT v_exists,
    'message', CASE WHEN v_exists
      THEN 'Free tier: Only 1 quiz per lecture. Upgrade for unlimited quizzes.'
      ELSE 'Quiz available for this lecture'
    END,
    'plan_slug', v_plan_slug
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.record_quiz_generation(p_lecture_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_plan_slug text;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Not authenticated');
  END IF;

  IF p_lecture_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.lectures l
    WHERE l.id = p_lecture_id AND l.user_id = v_uid
  ) THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Lecture not found');
  END IF;

  SELECT p.plan_slug INTO v_plan_slug
  FROM public.user_subscriptions s
  JOIN public.plans p ON p.plan_slug = s.plan_slug
  WHERE s.user_id = v_uid
    AND s.status = 'active'
    AND (s.expires_at IS NULL OR s.expires_at > now())
  LIMIT 1;

  v_plan_slug := COALESCE(v_plan_slug, 'free');

  -- Serialize concurrent free-tier requests for this user and lecture.
  PERFORM pg_advisory_xact_lock(
    hashtextextended(v_uid::text || ':' || p_lecture_id::text, 0)
  );

  IF v_plan_slug = 'free'
     AND EXISTS (
       SELECT 1 FROM public.quiz_generations qg
       WHERE qg.user_id = v_uid AND qg.lecture_id = p_lecture_id
     ) THEN
    RETURN jsonb_build_object(
      'ok', false,
      'message', 'Free tier: Only 1 quiz per lecture. Upgrade for unlimited quizzes.',
      'plan_slug', v_plan_slug
    );
  END IF;

  INSERT INTO public.quiz_generations (user_id, lecture_id)
  VALUES (v_uid, p_lecture_id);

  RETURN jsonb_build_object(
    'ok', true,
    'message', 'Quiz generation recorded',
    'plan_slug', v_plan_slug
  );
END;
$function$;
