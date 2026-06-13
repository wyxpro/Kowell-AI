
-- 今日待办表
CREATE TABLE daily_todos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  is_done boolean NOT NULL DEFAULT false,
  due_date date NOT NULL DEFAULT CURRENT_DATE,
  priority text NOT NULL DEFAULT 'medium' CHECK (priority IN ('low','medium','high')),
  source text NOT NULL DEFAULT 'manual' CHECK (source IN ('manual','path','ai')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE daily_todos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "todos_own" ON daily_todos FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- 笔记表
CREATE TABLE notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  resource_id uuid REFERENCES resources(id) ON DELETE SET NULL,
  title text NOT NULL DEFAULT '新笔记',
  content text NOT NULL DEFAULT '',
  tags text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notes_own" ON notes FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- 每日打卡表
CREATE TABLE user_check_ins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  check_date date NOT NULL DEFAULT CURRENT_DATE,
  study_minutes integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, check_date)
);
ALTER TABLE user_check_ins ENABLE ROW LEVEL SECURITY;
CREATE POLICY "checkin_own" ON user_check_ins FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- 徽章定义表（公开）
CREATE TABLE badges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  name text NOT NULL,
  description text NOT NULL,
  icon text NOT NULL,
  condition_type text NOT NULL,
  condition_value integer NOT NULL DEFAULT 1,
  rarity text NOT NULL DEFAULT 'common' CHECK (rarity IN ('common','rare','epic','legendary')),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE badges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "badges_read" ON badges FOR SELECT USING (true);

-- 用户徽章表
CREATE TABLE user_badges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  badge_id uuid NOT NULL REFERENCES badges(id) ON DELETE CASCADE,
  unlocked_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, badge_id)
);
ALTER TABLE user_badges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_badges_own" ON user_badges FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "user_badges_read" ON user_badges FOR SELECT USING (true);

-- 学习报告表
CREATE TABLE study_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  period_type text NOT NULL CHECK (period_type IN ('weekly','monthly')),
  period_start date NOT NULL,
  period_end date NOT NULL,
  total_minutes integer NOT NULL DEFAULT 0,
  total_resources integer NOT NULL DEFAULT 0,
  total_exercises integer NOT NULL DEFAULT 0,
  correct_rate numeric(5,2) NOT NULL DEFAULT 0,
  ai_summary text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, period_type, period_start)
);
ALTER TABLE study_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reports_own" ON study_reports FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- 插入预设徽章数据
INSERT INTO badges (key, name, description, icon, condition_type, condition_value, rarity) VALUES
('first_login',      '初来乍到',   '首次登录智学伴',            '🌟', 'login_count',   1,   'common'),
('check_in_3',       '学习新苗',   '连续打卡3天',               '🌱', 'streak_days',   3,   'common'),
('check_in_7',       '坚持一周',   '连续打卡7天',               '🔥', 'streak_days',   7,   'rare'),
('check_in_30',      '月度达人',   '连续打卡30天',              '🏆', 'streak_days',   30,  'epic'),
('resources_5',      '知识探索者', '累计学习5个资源',           '📚', 'resources_read', 5,  'common'),
('resources_20',     '学霸养成',   '累计学习20个资源',          '🎓', 'resources_read', 20, 'rare'),
('notes_10',         '勤记录者',   '累计创建10条笔记',          '📝', 'notes_count',   10,  'common'),
('todos_20',         '任务达人',   '累计完成20个待办任务',      '✅', 'todos_done',    20,  'rare'),
('evaluation_pass',  '初试锋芒',   '完成第一次学习评估',        '⚡', 'eval_count',    1,   'common'),
('perfect_score',    '完美主义者', '评估获得满分',              '💯', 'perfect_eval',  1,   'epic'),
('community_post',   '活跃分子',   '在社群发布第一条帖子',      '💬', 'post_count',    1,   'common'),
('study_10h',        '学习达人',   '累计学习时长超过10小时',    '⏰', 'total_minutes', 600, 'rare'),
('study_100h',       '百小时学者', '累计学习时长超过100小时',   '🌙', 'total_minutes', 6000,'legendary'),
('wrong_book_master','错题终结者', '错题本全部标记为已掌握',    '🎯', 'wrong_mastered', 10, 'epic');
