
-- 套餐SKU表（对应plans表中的付费套餐）
create table if not exists public.plan_skus (
    id uuid primary key default gen_random_uuid(),
    plan_id text not null,
    plan_name text not null,
    price_month numeric(10,2) not null default 0,
    price_year numeric(10,2) not null default 0,
    created_at timestamptz default now()
);

-- 订单状态枚举
do $$ begin
  create type order_status as enum ('pending', 'paid', 'cancelled', 'refunded');
exception when duplicate_object then null;
end $$;

-- 订单表
create table if not exists public.orders (
    id uuid primary key default gen_random_uuid(),
    order_no text unique not null,
    user_id uuid not null references auth.users(id),
    plan_id text not null,
    plan_name text not null,
    billing_cycle text not null default 'month', -- 'month' | 'year'
    amount numeric(12,2) not null,
    status order_status not null default 'pending'::order_status,
    wechat_pay_url text,
    paid_at timestamptz,
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);

-- RLS
alter table public.plan_skus enable row level security;
alter table public.orders enable row level security;

-- plan_skus: 所有人可读
create policy "plan_skus_select_all" on public.plan_skus
  for select using (true);

-- orders: 用户只能查自己的订单
create policy "orders_select_own" on public.orders
  for select using (auth.uid() = user_id);

create policy "orders_insert_own" on public.orders
  for insert with check (auth.uid() = user_id);

-- orders: service_role 可以 update（webhook 回调用）
create policy "orders_update_service" on public.orders
  for update using (true);

-- 初始化套餐SKU数据
insert into public.plan_skus (plan_id, plan_name, price_month, price_year) values
  ('basic', '基础版', 19, 168),
  ('pro', '高级版', 49, 428),
  ('enterprise', '专业版', 99, 828)
on conflict do nothing;
