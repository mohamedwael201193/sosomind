-- SosoMind initial schema (paste into Supabase → SQL Editor → Run)
create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  email text unique,
  telegram_id text unique,
  telegram_username text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.portfolios (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade,
  name text default 'Main Portfolio',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.positions (
  id uuid primary key default gen_random_uuid(),
  portfolio_id uuid references public.portfolios(id) on delete cascade,
  market text not null,
  side text not null,
  size numeric(36,18) not null,
  entry_price numeric(36,18) not null,
  mark_price numeric(36,18),
  unrealized_pnl numeric(36,18),
  realized_pnl numeric(36,18),
  status text default 'open',
  sodex_order_id text,
  opened_at timestamptz default now(),
  closed_at timestamptz
);
create index if not exists idx_positions_portfolio on public.positions(portfolio_id);
create index if not exists idx_positions_status on public.positions(status);

create table if not exists public.signals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade,
  asset text not null,
  symbol text,
  direction text not null,
  confidence integer not null,
  reasoning text,
  entry numeric(36,18),
  stop_loss numeric(36,18),
  take_profit numeric(36,18),
  sources jsonb default '[]'::jsonb,
  status text default 'active',
  expires_at timestamptz,
  created_at timestamptz default now()
);
create index if not exists idx_signals_user_status on public.signals(user_id, status);
create index if not exists idx_signals_asset_created on public.signals(asset, created_at desc);

create table if not exists public.trades (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade,
  signal_id uuid references public.signals(id) on delete set null,
  market text not null,
  side text not null,
  price numeric(36,18) not null,
  amount numeric(36,18) not null,
  total numeric(36,18),
  order_type text default 'limit',
  status text default 'pending',
  sodex_order_id text,
  tx_hash text,
  fee numeric(36,18),
  slippage numeric(10,4),
  confirmed_by text,
  executed_at timestamptz,
  created_at timestamptz default now()
);
create index if not exists idx_trades_user_status on public.trades(user_id, status);

create table if not exists public.alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade,
  type text not null,
  asset text,
  condition text,
  threshold numeric(36,18),
  message text,
  is_active boolean default true,
  triggered_at timestamptz,
  created_at timestamptz default now()
);
create index if not exists idx_alerts_user_active on public.alerts(user_id, is_active);

create table if not exists public.agent_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete set null,
  agent text not null,
  level text default 'info',
  action text not null,
  input jsonb,
  output jsonb,
  duration_ms integer,
  error text,
  created_at timestamptz default now()
);
create index if not exists idx_agent_logs_agent on public.agent_logs(agent, created_at desc);

create table if not exists public.news_cache (
  id uuid primary key default gen_random_uuid(),
  cache_key text unique not null,
  payload jsonb not null,
  expires_at timestamptz not null,
  created_at timestamptz default now()
);
create index if not exists idx_news_cache_expires on public.news_cache(expires_at);

create table if not exists public.content_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade,
  title text not null,
  body text not null,
  summary text,
  chart_url text,
  sector text,
  symbols text[],
  sentiment text,
  confidence integer,
  telegram_message_id text,
  telegram_channel_id text,
  published_at timestamptz,
  created_at timestamptz default now()
);

create table if not exists public.subscribers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade,
  telegram_id text unique not null,
  username text,
  first_name text,
  last_name text,
  interests text[],
  risk_profile text,
  joined_at timestamptz default now(),
  last_active_at timestamptz default now()
);

alter table public.users disable row level security;
alter table public.portfolios disable row level security;
alter table public.positions disable row level security;
alter table public.signals disable row level security;
alter table public.trades disable row level security;
alter table public.alerts disable row level security;
alter table public.agent_logs disable row level security;
alter table public.news_cache disable row level security;
alter table public.content_posts disable row level security;
alter table public.subscribers disable row level security;
