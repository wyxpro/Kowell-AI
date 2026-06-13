
alter table public.user_profiles
  add column if not exists plan_id text default 'free',
  add column if not exists plan_updated_at timestamptz;
