/**
 * Whale / Smart Money Tracker (Part 4)
 * Aggregates: BTC treasuries, ETF flows, fundraising data from SoSoValue
 * Generates WhaleAlert objects and persists to DB.
 */

import { sosovalue } from '../clients/sosovalue';
import { supabase } from '../db/supabase';
import { getSubscribers } from '../db/supabase';

export interface WhaleAlert {
  id?: string;
  type: 'treasury_buy' | 'treasury_sell' | 'etf_inflow' | 'etf_outflow' | 'vc_funding' | 'large_move';
  asset: string;
  amount_usd: number;
  entity: string;
  impact: 'low' | 'medium' | 'high' | 'critical';
  signal_direction: 'bullish' | 'bearish' | 'neutral';
  reasoning: string;
  source: string;
  created_at?: string;
}

/**
/**
 * Pull BTC treasury purchase history for top institutional holders
 */
async function scanTreasuries(): Promise<WhaleAlert[]> {
  const alerts: WhaleAlert[] = [];
  try {
    // Get the list of companies, then fetch purchase history for top holders
    const companies: any[] = await sosovalue.getBTCTreasuries();
    // Top tracked tickers — largest known BTC holders
    const TOP_TICKERS = ['MSTR', 'MARA', 'RIOT', 'GME', '3350', 'HUT', 'BITF', 'CORZ', 'COIN', 'SMLR'];
    const tracked = companies.filter(c => TOP_TICKERS.includes(c.ticker)).slice(0, 8);

    const histories = await Promise.all(
      tracked.map(c =>
        sosovalue.getBTCPurchaseHistory(c.ticker, { limit: 2 }).catch(() => [] as any[])
      )
    );

    for (let i = 0; i < tracked.length; i++) {
      const company = tracked[i];
      const history: any[] = Array.isArray(histories[i]) ? histories[i] as any[] : [];
      if (!history.length) continue;
      const latest = history[0];
      const btcAcq = Number(latest.btc_acq ?? 0);
      const acqCost = Number(latest.acq_cost ?? 0);
      if (btcAcq > 100 && acqCost > 5_000_000) { // >100 BTC and >$5M purchase
        alerts.push({
          type: 'treasury_buy',
          asset: 'BTC',
          amount_usd: acqCost,
          entity: company.name,
          impact: acqCost > 500_000_000 ? 'critical' : acqCost > 100_000_000 ? 'high' : 'medium',
          signal_direction: 'bullish',
          reasoning: `${company.name} (${company.ticker}) purchased ${Number(btcAcq).toLocaleString()} BTC for $${(acqCost / 1e6).toFixed(0)}M on ${latest.date}`,
          source: 'sosovalue_treasuries',
        });
      }
    }
  } catch { /* ignore */ }
  return alerts;
}

/**
 * Scan ETF flows for large inflows/outflows
 */
async function scanEtfFlows(): Promise<WhaleAlert[]> {
  const alerts: WhaleAlert[] = [];
  try {
    const history: any = await sosovalue.getETFSummaryHistory('BTC', 'US', { limit: 5 });
    const list = Array.isArray(history) ? history : history?.list ?? [];
    for (const day of list.slice(0, 3)) {
      const netFlow = Number(day.total_net_inflow ?? day.netFlow ?? day.net_flow ?? 0);
      const absFlow = Math.abs(netFlow);
      if (absFlow > 10_000_000) { // >$10M (real ETF flows are in the billions)
        alerts.push({
          type: netFlow > 0 ? 'etf_inflow' : 'etf_outflow',
          asset: 'BTC',
          amount_usd: absFlow,
          entity: 'Bitcoin ETFs (Aggregate)',
          impact: absFlow > 500_000_000 ? 'critical' : absFlow > 200_000_000 ? 'high' : 'medium',
          signal_direction: netFlow > 0 ? 'bullish' : 'bearish',
          reasoning: `BTC ETFs saw $${(absFlow / 1e6).toFixed(0)}M net ${netFlow > 0 ? 'inflow' : 'outflow'} — institutional demand ${netFlow > 0 ? 'increasing' : 'declining'}`,
          source: 'sosovalue_etf',
        });
      }
    }
  } catch { /* ignore */ }
  return alerts;
}

/**
 * Scan recent large VC fundraises
 */
async function scanFundraising(): Promise<WhaleAlert[]> {
  const alerts: WhaleAlert[] = [];
  try {
    const data: any = await sosovalue.getFundraisingProjects({ page_size: 20 });
    const list = Array.isArray(data) ? data : data?.list ?? [];
    for (const project of list) {
      const raised = Number(project.raisedAmount ?? project.raised_amount ?? project.amount ?? 0);
      if (raised > 10_000_000) { // >$10M
        const sector = String(project.sector ?? project.category ?? 'DeFi');
        alerts.push({
          type: 'vc_funding',
          asset: project.symbol?.toUpperCase() ?? 'CRYPTO',
          amount_usd: raised,
          entity: String(project.name ?? project.project ?? 'Unknown'),
          impact: raised > 100_000_000 ? 'critical' : raised > 50_000_000 ? 'high' : 'medium',
          signal_direction: 'bullish',
          reasoning: `${project.name ?? 'Project'} raised $${(raised / 1e6).toFixed(0)}M (${sector}). Large VC inflows signal institutional confidence in ${sector} sector.`,
          source: 'sosovalue_fundraising',
        });
      }
    }
  } catch { /* ignore */ }
  return alerts;
}

/**
 * Run full whale scan and store new alerts
 */
export async function runWhaleScan(): Promise<WhaleAlert[]> {
  const [treasuryAlerts, etfAlerts, fundingAlerts] = await Promise.all([
    scanTreasuries(),
    scanEtfFlows(),
    scanFundraising(),
  ]);
  const all = [...treasuryAlerts, ...etfAlerts, ...fundingAlerts];

  // Persist to DB (deduplicate by type+asset+entity within last hour)
  const oneHourAgo = new Date(Date.now() - 3600_000).toISOString();
  for (const alert of all) {
    try {
      const { data: existing } = await supabase
        .from('whale_alerts')
        .select('id')
        .eq('type', alert.type)
        .eq('entity', alert.entity)
        .gte('created_at', oneHourAgo)
        .limit(1);
      if (!existing || existing.length === 0) {
        await supabase.from('whale_alerts').insert(alert);
      }
    } catch { /* ignore */ }
  }

  return all.slice(0, 10); // Return top 10
}

/**
 * Get recent whale alerts from DB
 */
export async function getWhaleAlerts(limit = 20): Promise<WhaleAlert[]> {
  const { data, error } = await supabase
    .from('whale_alerts')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) return [];
  return data as WhaleAlert[];
}

/**
 * Format a whale alert for Telegram
 */
export function formatWhaleAlert(alert: WhaleAlert): string {
  const impactEmoji = { low: '⚪', medium: '🟡', high: '🟠', critical: '🔴' }[alert.impact] ?? '⚪';
  const dirEmoji = { bullish: '📈', bearish: '📉', neutral: '➡️' }[alert.signal_direction] ?? '➡️';
  const amountStr = alert.amount_usd >= 1e9
    ? `$${(alert.amount_usd / 1e9).toFixed(2)}B`
    : `$${(alert.amount_usd / 1e6).toFixed(0)}M`;
  return (
    `${impactEmoji} <b>Whale Alert — ${alert.type.replace(/_/g, ' ').toUpperCase()}</b>\n` +
    `${dirEmoji} <b>${alert.asset}</b> | ${amountStr} | <b>${alert.impact.toUpperCase()}</b> impact\n\n` +
    `🏛️ <b>Entity:</b> ${alert.entity}\n` +
    `💡 <b>Analysis:</b> ${alert.reasoning}\n\n` +
    `📡 Source: ${alert.source.replace(/_/g, ' ')}`
  );
}
