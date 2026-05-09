import { sosovalue } from '../clients/sosovalue';
import { runResearchAgent } from '../agents/research';
import { getSubscribers, logAgent, createSignal } from '../db/supabase';

export interface Anomaly {
  type: string;
  asset?: string;
  message: string;
  severity: 'low' | 'medium' | 'high';
}

export async function scanAnomalies(): Promise<Anomaly[]> {
  const anomalies: Anomaly[] = [];
  const safe = async <T>(p: Promise<T>): Promise<T | null> => p.catch(() => null);

  // 1. Price moves > 5% in 24h for tracked assets
  const trackedAssets = ['BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'DOGE', 'AVAX', 'LINK', 'UNI', 'MATIC'];
  for (const asset of trackedAssets) {
    const snap: any = await safe(sosovalue.getMarketSnapshot(asset));
    if (!snap) continue;
    const chg = Math.abs(Number(snap.priceChangePercent24h ?? snap.price_change_percent_24h ?? 0));
    if (chg >= 5) {
      const dir = Number(snap.priceChangePercent24h ?? 0) > 0 ? 'up' : 'down';
      anomalies.push({ type: 'price_move', asset, message: `${asset} moved ${dir} ${chg.toFixed(1)}% in 24h`, severity: chg >= 10 ? 'high' : 'medium' });
    }
  }

  // 2. ETF single-day inflow/outflow > $100M
  const etfList: any[] = await safe(sosovalue.getETFList('BTC', 'US')) ?? [];
  for (const etf of etfList.slice(0, 5)) {
    if (!etf?.ticker) continue;
    const history: any[] = await safe(sosovalue.getETFHistory(etf.ticker, { limit: 2 })) ?? [];
    if (history.length >= 1) {
      const flow = Math.abs(Number(history[0]?.net_flow ?? history[0]?.daily_flow ?? 0));
      if (flow >= 100_000_000) {
        anomalies.push({ type: 'etf_flow', asset: 'BTC', message: `ETF ${etf.ticker} ${flow >= 0 ? 'inflow' : 'outflow'} $${(flow / 1e6).toFixed(0)}M`, severity: 'high' });
      }
    }
  }

  // 3. Crypto stocks (COIN, MSTR) moves > 8%
  const stockTickers = ['COIN', 'MSTR', 'RIOT', 'MARA', 'HUT'];
  for (const ticker of stockTickers) {
    const snap: any = await safe(sosovalue.getCryptoStockSnapshot(ticker));
    if (!snap) continue;
    const chg = Math.abs(Number(snap.change_pct ?? snap.changePercent ?? 0));
    if (chg >= 8) {
      anomalies.push({ type: 'crypto_stock', asset: ticker, message: `${ticker} stock moved ${chg.toFixed(1)}% today`, severity: 'medium' });
    }
  }

  // 4. Macro events within 24h
  const macros: any[] = await safe(sosovalue.getMacroEvents()) ?? [];
  const now = Date.now();
  const in24h = 24 * 60 * 60 * 1000;
  for (const ev of macros) {
    const evTime = new Date(ev.event_time ?? ev.date ?? 0).getTime();
    if (Math.abs(evTime - now) < in24h) {
      const evName = ev.events?.[0] ?? ev.event_name ?? ev.name;
      anomalies.push({ type: 'macro_event', message: `Macro event: ${evName} within 24h`, severity: 'medium' });
    }
  }

  return anomalies;
}

export async function runAnomalyResearch(): Promise<void> {
  const startedAt = Date.now();
  try {
    const anomalies = await scanAnomalies();
    if (!anomalies.length) {
      await logAgent({ agent: 'cron', action: 'anomaly:none', duration_ms: Date.now() - startedAt });
      return;
    }

    // For each high-severity anomaly, run research and notify subscribers
    const highPriority = anomalies.filter((a) => a.severity === 'high' && a.asset);
    for (const anomaly of highPriority.slice(0, 3)) {
      if (!anomaly.asset) continue;
      const signal = await runResearchAgent(anomaly.asset, { saveToDb: true }).catch((e) => {
        console.error(`anomaly research failed for ${anomaly.asset}:`, e.message);
        return null;
      });
      if (!signal) continue;

      // Notify all active subscribers
      const subscribers = await getSubscribers();
      const bot = (globalThis as any).__sosomind_bot;
      if (bot && subscribers.length) {
        const msg = `🚨 <b>Anomaly Alert: ${anomaly.message}</b>\n\n` +
          `Signal: ${signal.direction} @ ${signal.confidence}% confidence\n` +
          `${signal.reasoning?.slice(0, 200)}`;
        for (const sub of subscribers) {
          await bot.api.sendMessage(sub.chat_id, msg, { parse_mode: 'HTML' }).catch(() => {});
        }
      }
    }

    await logAgent({
      agent: 'cron', action: 'anomaly:complete',
      output: { anomalies: anomalies.length, researched: highPriority.length },
      duration_ms: Date.now() - startedAt,
    });
  } catch (e) {
    console.error('anomaly scan error', (e as Error).message);
  }
}
