-- 确保 user_profiles 允许触发器插入（SECURITY DEFINER 绕过 RLS）
-- 创建 handle_new_user 触发器函数（若已存在则替换）
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_profiles (id, email, phone)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.phone
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- 删除旧触发器（若存在）
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- 创建触发器
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- 修复 RLS：允许用户读写自己的 profile，同时允许 insert（首次创建时 auth.uid() 已可用）
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS users_own_profile ON public.user_profiles;
DROP POLICY IF EXISTS allow_insert_own_profile ON public.user_profiles;
DROP POLICY IF EXISTS allow_select_own_profile ON public.user_profiles;
DROP POLICY IF EXISTS allow_update_own_profile ON public.user_profiles;

CREATE POLICY "select_own_profile" ON public.user_profiles
  FOR SELECT TO authenticated USING (auth.uid() = id);

CREATE POLICY "insert_own_profile" ON public.user_profiles
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

CREATE POLICY "update_own_profile" ON public.user_profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);