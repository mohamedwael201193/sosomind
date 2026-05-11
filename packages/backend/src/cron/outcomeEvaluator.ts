/**
 * Outcome Evaluator — hourly cron job
 *
 * Evaluates pending signals older than 24h against live prices.
 * Classification:
 *   HIT   — price reached takeProfit  (within 0.5% tolerance)
 *   STOP  — price hit stopLoss        (within 0.5% tolerance)
 *   DRIFT — open > 72h with no resolution → mark expired
 *
 * Persists outcome to `signals` table and aggregates stats to `agent_meta` KV
 * under key 'track_record'.
 */
import { supabase } from '../db/supabase';
import { getMarketContext } from '../clients/market';

export interface OutcomeStats {
  hit_rate: number;         // 0–1 fraction of HIT / (HIT+STOP)
  evaluated_count: number;
  avg_return_pct: number;   // average % return (positive = gain)
  by_direction: Record<string, { hits: number; stops: number; total: number }>;
  by_asset: Record<string, { hits: number; stops: number; total: number }>;
  last_updated: string;
}

async function getLivePrice(asset: string): Promise<number | null> {
  try {
    const ctx = await getMarketContext(asset);
    const p = ctx?.ticker?.price ?? null;
    return p != null ? Number(p) : null;
  } catch {
    return null;
  }
}

export async function runOutcomeEvaluation(): Promise<OutcomeStats> {
  const now = new Date();
  const cutoff24h = new Date(now.getTime() - 24 * 3600 * 1000).toISOString();
  const cutoff72h = new Date(now.getTime() - 72 * 3600 * 1000).toISOString();

  // Fetch active signals older than 24h that have entry+tp+sl defined
  const { data: pending, error: fetchErr } = await supabase
    .from('signals')
    .select('id, asset, direction, entry, take_profit, stop_loss, confidence, created_at')
    .eq('status', 'active')
    .lt('created_at', cutoff24h)
    .not('take_profit', 'is', null)
    .not('stop_loss', 'is', null)
    .limit(200);

  if (fetchErr) {
    console.error('[outcomeEval] fetch error', fetchErr.message);
    return buildStats([]);
  }

  if (!pending || pending.length === 0) {
    return buildStats([]);
  }

  const resolved: Array<{
    id: string;
    asset: string;
    direction: string;
    outcome: 'HIT' | 'STOP' | 'DRIFT';
    entry: number;
    take_profit: number;
    stop_loss: number;
    outcome_price: number | null;
  }> = [];

  for (const sig of pending) {
    const entry = Number(sig.entry ?? 0);
    const tp = Number(sig.take_profit ?? 0);
    const sl = Number(sig.stop_loss ?? 0);
    if (!entry || !tp || !sl) continue;

    // Signals older than 72h with no resolution → DRIFT
    if (sig.created_at < cutoff72h) {
      await supabase
        .from('signals')
        .update({ status: 'expired', outcome: 'DRIFT', outcome_at: now.toISOString() })
        .eq('id', sig.id);
      resolved.push({
        id: sig.id,
        asset: sig.asset,
        direction: sig.direction,
        outcome: 'DRIFT',
        entry,
        take_profit: tp,
        stop_loss: sl,
        outcome_price: null,
      });
      continue;
    }

    const livePrice = await getLivePrice(sig.asset);
    if (livePrice == null) continue;

    const hitTp = sig.direction === 'long'
      ? livePrice >= tp * 0.995
      : livePrice <= tp * 1.005;
    const hitSl = sig.direction === 'long'
      ? livePrice <= sl * 1.005
      : livePrice >= sl * 0.995;

    let outcome: 'HIT' | 'STOP' | null = null;
    if (hitTp) outcome = 'HIT';
    else if (hitSl) outcome = 'STOP';

    if (outcome) {
      await supabase
        .from('signals')
        .update({
          status: 'expired',
          outcome,
          outcome_price: livePrice,
          outcome_at: now.toISOString(),
        })
        .eq('id', sig.id);
      resolved.push({
        id: sig.id,
        asset: sig.asset,
        direction: sig.direction,
        outcome,
        entry,
        take_profit: tp,
        stop_loss: sl,
        outcome_price: livePrice,
      });
    }
  }

  const stats = buildStats(resolved);

  // Persist aggregated stats to agent_meta KV (upsert)
  await supabase
    .from('agent_meta')
    .upsert({ key: 'track_record', value: stats, updated_at: now.toISOString() }, { onConflict: 'key' });

  console.log(`[outcomeEval] evaluated ${resolved.length} signals — hit_rate=${(stats.hit_rate * 100).toFixed(1)}%`);
  return stats;
}

function buildStats(resolved: Array<{
  asset: string;
  direction: string;
  outcome: 'HIT' | 'STOP' | 'DRIFT';
  entry: number;
  take_profit: number;
  stop_loss: number;
  outcome_price: number | null;
}>): OutcomeStats {
  const decisive = resolved.filter((r) => r.outcome === 'HIT' || r.outcome === 'STOP');
  const hits = decisive.filter((r) => r.outcome === 'HIT');
  const stops = decisive.filter((r) => r.outcome === 'STOP');

  const hit_rate = decisive.length > 0 ? hits.length / decisive.length : 0;

  const returns = decisive.map((r) => {
    if (r.outcome === 'HIT') {
      const rPct = r.direction === 'long'
        ? ((r.take_profit - r.entry) / r.entry) * 100
        : ((r.entry - r.take_profit) / r.entry) * 100;
      return Math.max(-100, Math.min(rPct, 300));
    } else {
      const rPct = r.direction === 'long'
        ? ((r.stop_loss - r.entry) / r.entry) * 100
        : ((r.entry - r.stop_loss) / r.entry) * 100;
      return Math.max(-100, Math.min(rPct, 300));
    }
  });

  const avg_return_pct = returns.length > 0
    ? returns.reduce((a, b) => a + b, 0) / returns.length
    : 0;

  // Aggregate by direction
  const by_direction: Record<string, { hits: number; stops: number; total: number }> = {};
  for (const r of decisive) {
    const dir = r.direction ?? 'unknown';
    if (!by_direction[dir]) by_direction[dir] = { hits: 0, stops: 0, total: 0 };
    by_direction[dir].total++;
    if (r.outcome === 'HIT') by_direction[dir].hits++;
    else by_direction[dir].stops++;
  }

  // Aggregate by asset
  const by_asset: Record<string, { hits: number; stops: number; total: number }> = {};
  for (const r of decisive) {
    const asset = r.asset ?? 'unknown';
    if (!by_asset[asset]) by_asset[asset] = { hits: 0, stops: 0, total: 0 };
    by_asset[asset].total++;
    if (r.outcome === 'HIT') by_asset[asset].hits++;
    else by_asset[asset].stops++;
  }

  return {
    hit_rate: Math.round(hit_rate * 1000) / 1000,
    evaluated_count: decisive.length,
    avg_return_pct: Math.round(avg_return_pct * 10) / 10,
    by_direction,
    by_asset,
    last_updated: new Date().toISOString(),
  };
}
