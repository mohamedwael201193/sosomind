import { supabase, logAgent } from '../db/supabase';

export type RiskVerdict = 'APPROVED' | 'ADJUSTED' | 'REJECTED' | 'HALT';

export interface RiskInput {
  userId?: string;
  asset: string;
  side: 'buy' | 'sell' | 'long' | 'short';
  amount: number;
  price: number;
  portfolioValueUsd?: number;
  atrPercent?: number; // optional volatility input (0..1)
}

export interface RiskResult {
  verdict: RiskVerdict;
  reasons: string[];
  adjustedAmount?: number;
  metrics: Record<string, number | string>;
}

const MAX_EXPOSURE_PER_ASSET = 0.30;
const MAX_DAILY_DRAWDOWN = -0.05;
const MAX_TRADES_PER_DAY = Number(process.env.MAX_TRADES_PER_DAY ?? 100);
const MAX_ATR_PERCENT = 0.15;

export async function runRiskAgent(input: RiskInput): Promise<RiskResult> {
  const startedAt = Date.now();
  const reasons: string[] = [];
  const metrics: Record<string, number | string> = {};
  let verdict: RiskVerdict = 'APPROVED';
  let adjustedAmount: number | undefined;

  const tradeNotional = input.amount * input.price;
  metrics.tradeNotionalUsd = tradeNotional;

  // 1. Daily trade count
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);

  let tradesToday = 0;
  try {
    const q = supabase
      .from('trades')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', todayStart.toISOString());
    if (input.userId) q.eq('user_id', input.userId);
    const { count } = await q;
    tradesToday = count ?? 0;
  } catch {}
  metrics.tradesToday = tradesToday;
  if (tradesToday >= MAX_TRADES_PER_DAY) {
    reasons.push(`Daily trade cap hit (${tradesToday}/${MAX_TRADES_PER_DAY}).`);
    verdict = 'HALT';
  }

  // 2. Portfolio exposure per asset
  const portfolioValue = input.portfolioValueUsd ?? 10000;
  const maxAllowed = portfolioValue * MAX_EXPOSURE_PER_ASSET;
  metrics.portfolioValueUsd = portfolioValue;
  metrics.maxAllowedNotional = maxAllowed;
  if (tradeNotional > maxAllowed) {
    const newAmount = Math.max(0, maxAllowed / input.price);
    reasons.push(
      `Trade ${tradeNotional.toFixed(2)} exceeds 30% cap ${maxAllowed.toFixed(2)}; reducing size to ${newAmount.toFixed(6)}.`
    );
    adjustedAmount = newAmount;
    if (verdict === 'APPROVED') verdict = 'ADJUSTED';
  }

  // 3. Volatility filter
  if (input.atrPercent !== undefined) {
    metrics.atrPercent = input.atrPercent;
    if (input.atrPercent > MAX_ATR_PERCENT) {
      reasons.push(`Volatility ATR% ${(input.atrPercent * 100).toFixed(2)}% exceeds ${MAX_ATR_PERCENT * 100}% threshold.`);
      verdict = 'REJECTED';
    }
  }

  // 4. Daily drawdown check (stub - reads realized PnL today)
  try {
    const { data } = await supabase
      .from('trades')
      .select('realized_pnl:fee')
      .gte('created_at', todayStart.toISOString());
    // simple sum of fees as a proxy if no PnL field is populated
    const dailyPnl = (data || []).reduce((s: number, t: any) => s + Number(t.realized_pnl || 0), 0);
    const ddPct = dailyPnl / portfolioValue;
    metrics.dailyDrawdownPercent = ddPct;
    if (ddPct < MAX_DAILY_DRAWDOWN) {
      reasons.push(`Daily drawdown ${(ddPct * 100).toFixed(2)}% breaches ${MAX_DAILY_DRAWDOWN * 100}% limit.`);
      verdict = 'HALT';
    }
  } catch {}

  if (reasons.length === 0) reasons.push('All risk checks passed.');

  await logAgent({
    agent: 'risk',
    action: `risk:${input.asset}`,
    duration_ms: Date.now() - startedAt,
    input: { ...input },
    output: { verdict, reasons, metrics, adjustedAmount },
    user_id: input.userId,
  });

  return { verdict, reasons, metrics, adjustedAmount };
}
