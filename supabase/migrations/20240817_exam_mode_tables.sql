-- Exam Mode Tables for Universite
-- These tables support the Exam Mode feature for practice exams and test preparation

-- Exam Sessions: Tracks each exam attempt
CREATE TABLE IF NOT EXISTS exam_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  module_id UUID REFERENCES modules(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  duration_minutes INTEGER NOT NULL, -- 0 for practice questions, 15, 30, or 60 for timed exams
  score DECIMAL(5,2), -- Overall percentage score
  readiness_score INTEGER, -- 0-100 readiness score
  questions_count INTEGER NOT NULL,
  correct_count INTEGER DEFAULT 0,
  status TEXT DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'abandoned')),
  submitted_at TIMESTAMP WITH TIME ZONE,

  -- Indexes for common queries
  INDEX idx_exam_sessions_user_id (user_id),
  INDEX idx_exam_sessions_module_id (module_id),
  INDEX idx_exam_sessions_created_at (created_at DESC)
);

-- Exam Questions: Stores questions for each exam session
CREATE TABLE IF NOT EXISTS exam_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_session_id UUID NOT NULL REFERENCES exam_sessions(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  question_type TEXT NOT NULL CHECK (question_type IN ('multiple_choice', 'short_answer', 'long_answer', 'mixed')),
  difficulty TEXT NOT NULL CHECK (difficulty IN ('easy', 'medium', 'hard')),
  expected_answer TEXT, -- The correct answer or model answer
  options JSONB, -- For multiple choice questions: ["A) Option 1", "B) Option 2", ...]
  correct_option TEXT, -- For multiple choice: "A", "B", "C", or "D"
  order_index INTEGER NOT NULL, -- Order in the exam
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Indexes for common queries
  INDEX idx_exam_questions_session_id (exam_session_id),
  INDEX idx_exam_questions_order (exam_session_id, order_index)
);

-- Student Answers: Stores student responses to exam questions
CREATE TABLE IF NOT EXISTS student_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_session_id UUID NOT NULL REFERENCES exam_sessions(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES exam_questions(id) ON DELETE CASCADE,
  answer TEXT NOT NULL,
  score DECIMAL(5,2), -- Score for this specific answer (0-100)
  feedback TEXT, -- AI-generated feedback
  missing_concepts TEXT[], -- Concepts the student missed
  suggested_improvements TEXT[], -- Suggestions for improvement
  model_answer TEXT, -- The model answer based on lecture content
  is_correct BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Indexes for common queries
  INDEX idx_student_answers_session_id (exam_session_id),
  INDEX idx_student_answers_question_id (question_id),
  UNIQUE(exam_session_id, question_id) -- One answer per question per session
);

-- Weak Topics: Tracks topics where students struggle
CREATE TABLE IF NOT EXISTS weak_topics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  module_id UUID REFERENCES modules(id) ON DELETE CASCADE,
  topic TEXT NOT NULL,
  mistake_count INTEGER DEFAULT 0,
  confidence DECIMAL(3,2) DEFAULT 0.0, -- 0.0 to 1.0 confidence level
  last_practiced_at TIMESTAMP WITH TIME ZONE,
  recommended_lecture_ids UUID[], -- Array of lecture IDs to review
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Indexes for common queries
  INDEX idx_weak_topics_user_id (user_id),
  INDEX idx_weak_topics_module_id (module_id),
  INDEX idx_weak_topics_mistake_count (mistake_count DESC),
  UNIQUE(user_id, module_id, topic) -- One entry per topic per module per user
);

-- Enable Row Level Security
ALTER TABLE exam_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE exam_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE weak_topics ENABLE ROW LEVEL SECURITY;

-- RLS Policies for exam_sessions
CREATE POLICY "Users can view their own exam sessions"
  ON exam_sessions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own exam sessions"
  ON exam_sessions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own exam sessions"
  ON exam_sessions FOR UPDATE
  USING (auth.uid() = user_id);

-- RLS Policies for exam_questions
CREATE POLICY "Users can view questions for their exam sessions"
  ON exam_questions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM exam_sessions 
      WHERE exam_sessions.id = exam_questions.exam_session_id 
      AND exam_sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert questions for their exam sessions"
  ON exam_questions FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM exam_sessions 
      WHERE exam_sessions.id = exam_questions.exam_session_id 
      AND exam_sessions.user_id = auth.uid()
    )
  );

-- RLS Policies for student_answers
CREATE POLICY "Users can view their own answers"
  ON student_answers FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM exam_sessions 
      WHERE exam_sessions.id = student_answers.exam_session_id 
      AND exam_sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert their own answers"
  ON student_answers FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM exam_sessions 
      WHERE exam_sessions.id = student_answers.exam_session_id 
      AND exam_sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own answers"
  ON student_answers FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM exam_sessions 
      WHERE exam_sessions.id = student_answers.exam_session_id 
      AND exam_sessions.user_id = auth.uid()
    )
  );

-- RLS Policies for weak_topics
CREATE POLICY "Users can view their own weak topics"
  ON weak_topics FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own weak topics"
  ON weak_topics FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own weak topics"
  ON weak_topics FOR UPDATE
  USING (auth.uid() = user_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_student_answers_updated_at
  BEFORE UPDATE ON student_answers
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_weak_topics_updated_at
  BEFORE UPDATE ON weak_topics
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
