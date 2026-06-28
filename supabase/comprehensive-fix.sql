-- Comprehensive fix for signup triggers
-- Run this in Supabase SQL Editor to fix all trigger-related issues

-- 1. Fix profiles table structure to match current schema
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS university text,
ADD COLUMN IF NOT EXISTS major text,
ADD COLUMN IF NOT EXISTS year text,
ADD COLUMN IF NOT EXISTS study_time text,
ADD COLUMN IF NOT EXISTS learning_style text,
ADD COLUMN IF NOT EXISTS full_name text;

-- 2. Add insert policy for profiles table
DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
CREATE POLICY "profiles_insert_own"
ON public.profiles FOR INSERT
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "profiles_insert_service_role" ON public.profiles;
CREATE POLICY "profiles_insert_service_role"
ON public.profiles FOR INSERT
TO service_role
WITH CHECK (true);

-- 3. Add insert policy for user_subscriptions table
DROP POLICY IF EXISTS "subs_insert_own" ON public.user_subscriptions;
CREATE POLICY "subs_insert_own"
ON public.user_subscriptions FOR INSERT
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "subs_insert_service_role" ON public.user_subscriptions;
CREATE POLICY "subs_insert_service_role"
ON public.user_subscriptions FOR INSERT
TO service_role
WITH CHECK (true);

-- 4. Recreate the profile trigger to ensure it works correctly
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles(user_id)
  VALUES (new.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN new;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 5. Recreate the subscription trigger to ensure it works correctly
DROP TRIGGER IF EXISTS on_auth_user_created_subscription ON auth.users;
DROP FUNCTION IF EXISTS public.ensure_subscription();

CREATE OR REPLACE FUNCTION public.ensure_subscription()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.user_subscriptions(user_id, plan_slug)
  VALUES (new.id, 'free')
  ON CONFLICT (user_id) DO NOTHING;
  RETURN new;
END;
$$;

CREATE TRIGGER on_auth_user_created_subscription
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE PROCEDURE public.ensure_subscription();
