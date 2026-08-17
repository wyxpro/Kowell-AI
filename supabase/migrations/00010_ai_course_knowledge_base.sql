-- AI 基础课程知识库：课程结构、公开资料证据与中文全文检索。
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 为现有课程和练习增加导入使用的稳定代码；不改变既有记录。
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS code text;
ALTER TABLE public.exercises ADD COLUMN IF NOT EXISTS code text;
ALTER TABLE public.exercises ADD COLUMN IF NOT EXISTS content_hash text;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.courses WHERE code IS NOT NULL GROUP BY code HAVING count(*) > 1) THEN
    RAISE EXCEPTION 'Cannot add courses(code) uniqueness: duplicate non-null course codes exist.';
  END IF;
  IF EXISTS (SELECT 1 FROM public.exercises WHERE code IS NOT NULL GROUP BY code HAVING count(*) > 1) THEN
    RAISE EXCEPTION 'Cannot add exercises(code) uniqueness: duplicate non-null exercise codes exist.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.courses'::regclass AND conname='courses_code_unique') THEN
    ALTER TABLE public.courses ADD CONSTRAINT courses_code_unique UNIQUE (code);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.exercises'::regclass AND conname='exercises_code_unique') THEN
    ALTER TABLE public.exercises ADD CONSTRAINT exercises_code_unique UNIQUE (code);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.course_modules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  code text NOT NULL,
  title text NOT NULL,
  summary text NOT NULL DEFAULT '',
  position integer NOT NULL CHECK (position > 0),
  objectives jsonb NOT NULL DEFAULT '[]'::jsonb,
  content_hash text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (course_id, code), UNIQUE (course_id, position), UNIQUE (course_id, id)
);

CREATE TABLE IF NOT EXISTS public.knowledge_points (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  module_id uuid NOT NULL,
  code text NOT NULL,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  position integer NOT NULL DEFAULT 1 CHECK (position > 0),
  content_hash text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (course_id, code), UNIQUE (course_id, module_id, position),
  CONSTRAINT knowledge_points_course_id_unique UNIQUE (course_id, id),
  FOREIGN KEY (course_id, module_id) REFERENCES public.course_modules(course_id, id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.knowledge_point_prerequisites (
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  knowledge_point_id uuid NOT NULL,
  prerequisite_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (knowledge_point_id, prerequisite_id), CHECK (knowledge_point_id <> prerequisite_id),
  FOREIGN KEY (course_id, knowledge_point_id) REFERENCES public.knowledge_points(course_id, id) ON DELETE CASCADE,
  FOREIGN KEY (course_id, prerequisite_id) REFERENCES public.knowledge_points(course_id, id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.course_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  module_id uuid,
  source_key text NOT NULL,
  title text NOT NULL,
  source_url text NOT NULL,
  license text NOT NULL,
  accessed_at date NOT NULL,
  content text NOT NULL DEFAULT '',
  content_hash text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (course_id, source_key), UNIQUE (course_id, id),
  FOREIGN KEY (course_id, module_id) REFERENCES public.course_modules(course_id, id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS public.course_document_chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  document_id uuid NOT NULL,
  module_id uuid,
  knowledge_point_id uuid,
  chunk_index integer NOT NULL CHECK (chunk_index >= 0),
  heading text,
  content text NOT NULL,
  content_hash text NOT NULL,
  search_vector tsvector NOT NULL DEFAULT ''::tsvector,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (document_id, chunk_index), UNIQUE (document_id, content_hash),
  CONSTRAINT course_document_chunks_course_id_unique UNIQUE (course_id, id),
  FOREIGN KEY (course_id, document_id) REFERENCES public.course_documents(course_id, id) ON DELETE CASCADE,
  FOREIGN KEY (course_id, module_id) REFERENCES public.course_modules(course_id, id) ON DELETE SET NULL
);

ALTER TABLE public.course_document_chunks ADD COLUMN IF NOT EXISTS knowledge_point_id uuid;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.course_document_chunks'::regclass AND conname='course_document_chunks_knowledge_point_fk') THEN
    ALTER TABLE public.course_document_chunks ADD CONSTRAINT course_document_chunks_knowledge_point_fk FOREIGN KEY (course_id, knowledge_point_id) REFERENCES public.knowledge_points(course_id, id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.resource_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_id uuid NOT NULL REFERENCES public.resources(id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  document_id uuid,
  chunk_id uuid,
  claim text NOT NULL, citation_label text NOT NULL, source_url text NOT NULL, evidence_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(), UNIQUE (resource_id, evidence_hash),
  FOREIGN KEY (course_id, document_id) REFERENCES public.course_documents(course_id, id) ON DELETE SET NULL,
  FOREIGN KEY (course_id, chunk_id) REFERENCES public.course_document_chunks(course_id, id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS public.exercise_knowledge_points (
  exercise_id uuid NOT NULL REFERENCES public.exercises(id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  knowledge_point_id uuid NOT NULL,
  weight numeric(4,3) NOT NULL DEFAULT 1 CHECK (weight > 0 AND weight <= 1),
  created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (exercise_id, knowledge_point_id),
  FOREIGN KEY (course_id, knowledge_point_id) REFERENCES public.knowledge_points(course_id, id) ON DELETE CASCADE
);

CREATE OR REPLACE FUNCTION public.set_course_document_chunk_search_vector()
RETURNS trigger LANGUAGE plpgsql SET search_path = public, pg_catalog AS $$
BEGIN
  NEW.search_vector := to_tsvector('simple', coalesce(NEW.heading, '') || ' ' || coalesce(NEW.content, ''));
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS course_document_chunks_search_vector ON public.course_document_chunks;
CREATE TRIGGER course_document_chunks_search_vector BEFORE INSERT OR UPDATE OF heading, content ON public.course_document_chunks
FOR EACH ROW EXECUTE FUNCTION public.set_course_document_chunk_search_vector();

CREATE INDEX IF NOT EXISTS course_modules_course_position_idx ON public.course_modules(course_id, position);
CREATE INDEX IF NOT EXISTS knowledge_points_course_module_idx ON public.knowledge_points(course_id, module_id, position);
CREATE INDEX IF NOT EXISTS knowledge_prerequisites_course_idx ON public.knowledge_point_prerequisites(course_id, prerequisite_id);
CREATE INDEX IF NOT EXISTS course_documents_course_module_idx ON public.course_documents(course_id, module_id);
CREATE INDEX IF NOT EXISTS course_document_chunks_course_document_idx ON public.course_document_chunks(course_id, document_id, chunk_index);
CREATE INDEX IF NOT EXISTS course_document_chunks_course_point_idx ON public.course_document_chunks(course_id, knowledge_point_id, chunk_index);
CREATE INDEX IF NOT EXISTS course_document_chunks_search_idx ON public.course_document_chunks USING gin(search_vector);
CREATE INDEX IF NOT EXISTS course_document_chunks_content_trgm_idx ON public.course_document_chunks USING gin(content gin_trgm_ops);
CREATE INDEX IF NOT EXISTS resource_evidence_resource_idx ON public.resource_evidence(resource_id, created_at DESC);
CREATE INDEX IF NOT EXISTS exercise_knowledge_points_course_idx ON public.exercise_knowledge_points(course_id, knowledge_point_id);

CREATE OR REPLACE FUNCTION public.search_course_knowledge(p_course_id uuid, p_query text, p_limit integer DEFAULT 20)
RETURNS TABLE (chunk_id uuid, document_id uuid, module_id uuid, knowledge_point_id uuid, heading text, content text, rank real)
LANGUAGE sql STABLE SET search_path = public, pg_catalog AS $$
  WITH q AS (SELECT websearch_to_tsquery('simple', trim(p_query)) AS value)
  SELECT c.id, c.document_id, c.module_id, c.knowledge_point_id, c.heading, c.content,
    greatest(ts_rank_cd(c.search_vector, q.value), similarity(c.content, trim(p_query)) * 0.15)::real
  FROM public.course_document_chunks c CROSS JOIN q
  WHERE c.course_id = p_course_id AND nullif(trim(p_query), '') IS NOT NULL
    AND c.knowledge_point_id IS NOT NULL
    AND (c.search_vector @@ q.value OR c.content % trim(p_query))
  ORDER BY 7 DESC, c.chunk_index LIMIT greatest(1, least(coalesce(p_limit, 20), 100));
$$;

ALTER TABLE public.course_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_point_prerequisites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_document_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resource_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exercise_knowledge_points ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='course_modules' AND policyname='course_modules_public_read') THEN CREATE POLICY "course_modules_public_read" ON public.course_modules FOR SELECT USING (true); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='knowledge_points' AND policyname='knowledge_points_public_read') THEN CREATE POLICY "knowledge_points_public_read" ON public.knowledge_points FOR SELECT USING (true); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='knowledge_point_prerequisites' AND policyname='knowledge_prerequisites_public_read') THEN CREATE POLICY "knowledge_prerequisites_public_read" ON public.knowledge_point_prerequisites FOR SELECT USING (true); END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='course_documents' AND policyname='course_documents_public_read') THEN DROP POLICY "course_documents_public_read" ON public.course_documents; END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='course_document_chunks' AND policyname='course_document_chunks_public_read') THEN DROP POLICY "course_document_chunks_public_read" ON public.course_document_chunks; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='resource_evidence' AND policyname='resource_evidence_owner_read') THEN CREATE POLICY "resource_evidence_owner_read" ON public.resource_evidence FOR SELECT USING (EXISTS (SELECT 1 FROM public.resources r WHERE r.id=resource_evidence.resource_id AND r.user_id=auth.uid())); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='exercise_knowledge_points' AND policyname='exercise_knowledge_points_public_read') THEN CREATE POLICY "exercise_knowledge_points_public_read" ON public.exercise_knowledge_points FOR SELECT USING (true); END IF;
END $$;
