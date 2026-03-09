-- Schema updates to support full transcription functionality
-- Run these updates on your existing Supabase database

-- 1. Add transcription status fields to lectures table
ALTER TABLE public.lectures 
ADD COLUMN IF NOT EXISTS transcription_status TEXT DEFAULT 'pending' 
CHECK (transcription_status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
ADD COLUMN IF NOT EXISTS transcription_error TEXT,
ADD COLUMN IF NOT EXISTS transcription_started_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS transcription_completed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS transcription_failed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS stored_locally BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS local_audio_size BIGINT DEFAULT 0,
ADD COLUMN IF NOT EXISTS has_transcription BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS processing_status TEXT DEFAULT 'pending' 
CHECK (processing_status IN ('pending', 'processing', 'completed', 'failed')),
ADD COLUMN IF NOT EXISTS processing_error TEXT,
ADD COLUMN IF NOT EXISTS processed_segments JSONB,
ADD COLUMN IF NOT EXISTS summary JSONB,
ADD COLUMN IF NOT EXISTS flashcard_suggestions JSONB,
ADD COLUMN IF NOT EXISTS processed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS summary_generated_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS suggestions_generated_at TIMESTAMPTZ;

-- 2. Create trigger for lectures updated_at (if not exists)
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_lectures_updated_at ON public.lectures;
CREATE TRIGGER trg_lectures_updated_at
BEFORE UPDATE ON public.lectures
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3. Create trigger for transcriptions updated_at (if not exists)
DROP TRIGGER IF EXISTS trg_transcriptions_updated_at ON public.transcriptions;
CREATE TRIGGER trg_transcriptions_updated_at
BEFORE UPDATE ON public.transcriptions
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 4. Enable Row Level Security on transcriptions table
ALTER TABLE public.transcriptions ENABLE ROW LEVEL SECURITY;

-- 5. Create RLS policies for transcriptions
DROP POLICY IF EXISTS "transcriptions_select_own" ON public.transcriptions;
CREATE POLICY "transcriptions_select_own"
ON public.transcriptions FOR SELECT
USING (auth.uid() = (SELECT user_id FROM public.lectures WHERE id = lecture_id));

DROP POLICY IF EXISTS "transcriptions_insert_own" ON public.transcriptions;
CREATE POLICY "transcriptions_insert_own"
ON public.transcriptions FOR INSERT
WITH CHECK (auth.uid() = (SELECT user_id FROM public.lectures WHERE id = lecture_id));

DROP POLICY IF EXISTS "transcriptions_update_own" ON public.transcriptions;
CREATE POLICY "transcriptions_update_own"
ON public.transcriptions FOR UPDATE
USING (auth.uid() = (SELECT user_id FROM public.lectures WHERE id = lecture_id))
WITH CHECK (auth.uid() = (SELECT user_id FROM public.lectures WHERE id = lecture_id));

DROP POLICY IF EXISTS "transcriptions_delete_own" ON public.transcriptions;
CREATE POLICY "transcriptions_delete_own"
ON public.transcriptions FOR DELETE
USING (auth.uid() = (SELECT user_id FROM public.lectures WHERE id = lecture_id));

-- 6. Create enhanced lectures view with transcription stats
CREATE OR REPLACE VIEW public.lectures_with_stats AS
SELECT 
  l.*,
  COUNT(ls.id) AS segment_count,
  ARRAY_AGG(DISTINCT unnest(ls.key_concepts)) FILTER (WHERE ls.key_concepts IS NOT NULL) AS all_concepts,
  CASE 
    WHEN l.transcription IS NOT NULL AND l.transcription != '' THEN 
      ARRAY_LENGTH(REGEXP_SPLIT_TO_ARRAY(l.transcription, '\s'), 1)
    ELSE 0 
  END AS word_count,
  COALESCE(t.content, l.transcription) AS full_transcription,
  COALESCE(t.word_count, 
    CASE 
      WHEN l.transcription IS NOT NULL AND l.transcription != '' THEN 
        ARRAY_LENGTH(REGEXP_SPLIT_TO_ARRAY(l.transcription, '\s'), 1)
      ELSE 0 
    END
  ) AS transcription_word_count,
  t.model_used AS transcription_model,
  t.confidence_score AS transcription_confidence,
  t.processing_time_ms AS transcription_duration
FROM public.lectures l
LEFT JOIN public.lecture_segments ls ON l.id = ls.lecture_id
LEFT JOIN public.transcriptions t ON l.id = t.lecture_id
GROUP BY 
  l.id, l.user_id, l.title, l.description, l.duration_seconds, l.file_path, 
  l.file_size, l.mime_type, l.transcription, l.summary, l.status, 
  l.created_at, l.updated_at, l.favorite, l.tags, l.transcription_status,
  l.transcription_error, l.transcription_started_at, l.transcription_completed_at,
  l.transcription_failed_at, l.stored_locally, l.local_audio_size,
  l.has_transcription,
  t.content, t.word_count, t.processing_time_ms, t.model_used, t.language,
  t.confidence_score, t.created_at, t.updated_at;

-- 7. Create function to save transcription with metadata
CREATE OR REPLACE FUNCTION public.save_transcription_with_metadata(
  p_lecture_id UUID,
  p_content TEXT,
  p_processing_time_ms INTEGER DEFAULT NULL,
  p_model_used TEXT DEFAULT 'gemini-1.5-flash',
  p_language TEXT DEFAULT 'en',
  p_confidence_score NUMERIC DEFAULT NULL
)
RETURNS TABLE (
  success BOOLEAN,
  transcription_id UUID,
  error_message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_transcription_id UUID;
  v_word_count INTEGER;
BEGIN
  -- Calculate word count
  v_word_count := ARRAY_LENGTH(REGEXP_SPLIT_TO_ARRAY(p_content, '\s'), 1);
  
  -- Insert transcription
  INSERT INTO public.transcriptions (
    lecture_id, 
    content, 
    word_count,
    processing_time_ms,
    model_used,
    language,
    confidence_score
  ) VALUES (
    p_lecture_id,
    p_content,
    v_word_count,
    p_processing_time_ms,
    p_model_used,
    p_language,
    p_confidence_score
  ) RETURNING id INTO v_transcription_id;
  
  -- Update lecture with transcription reference
  UPDATE public.lectures 
  SET 
    transcription = p_content,
    transcription_status = 'completed',
    transcription_completed_at = now(),
    has_transcription = TRUE
  WHERE id = p_lecture_id;
  
  RETURN QUERY SELECT TRUE, v_transcription_id, NULL::TEXT;
  
EXCEPTION WHEN OTHERS THEN
  RETURN QUERY SELECT FALSE, NULL::UUID, SQLERRM;
END;
$$;

-- 8. Create function to update transcription status
CREATE OR REPLACE FUNCTION public.update_transcription_status(
  p_lecture_id UUID,
  p_status TEXT,
  p_error_message TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Validate status
  IF p_status NOT IN ('pending', 'processing', 'completed', 'failed', 'cancelled') THEN
    RAISE EXCEPTION 'Invalid transcription status: %', p_status;
  END IF;
  
  -- Update lecture transcription status
  UPDATE public.lectures 
  SET 
    transcription_status = p_status,
    transcription_error = p_error_message,
    transcription_started_at = CASE WHEN p_status = 'processing' THEN now() ELSE transcription_started_at END,
    transcription_completed_at = CASE WHEN p_status = 'completed' THEN now() ELSE transcription_completed_at END,
    transcription_failed_at = CASE WHEN p_status = 'failed' THEN now() ELSE transcription_failed_at END
  WHERE id = p_lecture_id;
  
  RETURN TRUE;
  
EXCEPTION WHEN OTHERS THEN
  RETURN FALSE;
END;
$$;

-- 9. Create function to get transcription statistics
CREATE OR REPLACE FUNCTION public.get_transcription_stats(
  p_user_id UUID DEFAULT NULL
)
RETURNS TABLE (
  total_lectures BIGINT,
  transcribed_lectures BIGINT,
  pending_transcriptions BIGINT,
  processing_transcriptions BIGINT,
  failed_transcriptions BIGINT,
  total_transcription_words BIGINT,
  average_processing_time_ms NUMERIC,
  most_used_model TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*)::BIGINT AS total_lectures,
    COUNT(CASE WHEN transcription_status = 'completed' THEN 1 END)::BIGINT AS transcribed_lectures,
    COUNT(CASE WHEN transcription_status = 'pending' THEN 1 END)::BIGINT AS pending_transcriptions,
    COUNT(CASE WHEN transcription_status = 'processing' THEN 1 END)::BIGINT AS processing_transcriptions,
    COUNT(CASE WHEN transcription_status = 'failed' THEN 1 END)::BIGINT AS failed_transcriptions,
    COALESCE(SUM(CASE WHEN t.word_count IS NOT NULL THEN t.word_count ELSE 0 END), 0)::BIGINT AS total_transcription_words,
    COALESCE(AVG(t.processing_time_ms), 0)::NUMERIC AS average_processing_time_ms,
    mode() WITHIN GROUP (ORDER BY t.model_used) AS most_used_model
  FROM public.lectures l
  LEFT JOIN public.transcriptions t ON l.id = t.lecture_id
  WHERE (p_user_id IS NULL OR l.user_id = p_user_id);
END;
$$;

-- 10. Grant permissions to authenticated users
GRANT EXECUTE ON FUNCTION public.save_transcription_with_metadata TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_transcription_status TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_transcription_stats TO authenticated;
GRANT SELECT ON public.lectures_with_stats TO authenticated;

-- 11. Grant usage on transcriptions table
GRANT SELECT, INSERT, UPDATE, DELETE ON public.transcriptions TO authenticated;
