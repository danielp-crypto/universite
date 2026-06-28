-- Fix for subscription creation trigger during signup
-- The user_subscriptions table needs an INSERT policy to allow the trigger to create subscriptions

-- Add insert policy for user_subscriptions table
DROP POLICY IF EXISTS "subs_insert_own" ON public.user_subscriptions;
CREATE POLICY "subs_insert_own"
ON public.user_subscriptions FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Also add a policy to allow service role (for the trigger)
DROP POLICY IF EXISTS "subs_insert_service_role" ON public.user_subscriptions;
CREATE POLICY "subs_insert_service_role"
ON public.user_subscriptions FOR INSERT
TO service_role
WITH CHECK (true);
