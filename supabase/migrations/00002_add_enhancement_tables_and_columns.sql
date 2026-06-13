
-- 1. 扩展 user_profiles 表
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS bio text,
  ADD COLUMN IF NOT EXISTS theme_preference text DEFAULT 'system',
  ADD COLUMN IF NOT EXISTS notification_settings jsonb DEFAULT '{"email":true,"push":true,"weekly_report":true}'::jsonb;

-- 2. 扩展 resources 表
ALTER TABLE resources
  ADD COLUMN IF NOT EXISTS tags text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS rating numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rating_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS view_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS favorite_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS source text DEFAULT 'ai';

-- 3. 扩展 exercises 表
ALTER TABLE exercises
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS tags text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS ai_generated boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS usage_count integer DEFAULT 0;

-- 4. 扩展 chat_messages 表
ALTER TABLE chat_messages
  ADD COLUMN IF NOT EXISTS session_id uuid DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS token_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS model_version text DEFAULT 'ernie-4.5-turbo',
  ADD COLUMN IF NOT EXISTS feedback smallint;

-- 5. 新增 favorites 表（用户收藏资源）
CREATE TABLE favorites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  resource_id uuid NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, resource_id)
);

-- 6. 新增 resource_ratings 表（资源评分）
CREATE TABLE resource_ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  resource_id uuid NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
  rating smallint NOT NULL CHECK(rating BETWEEN 1 AND 5),
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, resource_id)
);

-- 7. 新增 study_sessions 表（学习时长记录）
CREATE TABLE study_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  resource_id uuid REFERENCES resources(id) ON DELETE SET NULL,
  started_at timestamptz DEFAULT now(),
  ended_at timestamptz,
  duration_seconds integer DEFAULT 0,
  session_date date DEFAULT current_date
);

-- 8. 新增 user_exercise_submissions 表（答题记录）
CREATE TABLE user_exercise_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  exercise_id uuid NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
  user_answer text NOT NULL,
  is_correct boolean,
  ai_score numeric,
  ai_feedback text,
  time_spent integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- 9. 新增 wrong_book 表（错题本）
CREATE TABLE wrong_book (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  exercise_id uuid NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
  submission_id uuid REFERENCES user_exercise_submissions(id) ON DELETE SET NULL,
  note text,
  mastered boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, exercise_id)
);

-- 10. RLS
ALTER TABLE favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE resource_ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE study_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_exercise_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE wrong_book ENABLE ROW LEVEL SECURITY;

CREATE POLICY "favorites_owner" ON favorites USING (user_id = auth.uid());
CREATE POLICY "favorites_insert" ON favorites FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "favorites_delete" ON favorites FOR DELETE USING (user_id = auth.uid());

CREATE POLICY "ratings_owner" ON resource_ratings USING (user_id = auth.uid());
CREATE POLICY "ratings_insert" ON resource_ratings FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "ratings_update" ON resource_ratings FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "sessions_owner" ON study_sessions USING (user_id = auth.uid());
CREATE POLICY "sessions_insert" ON study_sessions FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "sessions_update" ON study_sessions FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "submissions_owner" ON user_exercise_submissions USING (user_id = auth.uid());
CREATE POLICY "submissions_insert" ON user_exercise_submissions FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "wrongbook_owner" ON wrong_book USING (user_id = auth.uid());
CREATE POLICY "wrongbook_insert" ON wrong_book FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "wrongbook_update" ON wrong_book FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "wrongbook_delete" ON wrong_book FOR DELETE USING (user_id = auth.uid());

-- 11. 资源公开读取（RLS完善）
ALTER TABLE resources ENABLE ROW LEVEL SECURITY;
CREATE POLICY "resources_select_own" ON resources FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "resources_insert_own" ON resources FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "resources_update_own" ON resources FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "resources_delete_own" ON resources FOR DELETE USING (user_id = auth.uid());

-- 12. 激活 Supabase Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE favorites, wrong_book;
