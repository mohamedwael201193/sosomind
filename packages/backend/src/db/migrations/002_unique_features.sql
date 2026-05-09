-- SosoMind — Migration 002: Unique Features Tables
-- Run in Supabase Dashboard → SQL Editor

-- ────────────────────────────────────────────────
-- Paper Trades (Part 7)
-- ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS paper_trades (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         text        NOT NULL,
  symbol          text        NOT NULL,
  side            text        NOT NULL CHECK (side IN ('buy','sell')),
  entry_price     numeric     NOT NULL,
  amount          numeric     NOT NULL,
  exit_price      numeric,
  pnl             numeric,
  pnl_pct         numeric,
  status          text        NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed')),
  created_at      timestamptz DEFAULT now(),
  closed_at       timestamptz
);
CREATE INDEX IF NOT EXISTS paper_trades_user_idx ON paper_trades (user_id);
CREATE INDEX IF NOT EXISTS paper_trades_status_idx ON paper_trades (status);

-- ────────────────────────────────────────────────
-- Published Signals / Signal Marketplace (Part 2)
-- ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS published_signals (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id      text        NOT NULL,
  creator_name    text,
  signal_id       uuid        REFERENCES signals(id) ON DELETE SET NULL,
  asset           text        NOT NULL,
  direction       text        NOT NULL,
  confidence      numeric,
  entry           numeric,
  take_profit     numeric,
  stop_loss       numeric,
  reasoning       text,
  followers_count integer     DEFAULT 0,
  copies_count    integer     DEFAULT 0,
  result          text,       -- 'win' | 'loss' | 'pending'
  result_pnl      numeric,
  created_at      timestamptz DEFAULT now(),
  expires_at      timestamptz
);
CREATE INDEX IF NOT EXISTS pub_signals_creator_idx ON published_signals (creator_id);
CREATE INDEX IF NOT EXISTS pub_signals_created_idx ON published_signals (created_at DESC);

-- ────────────────────────────────────────────────
-- Signal Followers (Part 2)
-- ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS signal_follows (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id     text        NOT NULL,
  creator_id      text        NOT NULL,
  auto_copy       boolean     DEFAULT false,
  max_position_pct numeric    DEFAULT 5,
  created_at      timestamptz DEFAULT now(),
  UNIQUE(follower_id, creator_id)
);

-- ────────────────────────────────────────────────
-- Macro Strategies / Playbook (Part 5)
-- ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS macro_strategies (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         text,
  name            text        NOT NULL,
  trigger_event   text        NOT NULL,
  trigger_condition text      NOT NULL,
  trigger_value   numeric     NOT NULL,
  trigger_value2  numeric,
  action_asset    text        NOT NULL,
  action_direction text       NOT NULL,
  action_size_pct numeric     NOT NULL DEFAULT 10,
  action_sl_pct   numeric     NOT NULL DEFAULT 5,
  action_tp_pct   numeric     NOT NULL DEFAULT 12,
  action_tif_hours integer    DEFAULT 72,
  active          boolean     DEFAULT true,
  auto_execute    boolean     DEFAULT false,
  backtest_win_rate numeric,
  backtest_avg_return numeric,
  backtest_max_dd numeric,
  backtest_trades integer,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS macro_strats_user_idx ON macro_strategies (user_id);
CREATE INDEX IF NOT EXISTS macro_strats_active_idx ON macro_strategies (active);

-- ────────────────────────────────────────────────
-- Trader Personas (Part 14)
-- ────────────────────────────────────────────────
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS persona text DEFAULT 'balanced';
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS persona_config jsonb DEFAULT '{}'::jsonb;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS onboarded boolean DEFAULT false;

-- ────────────────────────────────────────────────
-- Whale Alerts (Part 4)
-- ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS whale_alerts (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  type            text        NOT NULL,
  asset           text        NOT NULL,
  amount_usd      numeric,
  entity          text,
  impact          text        NOT NULL DEFAULT 'medium',
  signal_direction text,
  reasoning       text,
  source          text,
  created_at      timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS whale_alerts_created_idx ON whale_alerts (created_at DESC);
CREATE INDEX IF NOT EXISTS whale_alerts_asset_idx ON whale_alerts (asset);

-- ────────────────────────────────────────────────
-- Playbook Executions (Part 5)
-- ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS playbook_executions (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  strategy_id     uuid        REFERENCES macro_strategies(id) ON DELETE CASCADE,
  user_id         text,
  triggered_by    text,
  signal_id       uuid,
  trade_id        uuid,
  status          text        DEFAULT 'triggered',
  created_at      timestamptz DEFAULT now()
);

-- ────────────────────────────────────────────────
-- Confluence Cache (Part 8)
-- ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS confluence_cache (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  asset           text        NOT NULL,
  overall_direction text      NOT NULL,
  confluence_score numeric    NOT NULL,
  timeframe_data  jsonb,
  recommendation  text,
  created_at      timestamptz DEFAULT now(),
  UNIQUE(asset)
);

-- ────────────────────────────────────────────────
-- Funding Rate Signals (Part 15)
-- ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS funding_signals (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  asset           text        NOT NULL,
  funding_rate    numeric     NOT NULL,
  annualized_rate numeric,
  signal          text        NOT NULL,
  strength        numeric     DEFAULT 50,
  reasoning       text,
  created_at      timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS funding_signals_created_idx ON funding_signals (created_at DESC);
