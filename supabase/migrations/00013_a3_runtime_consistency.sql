-- A3 运行时一致性与幂等补充：只新增兼容约束，不改写历史迁移。
-- 运行时写入统一经过下方 SECURITY DEFINER RPC；客户端只读脱敏状态列。

-- 00010 早期版本缺少复合外键所需的精确唯一键；兼容已执行旧迁移的数据库。
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.knowledge_points'::regclass
      AND contype = 'u'
      AND (
        conname = 'knowledge_points_course_id_unique'
        OR pg_get_constraintdef(oid) = 'UNIQUE (course_id, id)'
      )
  ) THEN
    ALTER TABLE public.knowledge_points
      ADD CONSTRAINT knowledge_points_course_id_unique UNIQUE (course_id, id);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.course_document_chunks'::regclass
      AND contype = 'u'
      AND (
        conname = 'course_document_chunks_course_id_unique'
        OR pg_get_constraintdef(oid) = 'UNIQUE (course_id, id)'
      )
  ) THEN
    ALTER TABLE public.course_document_chunks
      ADD CONSTRAINT course_document_chunks_course_id_unique UNIQUE (course_id, id);
  END IF;
END $$;

ALTER TABLE public.agent_runs
  ADD COLUMN IF NOT EXISTS idempotency_key text,
  ADD COLUMN IF NOT EXISTS cancel_requested boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS lease_token uuid,
  ADD COLUMN IF NOT EXISTS lease_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS attempt_count integer NOT NULL DEFAULT 0;

UPDATE public.agent_runs
SET idempotency_key = id::text
WHERE idempotency_key IS NULL;

ALTER TABLE public.agent_runs
  ALTER COLUMN idempotency_key SET NOT NULL;

ALTER TABLE public.agent_runs
  DROP CONSTRAINT IF EXISTS agent_runs_user_idempotency_unique;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.agent_runs
    GROUP BY user_id, idempotency_key
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Cannot add agent_runs(user_id, idempotency_key) uniqueness: duplicate rows exist.';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.agent_runs'::regclass
      AND contype = 'u'
      AND conname = 'agent_runs_user_idempotency_key_unique'
  ) THEN
    ALTER TABLE public.agent_runs
      ADD CONSTRAINT agent_runs_user_idempotency_key_unique UNIQUE (user_id, idempotency_key);
  END IF;
END $$;

ALTER TABLE public.agent_steps
  ADD COLUMN IF NOT EXISTS sequence integer;

WITH numbered AS (
  SELECT id, row_number() OVER (PARTITION BY run_id ORDER BY created_at, id)::integer - 1 AS step_sequence
  FROM public.agent_steps
)
UPDATE public.agent_steps AS steps
SET sequence = numbered.step_sequence
FROM numbered
WHERE steps.id = numbered.id;

ALTER TABLE public.agent_steps
  ALTER COLUMN sequence DROP DEFAULT,
  ALTER COLUMN sequence SET NOT NULL;

ALTER TABLE public.agent_steps
  ADD COLUMN IF NOT EXISTS attempt_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS lease_token uuid,
  ADD COLUMN IF NOT EXISTS lease_expires_at timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.agent_steps'::regclass
      AND conname = 'agent_steps_run_sequence_unique'
  ) THEN
    ALTER TABLE public.agent_steps
      ADD CONSTRAINT agent_steps_run_sequence_unique UNIQUE (run_id, sequence);
  END IF;
END $$;

ALTER TABLE public.agent_artifacts
  ADD COLUMN IF NOT EXISTS publish_key text;

UPDATE public.agent_artifacts
SET publish_key = 'legacy:' || id::text
WHERE publish_key IS NULL;

ALTER TABLE public.agent_artifacts
  ALTER COLUMN publish_key SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS agent_artifacts_run_publish_key_unique
  ON public.agent_artifacts(run_id, publish_key);

-- 客户端事件引用必须落在顶层，数据库才能校验归属和建立索引。
ALTER TABLE public.learning_events
  ADD COLUMN IF NOT EXISTS resource_id uuid,
  ADD COLUMN IF NOT EXISTS exercise_id uuid,
  ADD COLUMN IF NOT EXISTS submission_id uuid,
  ADD COLUMN IF NOT EXISTS processing_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS processing_attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS processing_lease_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.learning_events'::regclass
      AND confrelid = 'public.resources'::regclass
      AND pg_get_constraintdef(oid) LIKE 'FOREIGN KEY (resource_id)%'
  ) THEN
    ALTER TABLE public.learning_events
      ADD CONSTRAINT learning_events_resource_fk
      FOREIGN KEY (resource_id) REFERENCES public.resources(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.learning_events'::regclass
      AND confrelid = 'public.exercises'::regclass
      AND pg_get_constraintdef(oid) LIKE 'FOREIGN KEY (exercise_id)%'
  ) THEN
    ALTER TABLE public.learning_events
      ADD CONSTRAINT learning_events_exercise_fk
      FOREIGN KEY (exercise_id) REFERENCES public.exercises(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.learning_events'::regclass
      AND confrelid = 'public.user_exercise_submissions'::regclass
      AND pg_get_constraintdef(oid) LIKE 'FOREIGN KEY (submission_id)%'
  ) THEN
    ALTER TABLE public.learning_events
      ADD CONSTRAINT learning_events_submission_fk
      FOREIGN KEY (submission_id) REFERENCES public.user_exercise_submissions(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.learning_events'::regclass
      AND conname = 'learning_events_event_type_check'
  ) THEN
    ALTER TABLE public.learning_events
      ADD CONSTRAINT learning_events_event_type_check
      CHECK (event_type IN ('resource_viewed', 'resource_completed', 'exercise_submitted', 'weakness_training_completed', 'path_stage_completed', 'resource_feedback')) NOT VALID;
  END IF;
END $$;

ALTER TABLE public.evaluations
  ADD COLUMN IF NOT EXISTS learning_event_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.evaluations'::regclass
      AND conname = 'evaluations_learning_event_fk'
  ) THEN
    ALTER TABLE public.evaluations
      ADD CONSTRAINT evaluations_learning_event_fk
      FOREIGN KEY (learning_event_id) REFERENCES public.learning_events(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS evaluations_learning_event_unique
  ON public.evaluations(learning_event_id)
  WHERE learning_event_id IS NOT NULL;

ALTER TABLE public.learning_portrait_revisions
  ADD COLUMN IF NOT EXISTS source_session_id uuid;

CREATE UNIQUE INDEX IF NOT EXISTS portrait_revisions_source_event_unique
  ON public.learning_portrait_revisions(source_event_id)
  WHERE source_event_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS portrait_revisions_source_session_unique
  ON public.learning_portrait_revisions(source_session_id)
  WHERE source_session_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS learning_events_reference_idx
  ON public.learning_events(user_id, resource_id, exercise_id, submission_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS agent_runs_lease_idx
  ON public.agent_runs(status, lease_expires_at);

CREATE INDEX IF NOT EXISTS learning_events_lease_idx
  ON public.learning_events(processing_status, processing_started_at, processing_lease_id);

-- 00010 的复合 SET NULL 会连带清空必填 course_id；保留可空关联列时只置空该列。
DO $$
DECLARE
  item record;
BEGIN
  FOR item IN
    SELECT conrelid::regclass AS relation_name, conname
    FROM pg_constraint
    WHERE contype = 'f'
      AND conrelid IN (
        'public.course_documents'::regclass,
        'public.course_document_chunks'::regclass,
        'public.resource_evidence'::regclass,
        'public.exercise_knowledge_points'::regclass,
        'public.learning_events'::regclass
      )
      AND (
        pg_get_constraintdef(oid) LIKE 'FOREIGN KEY (course_id, module_id)%'
        OR pg_get_constraintdef(oid) LIKE 'FOREIGN KEY (course_id, document_id)%'
        OR pg_get_constraintdef(oid) LIKE 'FOREIGN KEY (course_id, chunk_id)%'
        OR pg_get_constraintdef(oid) LIKE 'FOREIGN KEY (course_id, knowledge_point_id)%'
      )
  LOOP
    EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', item.relation_name, item.conname);
  END LOOP;

  ALTER TABLE public.course_documents
    ADD CONSTRAINT course_documents_course_module_fk
    FOREIGN KEY (course_id, module_id)
    REFERENCES public.course_modules(course_id, id)
    ON DELETE SET NULL (module_id);

  ALTER TABLE public.course_document_chunks
    ADD CONSTRAINT course_document_chunks_course_module_fk
    FOREIGN KEY (course_id, module_id)
    REFERENCES public.course_modules(course_id, id)
    ON DELETE SET NULL (module_id);

  ALTER TABLE public.course_document_chunks
    ADD CONSTRAINT course_document_chunks_course_point_fk
    FOREIGN KEY (course_id, knowledge_point_id)
    REFERENCES public.knowledge_points(course_id, id)
    ON DELETE SET NULL (knowledge_point_id);

  ALTER TABLE public.resource_evidence
    ADD CONSTRAINT resource_evidence_course_document_fk
    FOREIGN KEY (course_id, document_id)
    REFERENCES public.course_documents(course_id, id)
    ON DELETE SET NULL (document_id);

  ALTER TABLE public.resource_evidence
    ADD CONSTRAINT resource_evidence_course_chunk_fk
    FOREIGN KEY (course_id, chunk_id)
    REFERENCES public.course_document_chunks(course_id, id)
    ON DELETE SET NULL (chunk_id);

  ALTER TABLE public.exercise_knowledge_points
    ADD CONSTRAINT exercise_knowledge_points_course_point_fk
    FOREIGN KEY (course_id, knowledge_point_id)
    REFERENCES public.knowledge_points(course_id, id)
    ON DELETE CASCADE;

  ALTER TABLE public.learning_events
    ADD CONSTRAINT learning_events_course_point_fk
    FOREIGN KEY (course_id, knowledge_point_id)
    REFERENCES public.knowledge_points(course_id, id)
    ON DELETE SET NULL (knowledge_point_id);
END $$;

REVOKE ALL ON FUNCTION public.search_course_knowledge(uuid, text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.search_course_knowledge(uuid, text, integer) TO service_role;

-- 检索原文和模型中间结果仅供 service_role 使用；客户端只读状态与脱敏错误。
REVOKE SELECT ON public.agent_runs FROM PUBLIC, anon, authenticated;
GRANT SELECT (
  id, user_id, course_id, run_type, status, error,
  requested_at, started_at, completed_at, created_at,
  updated_at, idempotency_key, cancel_requested
) ON public.agent_runs TO authenticated;
REVOKE SELECT ON public.agent_steps FROM PUBLIC, anon, authenticated;
GRANT SELECT (
  id, run_id, step_key, sequence, status, error,
  started_at, completed_at, created_at, updated_at
) ON public.agent_steps TO authenticated;
REVOKE SELECT ON public.agent_artifacts FROM PUBLIC, anon, authenticated;
GRANT SELECT (
  id, run_id, step_id, artifact_type, status, title,
  error, created_at, updated_at
) ON public.agent_artifacts TO authenticated;

-- 00012 的宽松事件插入策略会与新策略按 OR 合并，必须先移除。
DROP POLICY IF EXISTS learning_events_owner_insert ON public.learning_events;
CREATE POLICY learning_events_owner_insert
  ON public.learning_events
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND processing_status = 'pending'
    AND processed_at IS NULL
    AND processing_error IS NULL
    AND (
      resource_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM public.resources AS resource_row
        WHERE resource_row.id = learning_events.resource_id
          AND resource_row.user_id = auth.uid()
          AND (learning_events.course_id IS NULL OR resource_row.course_id = learning_events.course_id)
      )
    )
    AND (
      exercise_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM public.exercises AS exercise_row
        JOIN public.resources AS exercise_resource ON exercise_resource.id = exercise_row.resource_id
        WHERE exercise_row.id = learning_events.exercise_id
          AND exercise_resource.user_id = auth.uid()
          AND (learning_events.course_id IS NULL OR exercise_resource.course_id = learning_events.course_id)
      )
    )
    AND (
      submission_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM public.user_exercise_submissions AS submission_row
        WHERE submission_row.id = learning_events.submission_id
          AND submission_row.user_id = auth.uid()
          AND (learning_events.exercise_id IS NULL OR submission_row.exercise_id = learning_events.exercise_id)
      )
    )
  );

DROP FUNCTION IF EXISTS public.set_agent_run_status(uuid, uuid, text, text);
DROP FUNCTION IF EXISTS public.set_agent_run_status(uuid, uuid, text, uuid, text);

CREATE OR REPLACE FUNCTION public.set_agent_run_status(
  p_run_id uuid,
  p_user_id uuid,
  p_status text,
  p_lease_token uuid,
  p_error text DEFAULT NULL
)
RETURNS public.agent_runs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  updated_run public.agent_runs;
BEGIN
  IF p_status NOT IN ('completed', 'failed', 'cancelled') THEN
    RAISE EXCEPTION 'invalid_run_status';
  END IF;
  IF p_lease_token IS NULL THEN
    RAISE EXCEPTION 'invalid_run_lease';
  END IF;

  UPDATE public.agent_runs
  SET status = CASE WHEN cancel_requested THEN 'cancelled' ELSE p_status END,
      error = NULLIF(left(coalesce(p_error, ''), 500), ''),
      completed_at = now(),
      lease_token = NULL,
      lease_expires_at = NULL,
      updated_at = now()
  WHERE id = p_run_id
    AND user_id = p_user_id
    AND status = 'running'
    AND lease_token = p_lease_token
    AND lease_expires_at > now()
  RETURNING * INTO updated_run;

  IF FOUND THEN
    RETURN updated_run;
  END IF;

  SELECT *
  INTO updated_run
  FROM public.agent_runs
  WHERE id = p_run_id
    AND user_id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'run_not_found';
  END IF;
  IF updated_run.status IN ('completed', 'failed', 'cancelled') THEN
    RETURN updated_run;
  END IF;
  RAISE EXCEPTION 'run_lease_lost';
END;
$$;

REVOKE ALL ON FUNCTION public.set_agent_run_status(uuid, uuid, text, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_agent_run_status(uuid, uuid, text, uuid, text) TO service_role;

CREATE OR REPLACE FUNCTION public.request_agent_run_cancellation(
  p_run_id uuid,
  p_user_id uuid
)
RETURNS public.agent_runs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  updated_run public.agent_runs;
BEGIN
  UPDATE public.agent_runs
  SET cancel_requested = true,
      status = 'cancelled',
      completed_at = coalesce(completed_at, now()),
      lease_token = NULL,
      lease_expires_at = NULL,
      updated_at = now()
  WHERE id = p_run_id
    AND user_id = p_user_id
    AND status NOT IN ('completed', 'cancelled')
  RETURNING * INTO updated_run;

  IF FOUND THEN
    UPDATE public.agent_steps
    SET status = 'cancelled',
        error = coalesce(error, 'run_cancelled'),
        completed_at = coalesce(completed_at, now()),
        lease_token = NULL,
        lease_expires_at = NULL,
        updated_at = now()
    WHERE run_id = p_run_id
      AND status IN ('queued', 'running');
    RETURN updated_run;
  END IF;

  SELECT *
  INTO updated_run
  FROM public.agent_runs
  WHERE id = p_run_id
    AND user_id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'run_not_found';
  END IF;
  RETURN updated_run;
END;
$$;

REVOKE ALL ON FUNCTION public.request_agent_run_cancellation(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.request_agent_run_cancellation(uuid, uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.claim_agent_run(
  p_run_id uuid,
  p_user_id uuid,
  p_expected_status text
)
RETURNS public.agent_runs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  claimed public.agent_runs;
  now_at timestamptz := now();
BEGIN
  IF p_expected_status NOT IN ('queued', 'failed', 'running') THEN
    RAISE EXCEPTION 'invalid_expected_status';
  END IF;

  UPDATE public.agent_runs
  SET status = 'running',
      started_at = COALESCE(started_at, now_at),
      completed_at = NULL,
      error = NULL,
      attempt_count = coalesce(attempt_count, 0) + 1,
      lease_token = gen_random_uuid(),
      lease_expires_at = now_at + interval '10 minutes',
      updated_at = now_at
  WHERE id = p_run_id
    AND user_id = p_user_id
    AND cancel_requested = false
    AND (
      (p_expected_status IN ('queued', 'failed') AND status = p_expected_status)
      OR (
        p_expected_status = 'running'
        AND status = 'running'
        AND (lease_expires_at IS NULL OR lease_expires_at <= now_at)
      )
    )
  RETURNING * INTO claimed;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  UPDATE public.agent_steps
  SET status = 'failed',
      error = coalesce(error, 'run_lease_reclaimed'),
      completed_at = coalesce(completed_at, now_at),
      lease_token = NULL,
      lease_expires_at = NULL,
      updated_at = now_at
  WHERE run_id = p_run_id
    AND status = 'running';

  RETURN claimed;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_agent_run(uuid, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_agent_run(uuid, uuid, text) TO service_role;

DROP FUNCTION IF EXISTS public.claim_agent_step(uuid, text, integer, jsonb, interval);
DROP FUNCTION IF EXISTS public.claim_agent_step(uuid, text, integer, jsonb, uuid, interval);

CREATE OR REPLACE FUNCTION public.claim_agent_step(
  p_run_id uuid,
  p_step_key text,
  p_sequence integer,
  p_input jsonb,
  p_run_lease_token uuid,
  p_lease interval DEFAULT interval '10 minutes'
)
RETURNS public.agent_steps
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  claimed public.agent_steps;
  existing public.agent_steps;
  now_at timestamptz := now();
BEGIN
  IF nullif(btrim(p_step_key), '') IS NULL
     OR p_sequence IS NULL
     OR p_sequence < 0
     OR p_run_lease_token IS NULL
     OR p_lease IS NULL
     OR p_lease <= interval '0'
  THEN
    RAISE EXCEPTION 'invalid_step_claim';
  END IF;

  PERFORM 1
  FROM public.agent_runs
  WHERE id = p_run_id
    AND status = 'running'
    AND cancel_requested = false
    AND lease_token = p_run_lease_token
    AND lease_expires_at > now_at
  FOR UPDATE;
  IF NOT FOUND THEN
    IF EXISTS (
      SELECT 1
      FROM public.agent_runs
      WHERE id = p_run_id
        AND (status = 'cancelled' OR cancel_requested = true)
    ) THEN
      RAISE EXCEPTION 'run_cancelled';
    END IF;
    RAISE EXCEPTION 'run_lease_lost';
  END IF;

  INSERT INTO public.agent_steps (
    run_id, step_key, sequence, status, input,
    attempt_count, lease_token, lease_expires_at,
    started_at, completed_at, error, updated_at
  )
  VALUES (
    p_run_id, p_step_key, p_sequence, 'running',
    jsonb_build_object('value', coalesce(p_input, '{}'::jsonb), 'attempt_no', 1),
    1, gen_random_uuid(), now_at + p_lease,
    now_at, NULL, NULL, now_at
  )
  ON CONFLICT DO NOTHING
  RETURNING * INTO claimed;

  IF FOUND THEN
    RETURN claimed;
  END IF;

  SELECT *
  INTO existing
  FROM public.agent_steps
  WHERE run_id = p_run_id
    AND step_key = p_step_key
  FOR UPDATE;

  IF NOT FOUND THEN
    IF EXISTS (
      SELECT 1
      FROM public.agent_steps
      WHERE run_id = p_run_id
        AND sequence = p_sequence
    ) THEN
      RAISE EXCEPTION 'step_sequence_conflict';
    END IF;
    RETURN NULL;
  END IF;

  IF existing.status = 'completed' THEN
    RETURN NULL;
  END IF;

  IF existing.status = 'running'
     AND existing.lease_expires_at IS NOT NULL
     AND existing.lease_expires_at > now_at THEN
    RETURN NULL;
  END IF;

  IF existing.attempt_count >= 2 THEN
    RAISE EXCEPTION 'step_retry_limit_reached';
  END IF;

  UPDATE public.agent_steps
  SET status = 'running',
      input = jsonb_build_object(
        'value', coalesce(p_input, '{}'::jsonb),
        'attempt_no', existing.attempt_count + 1
      ),
      attempt_count = existing.attempt_count + 1,
      lease_token = gen_random_uuid(),
      lease_expires_at = now_at + p_lease,
      started_at = now_at,
      completed_at = NULL,
      error = NULL,
      updated_at = now_at
  WHERE id = existing.id
    AND (
      status IN ('queued', 'failed')
      OR (status = 'running' AND lease_expires_at <= now_at)
    )
    AND attempt_count < 2
  RETURNING * INTO claimed;

  RETURN claimed;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_agent_step(uuid, text, integer, jsonb, uuid, interval) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_agent_step(uuid, text, integer, jsonb, uuid, interval) TO service_role;

DROP FUNCTION IF EXISTS public.finish_agent_step(uuid, uuid, text, jsonb, text, integer);
DROP FUNCTION IF EXISTS public.finish_agent_step(uuid, uuid, uuid, text, jsonb, text, integer);

CREATE OR REPLACE FUNCTION public.finish_agent_step(
  p_step_id uuid,
  p_lease_token uuid,
  p_run_lease_token uuid,
  p_status text,
  p_output jsonb DEFAULT NULL,
  p_error text DEFAULT NULL,
  p_duration_ms integer DEFAULT 0
)
RETURNS public.agent_steps
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  finished public.agent_steps;
BEGIN
  IF p_status NOT IN ('completed', 'failed', 'cancelled') THEN
    RAISE EXCEPTION 'invalid_step_finish_status';
  END IF;

  IF p_lease_token IS NULL OR p_run_lease_token IS NULL THEN
    RAISE EXCEPTION 'invalid_step_lease';
  END IF;

  UPDATE public.agent_steps AS step_row
  SET status = p_status,
      output = CASE
        WHEN p_status = 'completed' THEN jsonb_build_object(
          'value', p_output,
          'summary', left(coalesce(p_output, '{}'::jsonb)::text, 1000),
          'duration_ms', greatest(coalesce(p_duration_ms, 0), 0)
        )
        ELSE output
      END,
      error = CASE WHEN p_error IS NULL THEN error ELSE left(p_error, 500) END,
      completed_at = now(),
      lease_token = NULL,
      lease_expires_at = NULL,
      updated_at = now()
  WHERE step_row.id = p_step_id
    AND step_row.status = 'running'
    AND step_row.lease_token = p_lease_token
    AND EXISTS (
      SELECT 1
      FROM public.agent_runs AS run_row
      WHERE run_row.id = step_row.run_id
        AND run_row.status = 'running'
        AND run_row.cancel_requested = false
        AND run_row.lease_token = p_run_lease_token
        AND run_row.lease_expires_at > now()
    )
  RETURNING step_row.* INTO finished;

  RETURN finished;
END;
$$;

REVOKE ALL ON FUNCTION public.finish_agent_step(uuid, uuid, uuid, text, jsonb, text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.finish_agent_step(uuid, uuid, uuid, text, jsonb, text, integer) TO service_role;

CREATE OR REPLACE FUNCTION public.save_learning_portrait_session(
  p_user_id uuid,
  p_session_id uuid,
  p_extraction jsonb,
  p_raw_data jsonb,
  p_is_complete boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  portrait public.learning_portraits;
  revision_id uuid;
  existing_revision_id uuid;
  next_version integer;
  before_snapshot jsonb;
  after_snapshot jsonb;
BEGIN
  IF p_user_id IS NULL OR p_session_id IS NULL OR jsonb_typeof(p_extraction) <> 'object' THEN
    RAISE EXCEPTION 'invalid_portrait_session';
  END IF;

  INSERT INTO public.learning_portraits (
    user_id, knowledge_base, cognitive_style, error_patterns,
    learning_rhythm, learning_goals, major_direction, raw_data,
    is_complete, version, last_updated_at
  )
  VALUES (
    p_user_id, '{}'::jsonb, '{}'::jsonb, '{}'::jsonb,
    '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, '{}'::jsonb,
    false, 1, now()
  )
  ON CONFLICT (user_id) DO NOTHING;

  SELECT *
  INTO portrait
  FROM public.learning_portraits
  WHERE user_id = p_user_id
  FOR UPDATE;

  SELECT id
  INTO existing_revision_id
  FROM public.learning_portrait_revisions
  WHERE user_id = p_user_id
    AND source_session_id = p_session_id
  LIMIT 1;

  IF existing_revision_id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'status', 'already_applied',
      'portrait_id', portrait.id,
      'revision_id', existing_revision_id,
      'version', portrait.version
    );
  END IF;

  next_version := coalesce(portrait.version, 0) + 1;
  before_snapshot := jsonb_build_object(
    'major_direction', coalesce(portrait.major_direction, '{}'::jsonb),
    'knowledge_base', coalesce(portrait.knowledge_base, '{}'::jsonb),
    'cognitive_style', coalesce(portrait.cognitive_style, '{}'::jsonb),
    'error_patterns', coalesce(portrait.error_patterns, '{}'::jsonb),
    'learning_rhythm', coalesce(portrait.learning_rhythm, '{}'::jsonb),
    'learning_goals', coalesce(portrait.learning_goals, '{}'::jsonb)
  );
  after_snapshot := p_extraction;

  INSERT INTO public.learning_portrait_revisions (
    user_id, portrait_id, version, source_session_id, snapshot, reason
  )
  VALUES (
    p_user_id,
    portrait.id,
    next_version,
    p_session_id,
    jsonb_build_object(
      'changed_dimensions', jsonb_build_array(
        'major_direction', 'knowledge_base', 'cognitive_style',
        'error_patterns', 'learning_rhythm', 'learning_goals'
      ),
      'before', before_snapshot,
      'after', after_snapshot
    ),
    '画像对话结构化适配'
  )
  RETURNING id INTO revision_id;

  UPDATE public.learning_portraits
  SET major_direction = coalesce(p_extraction -> 'major_direction', '{}'::jsonb),
      knowledge_base = coalesce(p_extraction -> 'knowledge_base', '{}'::jsonb),
      cognitive_style = coalesce(p_extraction -> 'cognitive_style', '{}'::jsonb),
      error_patterns = coalesce(p_extraction -> 'error_patterns', '{}'::jsonb),
      learning_rhythm = coalesce(p_extraction -> 'learning_rhythm', '{}'::jsonb),
      learning_goals = coalesce(p_extraction -> 'learning_goals', '{}'::jsonb),
      raw_data = coalesce(p_raw_data, '{}'::jsonb),
      is_complete = coalesce(p_is_complete, false),
      version = next_version,
      last_revision_id = revision_id,
      last_updated_at = now(),
      updated_at = now()
  WHERE id = portrait.id;

  RETURN jsonb_build_object(
    'status', 'applied',
    'portrait_id', portrait.id,
    'revision_id', revision_id,
    'version', next_version
  );
END;
$$;

REVOKE ALL ON FUNCTION public.save_learning_portrait_session(uuid, uuid, jsonb, jsonb, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_learning_portrait_session(uuid, uuid, jsonb, jsonb, boolean) TO service_role;

CREATE OR REPLACE FUNCTION public.process_learning_event(
  p_event_id uuid,
  p_user_id uuid,
  p_lease interval DEFAULT interval '10 minutes'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  event_row public.learning_events;
  portrait public.learning_portraits;
  path_row public.learning_paths;
  revision_id uuid;
  v_course_id uuid;
  v_point_id uuid;
  score numeric;
  weight numeric;
  previous_mastery numeric;
  previous_confidence numeric;
  next_mastery numeric;
  next_confidence numeric;
  v_evidence_count integer;
  attempt_no integer;
  resource_ids jsonb;
  stage jsonb;
  before_snapshot jsonb;
  after_snapshot jsonb;
  next_version integer;
  v_processing_lease_id uuid := gen_random_uuid();
  now_at timestamptz := now();
BEGIN
  IF p_lease IS NULL OR p_lease <= interval '0' THEN
    RAISE EXCEPTION 'invalid_learning_event_lease';
  END IF;

  UPDATE public.learning_events
  SET processing_status = 'processing',
      processing_started_at = now_at,
      processing_attempts = coalesce(processing_attempts, 0) + 1,
      processing_lease_id = v_processing_lease_id,
      processing_error = NULL
  WHERE id = p_event_id
    AND user_id = p_user_id
    AND (
      processing_status IN ('pending', 'failed')
      OR (
        processing_status = 'processing'
        AND processing_started_at < now_at - p_lease
      )
    )
  RETURNING * INTO event_row;

  IF NOT FOUND THEN
    SELECT *
    INTO event_row
    FROM public.learning_events
    WHERE id = p_event_id
      AND user_id = p_user_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'learning_event_not_found';
    END IF;
    IF event_row.processing_status IN ('processed', 'ignored') THEN
      RETURN jsonb_build_object('status', event_row.processing_status, 'learning_event_id', p_event_id);
    END IF;
    RAISE EXCEPTION 'learning_event_busy';
  END IF;

  v_course_id := event_row.course_id;
  v_point_id := event_row.knowledge_point_id;
  IF v_course_id IS NULL OR v_point_id IS NULL THEN
    UPDATE public.learning_events
    SET processing_status = 'ignored',
        processed_at = now_at,
        processing_started_at = NULL,
        processing_lease_id = NULL,
        processing_error = 'knowledge_point_evidence_missing'
    WHERE id = p_event_id
      AND user_id = p_user_id
      AND processing_status = 'processing'
      AND processing_lease_id = v_processing_lease_id;
    RETURN jsonb_build_object('status', 'ignored', 'learning_event_id', p_event_id);
  END IF;

  IF jsonb_typeof(event_row.payload -> 'is_correct') = 'boolean' THEN
    score := CASE WHEN (event_row.payload ->> 'is_correct')::boolean THEN 1 ELSE 0 END;
  ELSIF jsonb_typeof(event_row.payload -> 'ai_score') = 'number' THEN
    score := greatest(0, least(1, (event_row.payload ->> 'ai_score')::numeric / 100));
  END IF;

  IF jsonb_typeof(event_row.payload -> 'attempt_no') = 'number' THEN
    attempt_no := greatest(1, least(10, (event_row.payload ->> 'attempt_no')::numeric::integer));
  ELSE
    attempt_no := 1;
  END IF;

  IF score IS NULL THEN
    UPDATE public.learning_events
    SET processing_status = 'processed',
        processed_at = now_at,
        processing_started_at = NULL,
        processing_lease_id = NULL,
        processing_error = 'no_score_evidence'
    WHERE id = p_event_id
      AND user_id = p_user_id
      AND processing_status = 'processing'
      AND processing_lease_id = v_processing_lease_id;
    RETURN jsonb_build_object(
      'status', 'processed',
      'learning_event_id', p_event_id,
      'course_id', v_course_id,
      'knowledge_point_id', v_point_id
    );
  END IF;

  weight := CASE
    WHEN attempt_no <= 1 THEN 1
    WHEN attempt_no = 2 THEN 0.72
    ELSE 0.5
  END;

  INSERT INTO public.user_knowledge_mastery (
    user_id, course_id, knowledge_point_id
  )
  VALUES (p_user_id, v_course_id, v_point_id)
  ON CONFLICT (user_id, course_id, knowledge_point_id) DO NOTHING;

  SELECT mastery_score, confidence, evidence_count
  INTO previous_mastery, previous_confidence, v_evidence_count
  FROM public.user_knowledge_mastery
  WHERE user_id = p_user_id
    AND course_id = v_course_id
    AND knowledge_point_id = v_point_id
  FOR UPDATE;

  next_mastery := CASE
    WHEN score >= 0.5 THEN greatest(0, least(1, previous_mastery + 0.16 * weight * score))
    ELSE greatest(0, least(1, previous_mastery - 0.12 * weight * (1 - score)))
  END;
  next_confidence := greatest(0, least(1, previous_confidence + 0.12 * weight));
  v_evidence_count := v_evidence_count + 1;

  UPDATE public.user_knowledge_mastery
  SET mastery_score = next_mastery,
      confidence = next_confidence,
      evidence_count = v_evidence_count,
      last_event_id = p_event_id,
      last_assessed_at = now_at,
      updated_at = now_at
  WHERE user_id = p_user_id
    AND course_id = v_course_id
    AND knowledge_point_id = v_point_id;

  INSERT INTO public.learning_portraits (
    user_id, knowledge_base, version, last_updated_at
  )
  VALUES (p_user_id, '{}'::jsonb, 1, now_at)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT *
  INTO portrait
  FROM public.learning_portraits
  WHERE user_id = p_user_id
  FOR UPDATE;

  next_version := coalesce(portrait.version, 0) + 1;
  before_snapshot := coalesce(portrait.knowledge_base, '{}'::jsonb);
  after_snapshot := before_snapshot || jsonb_build_object(
    'masteryByKnowledgePoint',
    coalesce(before_snapshot -> 'masteryByKnowledgePoint', '{}'::jsonb) || jsonb_build_object(
      v_point_id::text,
      jsonb_build_object('mastery', next_mastery, 'confidence', next_confidence)
    )
  );

  INSERT INTO public.learning_portrait_revisions (
    user_id, portrait_id, version, source_event_id, snapshot, reason
  )
  VALUES (
    p_user_id,
    portrait.id,
    next_version,
    p_event_id,
    jsonb_build_object(
      'changed_dimensions', jsonb_build_array('knowledge_base'),
      'before', before_snapshot,
      'after', after_snapshot
    ),
    '学习事件提供掌握度证据'
  )
  RETURNING id INTO revision_id;

  UPDATE public.learning_portraits
  SET knowledge_base = after_snapshot,
      version = next_version,
      last_revision_id = revision_id,
      last_updated_at = now_at,
      updated_at = now_at
  WHERE id = portrait.id;

  INSERT INTO public.evaluations (
    user_id, learning_event_id, knowledge_score, efficiency_score,
    weakness_analysis, suggestions
  )
  VALUES (
    p_user_id,
    p_event_id,
    next_mastery * 100,
    0,
    CASE WHEN next_mastery < 0.55
      THEN jsonb_build_object('knowledgePointIds', jsonb_build_array(v_point_id))
      ELSE '{}'::jsonb
    END,
    CASE WHEN next_mastery < 0.55
      THEN jsonb_build_array('完成强化资源后再次练习')
      ELSE jsonb_build_array('保持当前学习节奏')
    END
  )
  ON CONFLICT DO NOTHING;

  IF next_mastery < 0.55 THEN
    SELECT coalesce(jsonb_agg(resource_id), '[]'::jsonb)
    INTO resource_ids
    FROM (
      SELECT id AS resource_id
      FROM public.resources
      WHERE user_id = p_user_id
        AND course_id = v_course_id
        AND resource_type IN ('exercise', 'document', 'micro_lesson')
      ORDER BY updated_at DESC
      LIMIT 6
    ) AS candidate_resources;

    IF jsonb_array_length(resource_ids) > 0 THEN
      SELECT *
      INTO path_row
      FROM public.learning_paths
      WHERE user_id = p_user_id
        AND course_id = v_course_id
      ORDER BY updated_at DESC
      LIMIT 1
      FOR UPDATE;

      stage := jsonb_build_object(
        'id', gen_random_uuid()::text,
        'title', '薄弱知识点强化',
        'description', '针对当前薄弱知识点安排的补强资源',
        'order', coalesce(jsonb_array_length(path_row.stages), 0) + 1,
        'resources', resource_ids,
        'knowledgePointIds', jsonb_build_array(v_point_id),
        'resourceIds', resource_ids,
        'reason', '掌握度低于 55%',
        'completed', false,
        'sourceEventId', p_event_id::text,
        'status', 'available'
      );

      IF path_row.id IS NOT NULL THEN
        IF NOT (coalesce(path_row.stages, '[]'::jsonb) @> jsonb_build_array(jsonb_build_object('sourceEventId', p_event_id::text))) THEN
          UPDATE public.learning_paths
          SET stages = coalesce(stages, '[]'::jsonb) || jsonb_build_array(stage),
              source_event_id = p_event_id,
              reasoning = jsonb_build_object('reason', '掌握度低于 55%', 'knowledgePointId', v_point_id),
              version = coalesce(version, 1) + 1,
              updated_at = now_at
          WHERE id = path_row.id;
        END IF;
      ELSE
        INSERT INTO public.learning_paths (
          user_id, course_id, title, stages, source_event_id, reasoning, version
        )
        VALUES (
          p_user_id,
          v_course_id,
          '个性化强化路径',
          jsonb_build_array(stage),
          p_event_id,
          jsonb_build_object('reason', '掌握度低于 55%'),
          1
        );
      END IF;
    END IF;
  END IF;

  UPDATE public.learning_events
  SET processing_status = 'processed',
      processed_at = now_at,
      processing_started_at = NULL,
      processing_lease_id = NULL,
      processing_error = NULL
  WHERE id = p_event_id
    AND user_id = p_user_id
    AND processing_status = 'processing'
    AND processing_lease_id = v_processing_lease_id;

  RETURN jsonb_build_object(
    'status', 'processed',
    'learning_event_id', p_event_id,
    'course_id', v_course_id,
    'knowledge_point_id', v_point_id,
    'mastery', next_mastery,
    'confidence', next_confidence,
    'evidence_count', v_evidence_count
  );
END;
$$;

REVOKE ALL ON FUNCTION public.process_learning_event(uuid, uuid, interval) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.process_learning_event(uuid, uuid, interval) TO service_role;

DROP FUNCTION IF EXISTS public.publish_agent_resources(uuid, uuid, text, jsonb);
DROP FUNCTION IF EXISTS public.publish_agent_resources(uuid, uuid, text, jsonb, uuid);

CREATE OR REPLACE FUNCTION public.publish_agent_resources(
  p_run_id uuid,
  p_user_id uuid,
  p_request text,
  p_items jsonb,
  p_lease_token uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  run_row public.agent_runs;
  path_row public.learning_paths;
  item jsonb;
  evidence_item jsonb;
  resource_id uuid;
  existing_resource_text text;
  existing_artifact_found boolean;
  resource_type text;
  publish_key text;
  review_summary text := '';
  resource_ids jsonb := '[]'::jsonb;
  knowledge_point_ids jsonb := '[]'::jsonb;
  stage jsonb;
BEGIN
  IF jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'resource_publish_items_missing';
  END IF;
  IF p_lease_token IS NULL THEN
    RAISE EXCEPTION 'invalid_run_lease';
  END IF;

  SELECT *
  INTO run_row
  FROM public.agent_runs
  WHERE id = p_run_id
    AND user_id = p_user_id
    AND status = 'running'
    AND cancel_requested = false
    AND lease_token = p_lease_token
    AND lease_expires_at > now()
  FOR UPDATE;

  IF NOT FOUND THEN
    IF EXISTS (
      SELECT 1
      FROM public.agent_runs
      WHERE id = p_run_id
        AND (status = 'cancelled' OR cancel_requested = true)
    ) THEN
      RAISE EXCEPTION 'run_cancelled';
    END IF;
    RAISE EXCEPTION 'run_lease_lost';
  END IF;
  IF run_row.course_id IS NULL THEN
    RAISE EXCEPTION 'run_not_publishable';
  END IF;

  -- 同一用户/课程的路径更新串行化；不同 run 的资源仍可并行生成。
  PERFORM pg_advisory_xact_lock(
    hashtextextended(p_user_id::text || ':' || run_row.course_id::text, 0)
  );

  IF EXISTS (
    SELECT 1
    FROM (
      SELECT coalesce(
        nullif(btrim(value ->> 'publish_key'), ''),
        'resource:' || coalesce(value ->> 'artifact_type', '')
      ) AS publish_key
      FROM jsonb_array_elements(p_items) AS item(value)
    ) AS publish_keys
    GROUP BY publish_key
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'duplicate_publish_key';
  END IF;

  FOR item IN SELECT value FROM jsonb_array_elements(p_items)
  LOOP
    resource_type := item ->> 'artifact_type';
    IF resource_type NOT IN ('document', 'mindmap', 'exercise', 'reading', 'code', 'micro_lesson') THEN
      RAISE EXCEPTION 'invalid_resource_type';
    END IF;

    publish_key := coalesce(nullif(btrim(item ->> 'publish_key'), ''), 'resource:' || resource_type);
    IF length(publish_key) > 200 THEN
      RAISE EXCEPTION 'invalid_publish_key';
    END IF;
    resource_id := NULL;
    existing_resource_text := NULL;

    SELECT artifact_row.content ->> 'resourceId'
    INTO existing_resource_text
    FROM public.agent_artifacts AS artifact_row
    WHERE artifact_row.run_id = p_run_id
      AND artifact_row.publish_key = publish_key
      AND artifact_row.status = 'completed'
    FOR UPDATE;
    existing_artifact_found := FOUND;

    IF existing_artifact_found THEN
      IF existing_resource_text IS NULL THEN
        RAISE EXCEPTION 'published_artifact_invalid';
      END IF;
      resource_id := existing_resource_text::uuid;
    ELSE
      INSERT INTO public.resources (
        user_id, course_id, title, resource_type, content, chapter,
        status, source, agent_run_id, quality_status, quality_score
      )
      VALUES (
        p_user_id,
        run_row.course_id,
        coalesce(nullif(item ->> 'title', ''), resource_type),
        resource_type,
        coalesce(item -> 'content', '{}'::jsonb),
        left(coalesce(p_request, ''), 160),
        'completed',
        'ai',
        p_run_id,
        'approved',
        greatest(0, least(100, coalesce((item ->> 'quality_score')::numeric, 0)))
      )
      RETURNING id INTO resource_id;

      IF jsonb_typeof(item -> 'evidence') <> 'array'
         OR jsonb_array_length(item -> 'evidence') = 0 THEN
        RAISE EXCEPTION 'resource_evidence_required';
      END IF;

      INSERT INTO public.resource_evidence (
        resource_id, course_id, document_id, chunk_id,
        claim, citation_label, source_url, evidence_hash
      )
      SELECT
        resource_id,
        run_row.course_id,
        NULLIF(evidence_item.value ->> 'document_id', '')::uuid,
        NULLIF(evidence_item.value ->> 'chunk_id', '')::uuid,
        coalesce(nullif(evidence_item.value ->> 'claim', ''), '课程知识证据'),
        coalesce(nullif(evidence_item.value ->> 'citation_label', ''), '课程资料'),
        coalesce(evidence_item.value ->> 'source_url', ''),
        coalesce(
          nullif(evidence_item.value ->> 'evidence_hash', ''),
          md5(resource_id::text || ':' || coalesce(evidence_item.value ->> 'chunk_id', ''))
        )
      FROM jsonb_array_elements(item -> 'evidence') AS evidence_item(value)
      WHERE jsonb_typeof(evidence_item.value) = 'object';

      IF NOT FOUND THEN
        RAISE EXCEPTION 'resource_evidence_required';
      END IF;

      INSERT INTO public.agent_artifacts (
        run_id, artifact_type, publish_key, status, title, content, content_hash
      )
      VALUES (
        p_run_id,
        resource_type,
        publish_key,
        'completed',
        coalesce(nullif(item ->> 'title', ''), resource_type),
        jsonb_build_object('resourceId', resource_id, 'review', coalesce(item -> 'review', '{}'::jsonb)),
        md5(publish_key)
      )
      ON CONFLICT (run_id, publish_key) DO NOTHING;
    END IF;

    resource_ids := resource_ids || jsonb_build_array(resource_id);
    knowledge_point_ids := knowledge_point_ids || coalesce(item -> 'knowledge_point_ids', '[]'::jsonb);
    IF review_summary = '' THEN
      review_summary := coalesce(item -> 'review' ->> 'summary', '已通过质量审核');
    END IF;
  END LOOP;

  SELECT *
  INTO path_row
  FROM public.learning_paths
  WHERE user_id = p_user_id
    AND course_id = run_row.course_id
  ORDER BY updated_at DESC
  LIMIT 1
  FOR UPDATE;

  stage := jsonb_build_object(
    'id', gen_random_uuid()::text,
    'title', 'AI 学习：' || left(coalesce(p_request, ''), 80),
    'description', review_summary,
    'order', coalesce(jsonb_array_length(path_row.stages), 0) + 1,
    'resources', resource_ids,
    'knowledgePointIds', knowledge_point_ids,
    'resourceIds', resource_ids,
    'reason', review_summary,
    'completed', false,
    'sourceRunId', p_run_id::text,
    'status', 'available'
  );

  IF path_row.id IS NOT NULL THEN
    IF NOT (coalesce(path_row.stages, '[]'::jsonb) @> jsonb_build_array(jsonb_build_object('sourceRunId', p_run_id::text))) THEN
      UPDATE public.learning_paths
      SET stages = coalesce(stages, '[]'::jsonb) || jsonb_build_array(stage),
          reasoning = jsonb_build_object('reason', review_summary),
          version = coalesce(version, 1) + 1,
          updated_at = now()
      WHERE id = path_row.id;
    END IF;
  ELSE
    INSERT INTO public.learning_paths (
      user_id, course_id, title, stages, reasoning, version
    )
    VALUES (
      p_user_id,
      run_row.course_id,
      '个性化路径：' || left(coalesce(p_request, ''), 60),
      jsonb_build_array(stage),
      jsonb_build_object('reason', review_summary),
      1
    );
  END IF;

  RETURN jsonb_build_object('resourceIds', resource_ids);
END;
$$;

REVOKE ALL ON FUNCTION public.publish_agent_resources(uuid, uuid, text, jsonb, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.publish_agent_resources(uuid, uuid, text, jsonb, uuid) TO service_role;
