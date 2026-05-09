import { sosovalue } from '../clients/sosovalue';
import { supabase, logAgent } from '../db/supabase';

/**
 * Heartbeat: scans market and triggers any active alerts whose condition is met.
 * Designed to run every few minutes (e.g. cron every 5m).
 */
export async function runHeartbeat() {
  const startedAt = Date.now();
  const { data: alerts } = await supabase.from('alerts').select('*').eq('is_active', true);
  if (!alerts?.length) {
    await logAgent({ agent: 'cron', action: 'heartbeat:no_alerts', duration_ms: Date.now() - startedAt });
    return { triggered: 0 };
  }

  const symbols = Array.from(new Set(alerts.map((a: any) => a.asset).filter(Boolean)));
  const priceMap = new Map<string, number>();
  for (const sym of symbols) {
    try {
      const snap: any = await sosovalue.getMarketSnapshot(sym);
      const p = Number(snap?.price ?? snap?.last_price ?? 0);
      if (Number.isFinite(p) && p > 0) priceMap.set(sym, p);
    } catch (e) {
      await logAgent({ agent: 'cron', action: 'heartbeat:snap_failed', level: 'warn', error: `${sym}: ${(e as Error).message}` });
    }
  }

  let triggered = 0;
  for (const a of alerts) {
    const price = priceMap.get(a.asset);
    if (price == null) continue;
    const t = Number(a.threshold);
    const hit = (a.type === 'price_above' && price > t) || (a.type === 'price_below' && price < t);
    if (hit) {
      await supabase.from('alerts').update({ triggered_at: new Date().toISOString(), is_active: false }).eq('id', a.id);
      triggered++;
    }
  }

  await logAgent({
    agent: 'cron',
    action: 'heartbeat:complete',
    output: { scanned: alerts.length, triggered },
    duration_ms: Date.now() - startedAt,
  });
  return { triggered };
}
