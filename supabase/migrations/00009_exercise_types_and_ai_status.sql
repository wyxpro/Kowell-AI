-- 补充题型与 AI 分析状态
ALTER TABLE exercises
  ADD COLUMN IF NOT EXISTS question_type text;

UPDATE exercises
SET question_type = CASE
  WHEN CASE WHEN jsonb_typeof(options) = 'array' THEN jsonb_array_length(options) ELSE 0 END > 0 THEN 'single'
  ELSE 'subjective'
END
WHERE question_type IS NULL
   OR question_type NOT IN ('single', 'multiple', 'subjective');

ALTER TABLE exercises
  ALTER COLUMN question_type SET DEFAULT 'single',
  ALTER COLUMN question_type SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'exercises'::regclass
      AND conname = 'exercises_question_type_check'
  ) THEN
    ALTER TABLE exercises
      ADD CONSTRAINT exercises_question_type_check
      CHECK (question_type IN ('single', 'multiple', 'subjective'));
  END IF;
END $$;

ALTER TABLE user_exercise_submissions
  ADD COLUMN IF NOT EXISTS ai_status text,
  ADD COLUMN IF NOT EXISTS ai_analysis text,
  ADD COLUMN IF NOT EXISTS ai_suggestions text,
  ADD COLUMN IF NOT EXISTS ai_request_id text;

UPDATE user_exercise_submissions
SET ai_status = CASE
  WHEN is_correct IS NOT NULL
    OR ai_score IS NOT NULL
    OR NULLIF(btrim(ai_feedback), '') IS NOT NULL THEN 'completed'
  ELSE 'skipped'
END
WHERE ai_status IS NULL
   OR ai_status NOT IN ('pending', 'completed', 'failed', 'skipped');

ALTER TABLE user_exercise_submissions
  ALTER COLUMN ai_status SET DEFAULT 'skipped',
  ALTER COLUMN ai_status SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'user_exercise_submissions'::regclass
      AND conname = 'submissions_ai_status_check'
  ) THEN
    ALTER TABLE user_exercise_submissions
      ADD CONSTRAINT submissions_ai_status_check
      CHECK (ai_status IN ('pending', 'completed', 'failed', 'skipped'));
  END IF;
END $$;

-- user_exercise_submissions 保留每次答题尝试；AI 重试只更新原 submission，不新增记录。
CREATE INDEX IF NOT EXISTS user_exercise_submissions_user_created_at
  ON user_exercise_submissions(user_id, created_at DESC);

-- 确保用户可更新自己的答题记录
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'user_exercise_submissions'
      AND cmd = 'UPDATE'
      AND COALESCE(qual, '') ~ '(user_id.*auth\.uid\(\)|auth\.uid\(\).*user_id)'
  ) THEN
    CREATE POLICY "submissions_update_own" ON user_exercise_submissions
      FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
  END IF;
END $$;

-- 仅允许用户向自己的资源写入题目
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'exercises'
      AND policyname = 'exercises_insert_own_resource'
  ) THEN
    CREATE POLICY "exercises_insert_own_resource" ON exercises
      FOR INSERT TO authenticated
      WITH CHECK (
        resource_id IS NOT NULL
        AND EXISTS (
          SELECT 1
          FROM resources
          WHERE resources.id = exercises.resource_id
            AND resources.user_id = auth.uid()
        )
      );
  END IF;
END $$;

-- 从有效的旧练习资源安全补建题目。旧 content 可能是 JSONB 数组，也可能是保存过的 JSON 字符串。
CREATE OR REPLACE FUNCTION public._kowell_try_parse_jsonb_00009(p_value text)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
SET search_path = pg_catalog, public
AS $$
BEGIN
  RETURN p_value::jsonb;
EXCEPTION WHEN others THEN
  RETURN NULL;
END;
$$;

WITH resource_payloads AS (
  SELECT
    r.id AS resource_id,
    CASE
      WHEN jsonb_typeof(r.content) = 'array' THEN r.content
      WHEN jsonb_typeof(r.content) = 'string'
        THEN public._kowell_try_parse_jsonb_00009(r.content #>> '{}')
      ELSE NULL
    END AS payload
  FROM resources r
  WHERE r.resource_type = 'exercise'
    AND r.status = 'completed'
),
raw_exercise_items AS (
  SELECT
    resource_payloads.resource_id,
    item.ordinality AS item_order,
    item.value AS item
  FROM resource_payloads
  CROSS JOIN LATERAL jsonb_array_elements(
    CASE
      WHEN jsonb_typeof(resource_payloads.payload) = 'array' THEN resource_payloads.payload
      ELSE '[]'::jsonb
    END
  ) WITH ORDINALITY AS item(value, ordinality)
  WHERE jsonb_typeof(resource_payloads.payload) = 'array'
    AND jsonb_typeof(item.value) = 'object'
),
exercise_items AS (
  SELECT DISTINCT ON (resource_id, btrim(item ->> 'question'))
    resource_id,
    item_order,
    item
  FROM raw_exercise_items
  WHERE NULLIF(btrim(item ->> 'question'), '') IS NOT NULL
    AND NOT EXISTS (
      SELECT 1
      FROM exercises e
      WHERE e.resource_id = raw_exercise_items.resource_id
        AND btrim(e.question) = btrim(raw_exercise_items.item ->> 'question')
    )
  ORDER BY resource_id, btrim(item ->> 'question'), item_order
),
prepared_items AS (
  SELECT
    exercise_items.*,
    CASE
      WHEN jsonb_typeof(item -> 'answer') = 'array' THEN item -> 'answer'
      WHEN jsonb_typeof(item -> 'answer') = 'string'
        THEN public._kowell_try_parse_jsonb_00009(item ->> 'answer')
      ELSE NULL
    END AS parsed_answer,
    CASE
      WHEN jsonb_typeof(item -> 'options') = 'array'
        THEN jsonb_array_length(item -> 'options')
      ELSE 0
    END AS raw_option_count
  FROM exercise_items
),
typed_items AS (
  SELECT
    prepared_items.*,
    CASE
      WHEN lower(btrim(item ->> 'question_type')) IN ('single', 'multiple', 'subjective')
        THEN lower(btrim(item ->> 'question_type'))
      WHEN raw_option_count > 0
        AND (
          jsonb_typeof(parsed_answer) = 'array'
          OR (
            jsonb_typeof(item -> 'answer') = 'string'
            AND item ->> 'answer' ~ '[,，、;；]'
            AND NOT EXISTS (
              SELECT 1
              FROM jsonb_array_elements_text(item -> 'options') AS exact_option(value)
              WHERE btrim(exact_option.value) = btrim(item ->> 'answer')
            )
          )
        ) THEN 'multiple'
      WHEN raw_option_count > 0 THEN 'single'
      ELSE 'subjective'
    END AS question_type
  FROM prepared_items
),
normalized_items AS (
  SELECT
    typed_items.*,
    option_stats.option_count,
    option_stats.distinct_option_count,
    option_stats.options_valid,
    option_stats.normalized_options
  FROM typed_items
  CROSS JOIN LATERAL (
    SELECT
      count(*)::int AS option_count,
      count(DISTINCT btrim(option_value.value #>> '{}'))::int AS distinct_option_count,
      COALESCE(bool_and(
        jsonb_typeof(option_value.value) = 'string'
        AND NULLIF(btrim(option_value.value #>> '{}'), '') IS NOT NULL
      ), true) AS options_valid,
      COALESCE(
        jsonb_agg(to_jsonb(btrim(option_value.value #>> '{}')) ORDER BY option_value.ordinality),
        '[]'::jsonb
      ) AS normalized_options
    FROM jsonb_array_elements(
      CASE
        WHEN jsonb_typeof(typed_items.item -> 'options') = 'array'
          THEN typed_items.item -> 'options'
        ELSE '[]'::jsonb
      END
    ) WITH ORDINALITY AS option_value(value, ordinality)
  ) AS option_stats
),
answer_tokens AS (
  SELECT
    normalized_items.resource_id,
    normalized_items.item_order,
    normalized_items.question_type,
    normalized_items.normalized_options,
    answer_token.value AS token
  FROM normalized_items
  CROSS JOIN LATERAL (
    SELECT btrim(normalized_items.item ->> 'answer') AS value
    WHERE normalized_items.question_type = 'single'
      AND jsonb_typeof(normalized_items.item -> 'answer') = 'string'

    UNION ALL

    SELECT btrim(array_answer.value #>> '{}')
    FROM jsonb_array_elements(
      CASE
        WHEN normalized_items.question_type = 'multiple'
          AND jsonb_typeof(normalized_items.parsed_answer) = 'array'
          THEN normalized_items.parsed_answer
        ELSE '[]'::jsonb
      END
    ) AS array_answer(value)
    WHERE jsonb_typeof(array_answer.value) = 'string'

    UNION ALL

    SELECT btrim(split_answer.value)
    FROM regexp_split_to_table(
      CASE
        WHEN normalized_items.question_type = 'multiple'
          AND jsonb_typeof(normalized_items.item -> 'answer') = 'string'
          AND jsonb_typeof(normalized_items.parsed_answer) IS DISTINCT FROM 'array'
          THEN normalized_items.item ->> 'answer'
        ELSE ''
      END,
      '[,，、;；]'
    ) AS split_answer(value)
    WHERE normalized_items.question_type = 'multiple'
      AND jsonb_typeof(normalized_items.item -> 'answer') = 'string'
      AND jsonb_typeof(normalized_items.parsed_answer) IS DISTINCT FROM 'array'
  ) AS answer_token
  WHERE NULLIF(answer_token.value, '') IS NOT NULL
),
normalized_tokens AS (
  SELECT
    answer_tokens.*,
    matched_option.option_text,
    matched_option.option_order
  FROM answer_tokens
  LEFT JOIN LATERAL (
    SELECT
      option_value.value AS option_text,
      option_value.ordinality AS option_order
    FROM jsonb_array_elements_text(answer_tokens.normalized_options)
      WITH ORDINALITY AS option_value(value, ordinality)
    WHERE btrim(option_value.value) = btrim(answer_tokens.token)
      OR (
        (
          btrim(answer_tokens.token) ~* '^\(?[A-Z]\)?$'
          OR btrim(answer_tokens.token) ~* '^\(?[A-Z]\)?[.、:：)）][[:space:]]*.+$'
          OR btrim(answer_tokens.token) ~* '^\(?[A-Z]\)?[[:space:]]+.+$'
        )
        AND option_value.ordinality = ascii(upper(substring(btrim(answer_tokens.token) FROM '^\(?([A-Za-z])'))) - ascii('A') + 1
        AND (
          btrim(answer_tokens.token) ~* '^\(?[A-Z]\)?$'
          OR btrim(option_value.value) = btrim(regexp_replace(
            btrim(answer_tokens.token),
            '^\(?[A-Za-z]\)?[.、:：)）]?[[:space:]]*',
            ''
          ))
        )
      )
    ORDER BY (btrim(option_value.value) = btrim(answer_tokens.token)) DESC, option_value.ordinality
    LIMIT 1
  ) AS matched_option ON true
),
answer_summary AS (
  SELECT
    resource_id,
    item_order,
    count(*)::int AS token_count,
    bool_and(option_text IS NOT NULL) AS all_tokens_valid
  FROM normalized_tokens
  GROUP BY resource_id, item_order
),
mapped_answer_options AS (
  SELECT DISTINCT
    resource_id,
    item_order,
    question_type,
    option_text,
    option_order
  FROM normalized_tokens
  WHERE option_text IS NOT NULL
),
normalized_answers AS (
  SELECT
    resource_id,
    item_order,
    question_type,
    CASE
      WHEN question_type = 'single' THEN min(option_text)
      WHEN question_type = 'multiple' THEN jsonb_agg(option_text ORDER BY option_order)::text
      ELSE NULL
    END AS normalized_answer
  FROM mapped_answer_options
  GROUP BY resource_id, item_order, question_type
)
INSERT INTO exercises (
  resource_id,
  question,
  options,
  answer,
  explanation,
  difficulty,
  question_type,
  ai_generated
)
SELECT
  normalized_items.resource_id,
  btrim(normalized_items.item ->> 'question'),
  CASE
    WHEN normalized_items.question_type IN ('single', 'multiple')
      THEN normalized_items.normalized_options
    ELSE '[]'::jsonb
  END,
  CASE
    WHEN normalized_items.question_type = 'subjective'
      THEN btrim(normalized_items.item ->> 'answer')
    ELSE normalized_answers.normalized_answer
  END,
  NULLIF(btrim(normalized_items.item ->> 'explanation'), ''),
  CASE
    WHEN lower(btrim(normalized_items.item ->> 'difficulty')) IN ('easy', 'medium', 'hard')
      THEN lower(btrim(normalized_items.item ->> 'difficulty'))
    ELSE 'medium'
  END,
  normalized_items.question_type,
  true
FROM normalized_items
LEFT JOIN answer_summary
  ON answer_summary.resource_id = normalized_items.resource_id
  AND answer_summary.item_order = normalized_items.item_order
LEFT JOIN normalized_answers
  ON normalized_answers.resource_id = normalized_items.resource_id
  AND normalized_answers.item_order = normalized_items.item_order
WHERE (
    normalized_items.question_type = 'subjective'
    AND normalized_items.option_count = 0
    AND jsonb_typeof(normalized_items.item -> 'answer') = 'string'
    AND NULLIF(btrim(normalized_items.item ->> 'answer'), '') IS NOT NULL
  )
  OR (
    normalized_items.question_type IN ('single', 'multiple')
    AND normalized_items.option_count > 0
    AND normalized_items.options_valid
    AND normalized_items.distinct_option_count = normalized_items.option_count
    AND answer_summary.token_count > 0
    AND answer_summary.all_tokens_valid
    AND normalized_answers.normalized_answer IS NOT NULL
    AND (normalized_items.question_type <> 'single' OR answer_summary.token_count = 1)
  );

DROP FUNCTION public._kowell_try_parse_jsonb_00009(text);
