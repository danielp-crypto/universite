ALTER TABLE public.user_subscriptions
  ADD COLUMN IF NOT EXISTS yoco_payment_id text,
  ADD COLUMN IF NOT EXISTS yoco_checkout_id text;

CREATE INDEX IF NOT EXISTS idx_user_subscriptions_yoco_checkout_id
  ON public.user_subscriptions (yoco_checkout_id);
