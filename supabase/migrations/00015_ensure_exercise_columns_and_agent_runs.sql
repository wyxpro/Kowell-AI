-- 00015_ensure_exercise_columns_and_agent_runs.sql
-- 幂等补充 exercises.question_type、user_exercise_submissions 相关 AI 列以及 agent_runs 权限

-- 1. 确保 exercises 表拥有 question_type 列
ALTER TABLE public.exercises
  ADD COLUMN IF NOT EXISTS question_type text DEFAULT 'single';

UPDATE public.exercises
SET question_type = CASE
  WHEN CASE WHEN jsonb_typeof(options) = 'array' THEN jsonb_array_length(options) ELSE 0 END > 0 THEN 'single'
  ELSE 'subjective'
END
WHERE question_type IS NULL
   OR question_type NOT IN ('single', 'multiple', 'subjective');

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.exercises'::regclass
      AND conname = 'exercises_question_type_check'
  ) THEN
    ALTER TABLE public.exercises
      ADD CONSTRAINT exercises_question_type_check
      CHECK (question_type IN ('single', 'multiple', 'subjective'));
  END IF;
END $$;

-- 2. 确保 user_exercise_submissions 表拥有 AI 相关扩展列
ALTER TABLE public.user_exercise_submissions
  ADD COLUMN IF NOT EXISTS ai_status text DEFAULT 'skipped',
  ADD COLUMN IF NOT EXISTS ai_analysis text,
  ADD COLUMN IF NOT EXISTS ai_suggestions text,
  ADD COLUMN IF NOT EXISTS ai_request_id text;

-- 3. 确保 user_exercise_submissions 表的 UPDATE 与 INSERT RLS 策略存在
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'user_exercise_submissions'
      AND cmd = 'UPDATE'
  ) THEN
    CREATE POLICY "user_exercise_submissions_update_own" ON public.user_exercise_submissions
      FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'user_exercise_submissions'
      AND cmd = 'INSERT'
  ) THEN
    CREATE POLICY "user_exercise_submissions_insert_own" ON public.user_exercise_submissions
      FOR INSERT WITH CHECK (user_id = auth.uid());
  END IF;
END $$;

-- 4. 确保 agent_runs / agent_steps 表可由认证与匿名用户读取写入
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'agent_runs') THEN
    ALTER TABLE public.agent_runs ENABLE ROW LEVEL SECURITY;
    
    DROP POLICY IF EXISTS "agent_runs_select_policy" ON public.agent_runs;
    DROP POLICY IF EXISTS "agent_runs_insert_policy" ON public.agent_runs;
    DROP POLICY IF EXISTS "agent_runs_update_policy" ON public.agent_runs;

    CREATE POLICY "agent_runs_select_policy" ON public.agent_runs FOR SELECT USING (true);
    CREATE POLICY "agent_runs_insert_policy" ON public.agent_runs FOR INSERT WITH CHECK (true);
    CREATE POLICY "agent_runs_update_policy" ON public.agent_runs FOR UPDATE USING (true) WITH CHECK (true);
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'agent_steps') THEN
    ALTER TABLE public.agent_steps ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "agent_steps_select_policy" ON public.agent_steps;
    DROP POLICY IF EXISTS "agent_steps_insert_policy" ON public.agent_steps;
    DROP POLICY IF EXISTS "agent_steps_update_policy" ON public.agent_steps;

    CREATE POLICY "agent_steps_select_policy" ON public.agent_steps FOR SELECT USING (true);
    CREATE POLICY "agent_steps_insert_policy" ON public.agent_steps FOR INSERT WITH CHECK (true);
    CREATE POLICY "agent_steps_update_policy" ON public.agent_steps FOR UPDATE USING (true) WITH CHECK (true);
  END IF;
END $$;
