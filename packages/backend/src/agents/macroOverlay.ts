import { sosovalue } from '../clients/sosovalue';

export interface MacroOutlook {
  regime: 'risk-on' | 'risk-off' | 'neutral';
  score: number; // 0 (risk-off) to 100 (risk-on)
  drivers: string[];
  upcomingEvents: Array<{ name: string; date: string; importance: string }>;
  breakdown: Record<string, number>; // component scores 0-100
}

export async function getMacroOutlook(): Promise<MacroOutlook> {
  const safe = async <T>(p: Promise<T>): Promise<T | null> => p.catch(() => null);

  const [macroEvents, etfList, btcSnap] = await Promise.all([
    safe(sosovalue.getMacroEvents()),
    safe(sosovalue.getETFList('BTC', 'US')),
    safe(sosovalue.getMarketSnapshot('BTC')),
  ]);

  const drivers: string[] = [];
  let riskScore = 50; // Start neutral

  // Check BTC ETF flows
  const etfs = Array.isArray(etfList) ? etfList : [];
  let etfNetFlow = 0;
  for (const etf of etfs.slice(0, 5)) {
    const history: any[] = await safe(sosovalue.getETFHistory(etf.ticker, { limit: 3 })) ?? [];
    for (const h of history) {
      etfNetFlow += Number(h?.net_flow ?? h?.daily_flow ?? 0);
    }
  }
  if (etfNetFlow > 100_000_000) { riskScore += 10; drivers.push('ETF inflows positive ($' + (etfNetFlow / 1e6).toFixed(0) + 'M)'); }
  else if (etfNetFlow < -100_000_000) { riskScore -= 10; drivers.push('ETF outflows negative ($' + Math.abs(etfNetFlow / 1e6).toFixed(0) + 'M)'); }

  // Check BTC momentum
  const btcChange = Number((btcSnap as any)?.priceChangePercent24h ?? (btcSnap as any)?.price_change_percent_24h ?? 0);
  if (btcChange > 3) { riskScore += 5; drivers.push(`BTC +${btcChange.toFixed(1)}% 24h`); }
  else if (btcChange < -3) { riskScore -= 5; drivers.push(`BTC ${btcChange.toFixed(1)}% 24h`); }

  // Check upcoming macro events (negative bias for uncertainty)
  const now = Date.now();
  const events = Array.isArray(macroEvents) ? macroEvents : [];
  const upcoming = events.filter((e) => {
    const evTime = new Date(e.event_time ?? e.date ?? 0).getTime();
    return evTime > now && evTime - now < 7 * 24 * 60 * 60 * 1000;
  });

  for (const ev of upcoming.slice(0, 5)) {
    const evName = ev.events?.[0] ?? ev.event_name ?? ev.name ?? '';
    const name = String(evName).toLowerCase();
    if (name.includes('cpi') || name.includes('inflation') || name.includes('fed') || name.includes('fomc')) {
      riskScore -= 5;
      drivers.push(`Upcoming: ${evName}`);
    }
  }

  riskScore = Math.max(0, Math.min(100, riskScore));
  const regime: MacroOutlook['regime'] = riskScore >= 60 ? 'risk-on' : riskScore <= 40 ? 'risk-off' : 'neutral';

  // Component scores (0-100) so the frontend can render breakdown bars
  const etfScore = Math.max(0, Math.min(100, 50 + (etfNetFlow / 2e8) * 50));
  const momentumScore = Math.max(0, Math.min(100, 50 + btcChange * 5));
  const macroRiskScore = Math.max(0, Math.min(100, 100 - upcoming.length * 8));
  const sentimentScore = riskScore; // proxy until fear/greed integrated

  return {
    regime,
    score: riskScore,
    drivers,
    breakdown: {
      etf_flow: Math.round(etfScore),
      btc_momentum: Math.round(momentumScore),
      macro_risk: Math.round(macroRiskScore),
      sentiment: Math.round(sentimentScore),
    },
    upcomingEvents: upcoming.slice(0, 5).map((e) => ({
      name: e.events?.[0] ?? e.event_name ?? e.name ?? 'Unknown',
      date: e.event_time ?? e.date ?? '',
      importance: e.importance ?? 'medium',
    })),
  };
}
