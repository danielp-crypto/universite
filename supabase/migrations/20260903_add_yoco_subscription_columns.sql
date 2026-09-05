ALTER TABLE public.user_subscriptions
  ADD COLUMN IF NOT EXISTS yoco_payment_id text,
  ADD COLUMN IF NOT EXISTS yoco_checkout_id text;

CREATE INDEX IF NOT EXISTS idx_user_subscriptions_yoco_checkout_id
  ON public.user_subscriptions (yoco_checkout_id);

ALTER TABLE public.lectures
  ADD COLUMN IF NOT EXISTS slides_text text,
  ADD COLUMN IF NOT EXISTS slides_file_path text,
  ADD COLUMN IF NOT EXISTS slides_filename text;
