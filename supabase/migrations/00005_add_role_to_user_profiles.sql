ALTER TABLE user_profiles ADD COLUMN role text NOT NULL DEFAULT 'user';
COMMENT ON COLUMN user_profiles.role IS '用户角色：user/admin';
UPDATE user_profiles SET role = 'admin' WHERE email = '438105365@qq.com';
