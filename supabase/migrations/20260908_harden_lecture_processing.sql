-- Harden the lecture processing pipeline for MVP launch.
-- Safe to run against the existing lecture schema.

-- 1) Keep exactly one canonical transcription row per lecture.
--    Remove older duplicates first, keeping the newest row.
WITH ranked AS (
  SELECT id,
         row_number() OVER (
           PARTITION BY lecture_id
           ORDER BY created_at DESC NULLS LAST, id DESC
         ) AS rn
  FROM public.transcriptions
)
DELETE FROM public.transcriptions t
USING ranked r
WHERE t.id = r.id
  AND r.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS transcriptions_lecture_id_unique
  ON public.transcriptions(lecture_id);

-- 2) Make credit -> lecture a real UUID relationship.
--    The explicit validation makes bad legacy data fail loudly rather than
--    silently corrupting the relationship.
DO $$
DECLARE
  invalid_count integer;
BEGIN
  SELECT count(*)
  INTO invalid_count
  FROM public.credits
  WHERE lecture_id IS NOT NULL
    AND lecture_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$';

  IF invalid_count > 0 THEN
    RAISE EXCEPTION 'credits.lecture_id contains % non-UUID values; clean them before running this migration', invalid_count;
  END IF;
END $$;

ALTER TABLE public.credits
  ALTER COLUMN lecture_id TYPE uuid
  USING NULLIF(lecture_id, '')::uuid;

ALTER TABLE public.credits
  DROP CONSTRAINT IF EXISTS credits_lecture_id_fkey;

ALTER TABLE public.credits
  ADD CONSTRAINT credits_lecture_id_fkey
  FOREIGN KEY (lecture_id) REFERENCES public.lectures(id)
  ON DELETE CASCADE;

CREATE UNIQUE INDEX IF NOT EXISTS credits_lecture_id_unique
  ON public.credits(lecture_id);

-- 3) Track processing attempts and machine-readable failure reasons.
ALTER TABLE public.lectures
  ADD COLUMN IF NOT EXISTS processing_attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS processing_error_code text;

ALTER TABLE public.lectures
  DROP CONSTRAINT IF EXISTS lectures_processing_attempts_nonnegative;

ALTER TABLE public.lectures
  ADD CONSTRAINT lectures_processing_attempts_nonnegative
  CHECK (processing_attempts >= 0);

-- 4) Useful indexes for the dashboard, retries, and webhook diagnostics.
CREATE INDEX IF NOT EXISTS idx_lectures_user_created
  ON public.lectures(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_lectures_module
  ON public.lectures(module_id);

CREATE INDEX IF NOT EXISTS idx_lectures_processing
  ON public.lectures(status, transcription_status);

CREATE INDEX IF NOT EXISTS idx_segments_lecture
  ON public.lecture_segments(lecture_id);

CREATE INDEX IF NOT EXISTS idx_usage_events_user_created
  ON public.usage_events(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_deepgram_logs_lecture
  ON public.deepgram_webhook_logs(lecture_id, created_at DESC);
