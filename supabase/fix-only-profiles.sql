-- Fix for signup - only address profiles table since user_subscriptions doesn't exist in your schema
-- Run this in Supabase SQL Editor

-- 1. Drop the subscription trigger since user_subscriptions table doesn't exist
DROP TRIGGER IF EXISTS on_auth_user_created_subscription ON auth.users;
DROP FUNCTION IF EXISTS public.ensure_subscription();

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

-- 3. Recreate the profile trigger to ensure it works correctly
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
