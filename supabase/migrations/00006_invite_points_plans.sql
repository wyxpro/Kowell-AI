
-- ─── 套餐表 ───────────────────────────────────────────────────
CREATE TABLE plans (
  id          text PRIMARY KEY,           -- 'free' | 'basic' | 'pro' | 'enterprise'
  name        text NOT NULL,
  price_month numeric(10,2) NOT NULL DEFAULT 0,
  price_year  numeric(10,2) NOT NULL DEFAULT 0,
  features    jsonb NOT NULL DEFAULT '[]',
  sort_order  int  NOT NULL DEFAULT 0
);

INSERT INTO plans (id, name, price_month, price_year, features, sort_order) VALUES
('free',       '免费版', 0,     0,     '["每月生成资源10次","基础学习路径","社群浏览"]'::jsonb,       1),
('basic',      '基础版', 19.9,  199,   '["每月生成资源50次","个性化学习路径","答疑中心","错题本"]'::jsonb, 2),
('pro',        '高级版', 49.9,  499,   '["每月生成资源200次","高级学习路径","AI深度答疑","全部工具箱","优先客服"]'::jsonb, 3),
('enterprise', '专业版', 99.9,  999,   '["无限生成资源","专属学习顾问","团队协作","数据导出","API接入"]'::jsonb, 4);

-- ─── 用户套餐订阅 ──────────────────────────────────────────────
CREATE TABLE user_subscriptions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id     text NOT NULL REFERENCES plans(id),
  started_at  timestamptz NOT NULL DEFAULT now(),
  expires_at  timestamptz,
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX user_subscriptions_active_user ON user_subscriptions(user_id) WHERE is_active = true;
CREATE INDEX user_subscriptions_user_id ON user_subscriptions(user_id);

-- ─── 邀请码表 ─────────────────────────────────────────────────
CREATE TABLE invite_codes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code        text NOT NULL UNIQUE,
  used_count  int  NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX invite_codes_user ON invite_codes(user_id);

-- ─── 邀请记录 ─────────────────────────────────────────────────
CREATE TABLE invite_records (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inviter_id   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invitee_id   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE(invitee_id)  -- 每人只能被邀请一次
);

CREATE INDEX invite_records_inviter ON invite_records(inviter_id);

-- ─── 积分账户 ─────────────────────────────────────────────────
CREATE TABLE point_accounts (
  user_id  uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  balance  int  NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ─── 积分流水 ─────────────────────────────────────────────────
CREATE TYPE point_action AS ENUM (
  'invite_friend',
  'task_complete',
  'sign_in',
  'redeem_plan',
  'admin_adjust',
  'other'
);

CREATE TABLE point_transactions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  delta       int  NOT NULL,            -- 正数=获取，负数=消费
  action      point_action NOT NULL,
  note        text,
  ref_id      uuid,                     -- 关联邀请记录/订单等
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX point_transactions_user ON point_transactions(user_id, created_at DESC);

-- ─── 辅助函数：获取当前用户邀请码（不存在时自动创建）────────
CREATE OR REPLACE FUNCTION get_or_create_invite_code(p_user_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_code text;
BEGIN
  SELECT code INTO v_code FROM invite_codes WHERE user_id = p_user_id;
  IF v_code IS NULL THEN
    v_code := upper(substring(replace(gen_random_uuid()::text, '-', '') FROM 1 FOR 8));
    INSERT INTO invite_codes(user_id, code) VALUES (p_user_id, v_code)
    ON CONFLICT (user_id) DO UPDATE SET code = EXCLUDED.code
    RETURNING code INTO v_code;
  END IF;
  RETURN v_code;
END;
$$;

-- ─── RLS ──────────────────────────────────────────────────────
ALTER TABLE plans              ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE invite_codes       ENABLE ROW LEVEL SECURITY;
ALTER TABLE invite_records     ENABLE ROW LEVEL SECURITY;
ALTER TABLE point_accounts     ENABLE ROW LEVEL SECURITY;
ALTER TABLE point_transactions ENABLE ROW LEVEL SECURITY;

-- plans 所有人可读
CREATE POLICY "plans_public_read" ON plans FOR SELECT USING (true);

-- user_subscriptions
CREATE POLICY "subscriptions_own" ON user_subscriptions FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "subscriptions_insert_own" ON user_subscriptions FOR INSERT WITH CHECK (user_id = auth.uid());

-- invite_codes
CREATE POLICY "invite_codes_own" ON invite_codes FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "invite_codes_insert_own" ON invite_codes FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "invite_codes_update_own" ON invite_codes FOR UPDATE USING (user_id = auth.uid());

-- invite_records
CREATE POLICY "invite_records_inviter" ON invite_records FOR SELECT USING (inviter_id = auth.uid());
CREATE POLICY "invite_records_insert" ON invite_records FOR INSERT WITH CHECK (invitee_id = auth.uid());

-- point_accounts
CREATE POLICY "points_own" ON point_accounts FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "points_insert_own" ON point_accounts FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "points_update_own" ON point_accounts FOR UPDATE USING (user_id = auth.uid());

-- point_transactions
CREATE POLICY "point_tx_own" ON point_transactions FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "point_tx_insert_own" ON point_transactions FOR INSERT WITH CHECK (user_id = auth.uid());
