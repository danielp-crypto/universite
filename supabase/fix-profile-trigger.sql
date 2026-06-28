-- Fix for profile creation trigger during signup
-- The profiles table needs an INSERT policy to allow the trigger to create new profiles

-- Add insert policy for profiles table
DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
CREATE POLICY "profiles_insert_own"
ON public.profiles FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Also add a policy to allow service role (for the trigger)
DROP POLICY IF EXISTS "profiles_insert_service_role" ON public.profiles;
CREATE POLICY "profiles_insert_service_role"
ON public.profiles FOR INSERT
TO service_role
WITH CHECK (true);
