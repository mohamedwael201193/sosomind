-- SosoMind — Migration 006: Rev 43 Intelligence Features
-- Run in Supabase Dashboard → SQL Editor → Run

-- ── 1. Signal outcome tracking (outcomeEvaluator.ts) ─────────────────────────
ALTER TABLE public.signals
  ADD COLUMN IF NOT EXISTS outcome                text,              -- 'HIT' | 'STOP' | 'DRIFT'
  ADD COLUMN IF NOT EXISTS outcome_price          numeric(36,18),
  ADD COLUMN IF NOT EXISTS outcome_at             timestamptz,
  ADD COLUMN IF NOT EXISTS confidence_explanation text;              -- human-readable confidence badge

CREATE INDEX IF NOT EXISTS idx_signals_outcome ON public.signals (outcome)
  WHERE outcome IS NOT NULL;

-- ── 2. Agent KV meta store (track_record + future keys) ──────────────────────
CREATE TABLE IF NOT EXISTS public.agent_meta (
  key         text        PRIMARY KEY,
  value       jsonb       NOT NULL DEFAULT '{}'::jsonb,
  updated_at  timestamptz NOT NULL DEFAULT now()
);
