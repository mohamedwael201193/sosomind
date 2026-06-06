import { supabase } from '../db/supabase';

interface CircuitState {
  consecutiveLosses: number;
  pausedUntil: number;
  perAssetBlockedUntil: Record<string, number>;
}

const state: CircuitState = {
  consecutiveLosses: 0,
  pausedUntil: 0,
  perAssetBlockedUntil: {},
};

const META_KEY = 'circuit_breaker';
const MAX_CONSECUTIVE_LOSSES = 3;
const LOSS_THRESHOLD_PCT = 0.05;
const GLOBAL_PAUSE_MS = 60 * 60 * 1000;
const ASSET_BLOCK_MS = 24 * 60 * 60 * 1000;
const ASSET_DROP_THRESHOLD_PCT = 0.15;

let loaded = false;

export async function loadCircuitBreakerState(): Promise<void> {
  if (loaded) return;
  try {
    const { data } = await supabase.from('agent_meta').select('value').eq('key', META_KEY).maybeSingle();
    if (data?.value && typeof data.value === 'object') {
      const v = data.value as Record<string, unknown>;
      state.consecutiveLosses = Number(v.consecutiveLosses ?? 0);
      state.pausedUntil = Number(v.pausedUntil ?? 0);
      state.perAssetBlockedUntil = (v.perAssetBlockedUntil as Record<string, number>) ?? {};
    }
  } catch (e) {
    console.warn('[CircuitBreaker] load failed', (e as Error).message);
  }
  loaded = true;
}

async function persistCircuitState(): Promise<void> {
  try {
    await supabase.from('agent_meta').upsert({
      key: META_KEY,
      value: {
        consecutiveLosses: state.consecutiveLosses,
        pausedUntil: state.pausedUntil,
        perAssetBlockedUntil: state.perAssetBlockedUntil,
        updatedAt: new Date().toISOString(),
      },
      updated_at: new Date().toISOString(),
    }, { onConflict: 'key' });
  } catch (e) {
    console.warn('[CircuitBreaker] persist failed', (e as Error).message);
  }
}

export function isGlobalCircuitOpen(): boolean {
  return Date.now() < state.pausedUntil;
}

export function isAssetBlocked(asset: string): boolean {
  const blockedUntil = state.perAssetBlockedUntil[asset.toUpperCase()] ?? 0;
  return Date.now() < blockedUntil;
}

export function assertTradingAllowed(asset?: string): { ok: boolean; reason?: string } {
  if (isGlobalCircuitOpen()) {
    return {
      ok: false,
      reason: `Circuit breaker open until ${new Date(state.pausedUntil).toISOString()}`,
    };
  }
  if (asset && isAssetBlocked(asset)) {
    return { ok: false, reason: `${asset.toUpperCase()} blocked by circuit breaker (24h asset pause)` };
  }
  return { ok: true };
}

export function recordTradeResult(asset: string, pnlPct: number): void {
  if (pnlPct < -LOSS_THRESHOLD_PCT) {
    state.consecutiveLosses++;
    if (state.consecutiveLosses >= MAX_CONSECUTIVE_LOSSES) {
      state.pausedUntil = Date.now() + GLOBAL_PAUSE_MS;
      console.warn(`[CircuitBreaker] GLOBAL OPEN — ${state.consecutiveLosses} consecutive losses. Trading paused 1h.`);
      state.consecutiveLosses = 0;
    }
  } else if (pnlPct > 0) {
    state.consecutiveLosses = 0;
  }
  void persistCircuitState();
}

export function checkAssetDrop(asset: string, priceChange24hPct: number): void {
  if (priceChange24hPct <= -ASSET_DROP_THRESHOLD_PCT * 100) {
    state.perAssetBlockedUntil[asset.toUpperCase()] = Date.now() + ASSET_BLOCK_MS;
    console.warn(`[CircuitBreaker] ASSET BLOCKED: ${asset} dropped ${priceChange24hPct.toFixed(1)}%. Blocked 24h.`);
    void persistCircuitState();
  }
}

export function getCircuitStatus() {
  const now = Date.now();
  return {
    globalOpen: isGlobalCircuitOpen(),
    globalPausedUntil: state.pausedUntil > now ? new Date(state.pausedUntil).toISOString() : null,
    consecutiveLosses: state.consecutiveLosses,
    wired: true,
    blockedAssets: Object.entries(state.perAssetBlockedUntil)
      .filter(([, until]) => until > now)
      .map(([asset, until]) => ({ asset, blockedUntil: new Date(until).toISOString() })),
  };
}

/** Estimate PnL % from entry vs fill for circuit breaker feedback */
export function estimatePnlPct(side: 'buy' | 'sell', entry: number, fill: number): number {
  if (!entry || !fill) return 0;
  return side === 'buy' ? ((fill - entry) / entry) * 100 : ((entry - fill) / entry) * 100;
}
