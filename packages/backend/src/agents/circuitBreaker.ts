import { supabase, logAgent } from '../db/supabase';

interface CircuitState {
  consecutiveLosses: number;
  pausedUntil: number;
  perAssetBlockedUntil: Map<string, number>;
}

const state: CircuitState = {
  consecutiveLosses: 0,
  pausedUntil: 0,
  perAssetBlockedUntil: new Map(),
};

const MAX_CONSECUTIVE_LOSSES = 3;
const LOSS_THRESHOLD_PCT = 0.05; // 5% per trade
const GLOBAL_PAUSE_MS = 60 * 60 * 1000; // 1 hour
const ASSET_BLOCK_MS = 24 * 60 * 60 * 1000; // 24 hours
const ASSET_DROP_THRESHOLD_PCT = 0.15; // 15% 24h drop

export function isGlobalCircuitOpen(): boolean {
  return Date.now() < state.pausedUntil;
}

export function isAssetBlocked(asset: string): boolean {
  const blockedUntil = state.perAssetBlockedUntil.get(asset.toUpperCase()) ?? 0;
  return Date.now() < blockedUntil;
}

export function recordTradeResult(asset: string, pnlPct: number): void {
  if (pnlPct < -LOSS_THRESHOLD_PCT) {
    state.consecutiveLosses++;
    if (state.consecutiveLosses >= MAX_CONSECUTIVE_LOSSES) {
      state.pausedUntil = Date.now() + GLOBAL_PAUSE_MS;
      console.warn(`[CircuitBreaker] GLOBAL OPEN — ${state.consecutiveLosses} consecutive losses. Trading paused 1h.`);
      state.consecutiveLosses = 0;
    }
  } else {
    state.consecutiveLosses = 0;
  }
}

export function checkAssetDrop(asset: string, priceChange24hPct: number): void {
  if (priceChange24hPct <= -ASSET_DROP_THRESHOLD_PCT * 100) {
    state.perAssetBlockedUntil.set(asset.toUpperCase(), Date.now() + ASSET_BLOCK_MS);
    console.warn(`[CircuitBreaker] ASSET BLOCKED: ${asset} dropped ${priceChange24hPct.toFixed(1)}%. Blocked 24h.`);
  }
}

export function getCircuitStatus() {
  const now = Date.now();
  return {
    globalOpen: isGlobalCircuitOpen(),
    globalPausedUntil: state.pausedUntil > now ? new Date(state.pausedUntil).toISOString() : null,
    consecutiveLosses: state.consecutiveLosses,
    blockedAssets: Array.from(state.perAssetBlockedUntil.entries())
      .filter(([, until]) => until > now)
      .map(([asset, until]) => ({ asset, blockedUntil: new Date(until).toISOString() })),
  };
}
