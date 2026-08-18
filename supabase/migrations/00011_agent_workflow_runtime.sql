-- Agent 工作流运行时：客户端只能创建自己的 queued run，执行明细由服务端写入。
CREATE TABLE IF NOT EXISTS public.agent_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  course_id uuid REFERENCES public.courses(id) ON DELETE SET NULL,
  run_type text NOT NULL,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'completed', 'failed', 'cancelled')),
  idempotency_key text NOT NULL DEFAULT gen_random_uuid()::text,
  cancel_requested boolean NOT NULL DEFAULT false,
  input jsonb NOT NULL DEFAULT '{}'::jsonb,
  output jsonb, error text,
  requested_at timestamptz NOT NULL DEFAULT now(), started_at timestamptz, completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((status <> 'completed') OR completed_at IS NOT NULL)
);

ALTER TABLE public.agent_runs
  ADD COLUMN IF NOT EXISTS idempotency_key text,
  ADD COLUMN IF NOT EXISTS cancel_requested boolean NOT NULL DEFAULT false;
UPDATE public.agent_runs SET idempotency_key = id::text WHERE idempotency_key IS NULL;
ALTER TABLE public.agent_runs ALTER COLUMN idempotency_key SET NOT NULL;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.agent_runs'::regclass AND conname='agent_runs_user_idempotency_key_unique') THEN
    ALTER TABLE public.agent_runs ADD CONSTRAINT agent_runs_user_idempotency_key_unique UNIQUE (user_id, idempotency_key);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.agent_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES public.agent_runs(id) ON DELETE CASCADE,
  step_key text NOT NULL,
  sequence integer NOT NULL DEFAULT 0 CHECK (sequence >= 0),
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'completed', 'failed', 'cancelled')),
  input jsonb NOT NULL DEFAULT '{}'::jsonb,
  output jsonb, error text, started_at timestamptz, completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (run_id, step_key)
);

ALTER TABLE public.agent_steps ADD COLUMN IF NOT EXISTS sequence integer;
WITH numbered AS (
  SELECT id, row_number() OVER (PARTITION BY run_id ORDER BY created_at, id) - 1 AS value
  FROM public.agent_steps
) UPDATE public.agent_steps s SET sequence = numbered.value FROM numbered WHERE s.id = numbered.id AND s.sequence IS NULL;
ALTER TABLE public.agent_steps ALTER COLUMN sequence SET NOT NULL;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.agent_steps'::regclass AND conname='agent_steps_run_sequence_unique') THEN
    ALTER TABLE public.agent_steps ADD CONSTRAINT agent_steps_run_sequence_unique UNIQUE (run_id, sequence);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.agent_artifacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES public.agent_runs(id) ON DELETE CASCADE,
  step_id uuid REFERENCES public.agent_steps(id) ON DELETE SET NULL,
  artifact_type text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'queued', 'running', 'completed', 'failed', 'cancelled')),
  title text, content jsonb NOT NULL DEFAULT '{}'::jsonb, storage_path text, content_hash text, error text,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (run_id, artifact_type, content_hash)
);

CREATE INDEX IF NOT EXISTS agent_runs_user_created_idx ON public.agent_runs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS agent_runs_status_requested_idx ON public.agent_runs(status, requested_at);
CREATE INDEX IF NOT EXISTS agent_steps_run_sequence_idx ON public.agent_steps(run_id, sequence);
CREATE INDEX IF NOT EXISTS agent_artifacts_run_created_idx ON public.agent_artifacts(run_id, created_at);

ALTER TABLE public.agent_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_artifacts ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='agent_runs' AND policyname='agent_runs_owner_read') THEN CREATE POLICY "agent_runs_owner_read" ON public.agent_runs FOR SELECT TO authenticated USING (user_id = auth.uid()); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='agent_runs' AND policyname='agent_runs_owner_queue') THEN CREATE POLICY "agent_runs_owner_queue" ON public.agent_runs FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() AND status = 'queued' AND cancel_requested = false AND started_at IS NULL AND completed_at IS NULL AND output IS NULL AND error IS NULL); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='agent_steps' AND policyname='agent_steps_owner_read') THEN CREATE POLICY "agent_steps_owner_read" ON public.agent_steps FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.agent_runs r WHERE r.id=agent_steps.run_id AND r.user_id=auth.uid())); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='agent_artifacts' AND policyname='agent_artifacts_owner_read') THEN CREATE POLICY "agent_artifacts_owner_read" ON public.agent_artifacts FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.agent_runs r WHERE r.id=agent_artifacts.run_id AND r.user_id=auth.uid())); END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='agent_runs') THEN ALTER PUBLICATION supabase_realtime ADD TABLE public.agent_runs; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='agent_steps') THEN ALTER PUBLICATION supabase_realtime ADD TABLE public.agent_steps; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='agent_artifacts') THEN ALTER PUBLICATION supabase_realtime ADD TABLE public.agent_artifacts; END IF;
END $$;
