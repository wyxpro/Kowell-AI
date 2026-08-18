-- 动态学习闭环：事件、掌握度和可审计画像版本。
CREATE TABLE IF NOT EXISTS public.learning_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  course_id uuid REFERENCES public.courses(id) ON DELETE SET NULL,
  knowledge_point_id uuid,
  resource_id uuid REFERENCES public.resources(id) ON DELETE SET NULL,
  exercise_id uuid REFERENCES public.exercises(id) ON DELETE SET NULL,
  submission_id uuid REFERENCES public.user_exercise_submissions(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  idempotency_key text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  processing_status text NOT NULL DEFAULT 'pending' CHECK (processing_status IN ('pending', 'processing', 'processed', 'failed', 'ignored')),
  processed_at timestamptz,
  processing_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, idempotency_key),
  FOREIGN KEY (course_id, knowledge_point_id) REFERENCES public.knowledge_points(course_id, id) ON DELETE SET NULL
);

ALTER TABLE public.learning_events
  ADD COLUMN IF NOT EXISTS resource_id uuid REFERENCES public.resources(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS exercise_id uuid REFERENCES public.exercises(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS submission_id uuid REFERENCES public.user_exercise_submissions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS processing_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS processed_at timestamptz,
  ADD COLUMN IF NOT EXISTS processing_error text;

CREATE TABLE IF NOT EXISTS public.user_knowledge_mastery (
  user_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  knowledge_point_id uuid NOT NULL,
  mastery_score numeric(5,4) NOT NULL DEFAULT 0 CHECK (mastery_score >= 0 AND mastery_score <= 1),
  confidence numeric(5,4) NOT NULL DEFAULT 0 CHECK (confidence >= 0 AND confidence <= 1),
  evidence_count integer NOT NULL DEFAULT 0 CHECK (evidence_count >= 0),
  last_event_id uuid REFERENCES public.learning_events(id) ON DELETE SET NULL,
  last_assessed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, course_id, knowledge_point_id),
  FOREIGN KEY (course_id, knowledge_point_id) REFERENCES public.knowledge_points(course_id, id) ON DELETE CASCADE
);

ALTER TABLE public.learning_portraits
  ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS last_revision_id uuid,
  ADD COLUMN IF NOT EXISTS last_updated_at timestamptz NOT NULL DEFAULT now();

-- 不删除或合并历史画像：如果已存在重复用户画像，唯一索引不会被创建，并明确终止迁移。
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.learning_portraits GROUP BY user_id HAVING count(*) > 1) THEN
    RAISE EXCEPTION 'Cannot add learning_portraits(user_id) uniqueness: duplicate portrait rows exist. Resolve them explicitly before migration 00012.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.learning_portraits'::regclass AND conname='learning_portraits_user_id_unique') THEN
    ALTER TABLE public.learning_portraits ADD CONSTRAINT learning_portraits_user_id_unique UNIQUE (user_id);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.learning_portrait_revisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  portrait_id uuid NOT NULL REFERENCES public.learning_portraits(id) ON DELETE CASCADE,
  version integer NOT NULL CHECK (version > 0),
  source_event_id uuid REFERENCES public.learning_events(id) ON DELETE SET NULL,
  snapshot jsonb NOT NULL,
  reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (portrait_id, version)
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.learning_portraits'::regclass AND conname='learning_portraits_last_revision_fk') THEN
    ALTER TABLE public.learning_portraits ADD CONSTRAINT learning_portraits_last_revision_fk FOREIGN KEY (last_revision_id) REFERENCES public.learning_portrait_revisions(id) ON DELETE SET NULL;
  END IF;
END $$;

ALTER TABLE public.learning_paths
  ADD COLUMN IF NOT EXISTS course_id uuid REFERENCES public.courses(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 2,
  ADD COLUMN IF NOT EXISTS reasoning jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS source_event_id uuid REFERENCES public.learning_events(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.learning_paths.stages IS 'v2 JSON array using camelCase: [{"id":string,"title":string,"description":string,"order":number,"resources":string[],"knowledgePointIds":string[],"resourceIds":string[],"reason":string,"completed":boolean}].';
COMMENT ON COLUMN public.learning_paths.reasoning IS 'v2 rationale object, including portrait_version, mastery_snapshot and scheduling assumptions.';

ALTER TABLE public.resources
  ADD COLUMN IF NOT EXISTS agent_run_id uuid REFERENCES public.agent_runs(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS quality_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS quality_score numeric(5,2);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.resources'::regclass AND conname='resources_quality_status_check') THEN
    ALTER TABLE public.resources ADD CONSTRAINT resources_quality_status_check CHECK (quality_status IN ('pending', 'reviewed', 'approved', 'rejected', 'failed'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.resources'::regclass AND conname='resources_quality_score_check') THEN
    ALTER TABLE public.resources ADD CONSTRAINT resources_quality_score_check CHECK (quality_score IS NULL OR (quality_score >= 0 AND quality_score <= 100));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS learning_events_user_occurred_idx ON public.learning_events(user_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS learning_events_processing_idx ON public.learning_events(processing_status, occurred_at);
CREATE INDEX IF NOT EXISTS learning_events_course_point_idx ON public.learning_events(course_id, knowledge_point_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS learning_events_resource_idx ON public.learning_events(user_id, resource_id, occurred_at DESC) WHERE resource_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS learning_events_exercise_idx ON public.learning_events(user_id, exercise_id, occurred_at DESC) WHERE exercise_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS user_knowledge_mastery_user_course_idx ON public.user_knowledge_mastery(user_id, course_id, mastery_score);
CREATE INDEX IF NOT EXISTS portrait_revisions_user_created_idx ON public.learning_portrait_revisions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS learning_paths_course_user_idx ON public.learning_paths(course_id, user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS resources_agent_run_idx ON public.resources(agent_run_id) WHERE agent_run_id IS NOT NULL;

ALTER TABLE public.learning_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_knowledge_mastery ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learning_portrait_revisions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='learning_events' AND policyname='learning_events_owner_read') THEN CREATE POLICY "learning_events_owner_read" ON public.learning_events FOR SELECT TO authenticated USING (user_id=auth.uid()); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='learning_events' AND policyname='learning_events_owner_insert') THEN CREATE POLICY "learning_events_owner_insert" ON public.learning_events FOR INSERT TO authenticated WITH CHECK (user_id=auth.uid() AND processing_status='pending' AND processed_at IS NULL AND processing_error IS NULL); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='user_knowledge_mastery' AND policyname='mastery_owner_read') THEN CREATE POLICY "mastery_owner_read" ON public.user_knowledge_mastery FOR SELECT TO authenticated USING (user_id=auth.uid()); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='learning_portrait_revisions' AND policyname='portrait_revisions_owner_read') THEN CREATE POLICY "portrait_revisions_owner_read" ON public.learning_portrait_revisions FOR SELECT TO authenticated USING (user_id=auth.uid()); END IF;
END $$;
