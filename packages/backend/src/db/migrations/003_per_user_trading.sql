-- SosoMind — Migration 003: Per-User Non-Custodial Trading + Provenance
-- Run in Supabase Dashboard → SQL Editor (or via Supabase CLI)
-- Adds: signed_orders (per-user wallet trades), data_snapshots (signal provenance),
-- signals.citations column.

-- ────────────────────────────────────────────────
-- Signed Orders — every trade signed by the user's own wallet
-- The backend NEVER sees the private key. We only relay the signed payload.
-- ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS signed_orders (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid        REFERENCES user_profiles(id) ON DELETE SET NULL,
  wallet_address  text        NOT NULL,
  scope           text        NOT NULL CHECK (scope IN ('spot','futures')),
  action_name     text        NOT NULL,             -- e.g. 'batchNewOrder', 'batchCancelOrder', 'newOrder'
  market          text,                             -- e.g. 'vBTC_vUSDC'
  side            text,                             -- 'buy' | 'sell'
  quantity        numeric,
  price           numeric,
  order_type      text,                             -- 'limit' | 'market'
  nonce           bigint      NOT NULL,
  sig             text        NOT NULL,             -- 0x01-prefixed wire sig
  payload         jsonb       NOT NULL,             -- exact body that was signed
  sodex_response  jsonb,                            -- raw SoDEX REST response
  status          text        NOT NULL DEFAULT 'pending'
                              CHECK (status IN ('pending','submitted','filled','rejected','error','cancelled')),
  error_message   text,
  source          text        NOT NULL DEFAULT 'dashboard'
                              CHECK (source IN ('dashboard','telegram','api')),
  created_at      timestamptz NOT NULL DEFAULT now(),
  submitted_at    timestamptz,
  finalized_at    timestamptz
);
CREATE INDEX IF NOT EXISTS signed_orders_user_idx       ON signed_orders (user_id);
CREATE INDEX IF NOT EXISTS signed_orders_wallet_idx     ON signed_orders (wallet_address);
CREATE INDEX IF NOT EXISTS signed_orders_status_idx     ON signed_orders (status);
CREATE INDEX IF NOT EXISTS signed_orders_created_idx    ON signed_orders (created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS signed_orders_nonce_unique
  ON signed_orders (wallet_address, scope, nonce);

-- ────────────────────────────────────────────────
-- Data Snapshots — every upstream payload that fed a signal is stored
-- for deterministic replay. Hash-keyed so identical payloads dedupe.
-- ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS data_snapshots (
  hash            text        PRIMARY KEY,          -- sha256 of normalized payload
  source          text        NOT NULL,             -- 'sosovalue' | 'sodex' | 'binance' | 'coingecko'
  endpoint        text        NOT NULL,             -- e.g. '/openapi/v1/data/default/coin/getCoinTrending'
  params          jsonb,
  payload         jsonb       NOT NULL,             -- full upstream response
  fetched_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS data_snapshots_source_idx   ON data_snapshots (source);
CREATE INDEX IF NOT EXISTS data_snapshots_endpoint_idx ON data_snapshots (endpoint);
CREATE INDEX IF NOT EXISTS data_snapshots_fetched_idx  ON data_snapshots (fetched_at DESC);

-- ────────────────────────────────────────────────
-- Signal Citations — every signal carries a list of snapshot refs
-- that justify its conclusion. Judges can replay any number we cite.
-- ────────────────────────────────────────────────
ALTER TABLE signals
  ADD COLUMN IF NOT EXISTS citations jsonb DEFAULT '[]'::jsonb;

COMMENT ON COLUMN signals.citations IS
  'Array of {source, endpoint, hash, params, value, timestamp} — every numeric claim is auditable.';

-- ────────────────────────────────────────────────
-- Faucet Drips — track 1-click testnet USDC handouts so we cap abuse
-- ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS faucet_drips (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address  text        NOT NULL,
  ip              text,
  amount          numeric     NOT NULL,
  tx_hash         text,
  status          text        NOT NULL DEFAULT 'sent',
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS faucet_drips_wallet_idx  ON faucet_drips (wallet_address);
CREATE INDEX IF NOT EXISTS faucet_drips_created_idx ON faucet_drips (created_at DESC);
