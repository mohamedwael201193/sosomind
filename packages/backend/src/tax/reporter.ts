/**
 * Tax Reporting Engine (Part 12)
 * Aggregates closed trades by year, calculates realized P&L,
 * short-term vs long-term gains, and generates export-ready data.
 */

import { supabase } from '../db/supabase';

export interface TaxLot {
  trade_id: string;
  asset: string;
  side: 'buy' | 'sell';
  amount: number;
  entry_price: number;
  exit_price: number;
  pnl_usd: number;
  pnl_pct: number;
  opened_at: string;
  closed_at: string;
  holding_days: number;
  term: 'short' | 'long';  // <1 year = short
}

export interface TaxReport {
  year: number;
  user_id: string;
  total_trades: number;
  winning_trades: number;
  losing_trades: number;
  short_term_gains: number;  // Held <365 days
  long_term_gains: number;   // Held ≥365 days
  total_realized_pnl: number;
  total_fees_est: number;    // Estimated fees (0.1% per trade)
  net_pnl_after_fees: number;
  largest_win: number;
  largest_loss: number;
  avg_holding_days: number;
  lots: TaxLot[];
  generated_at: string;
}

export async function generateTaxReport(userId: string, year: number): Promise<TaxReport> {
  const startDate = `${year}-01-01T00:00:00.000Z`;
  const endDate = `${year}-12-31T23:59:59.999Z`;

  // Fetch closed trades for user in this year (paper trades)
  const { data: paperTrades } = await supabase
    .from('paper_trades')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'closed')
    .gte('closed_at', startDate)
    .lte('closed_at', endDate)
    .order('closed_at', { ascending: true });

  // Fetch real trades from signals if available
  const { data: realTrades } = await supabase
    .from('trades')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'closed')
    .gte('created_at', startDate)
    .lte('created_at', endDate)
    .order('created_at', { ascending: true });

  const allTrades = [
    ...(paperTrades ?? []),
    ...(realTrades ?? []),
  ];

  const lots: TaxLot[] = [];
  for (const t of allTrades) {
    const openedAt = new Date(t.created_at ?? t.opened_at ?? t.closed_at);
    const closedAt = new Date(t.closed_at);
    const holdingMs = closedAt.getTime() - openedAt.getTime();
    const holdingDays = Math.max(0, holdingMs / (1000 * 60 * 60 * 24));
    const pnlUsd = Number(t.pnl ?? t.pnl_usd ?? 0);
    if (pnlUsd === 0) continue;

    lots.push({
      trade_id: t.id,
      asset: String(t.symbol ?? t.asset ?? 'UNKNOWN'),
      side: t.side as 'buy' | 'sell',
      amount: Number(t.amount ?? 1),
      entry_price: Number(t.entry_price ?? t.entry ?? 0),
      exit_price: Number(t.exit_price ?? t.exit ?? 0),
      pnl_usd: parseFloat(pnlUsd.toFixed(2)),
      pnl_pct: parseFloat(Number(t.pnl_pct ?? 0).toFixed(2)),
      opened_at: openedAt.toISOString(),
      closed_at: closedAt.toISOString(),
      holding_days: parseFloat(holdingDays.toFixed(1)),
      term: holdingDays >= 365 ? 'long' : 'short',
    });
  }

  const shortTerm = lots.filter(l => l.term === 'short');
  const longTerm = lots.filter(l => l.term === 'long');
  const winners = lots.filter(l => l.pnl_usd > 0);
  const losers = lots.filter(l => l.pnl_usd < 0);

  const shortTermGains = shortTerm.reduce((s, l) => s + l.pnl_usd, 0);
  const longTermGains = longTerm.reduce((s, l) => s + l.pnl_usd, 0);
  const totalPnl = shortTermGains + longTermGains;
  const totalFeesEst = lots.reduce((s, l) => s + l.entry_price * l.amount * 0.001, 0);
  const avgHoldingDays = lots.length > 0
    ? lots.reduce((s, l) => s + l.holding_days, 0) / lots.length
    : 0;

  return {
    year,
    user_id: userId,
    total_trades: lots.length,
    winning_trades: winners.length,
    losing_trades: losers.length,
    short_term_gains: parseFloat(shortTermGains.toFixed(2)),
    long_term_gains: parseFloat(longTermGains.toFixed(2)),
    total_realized_pnl: parseFloat(totalPnl.toFixed(2)),
    total_fees_est: parseFloat(totalFeesEst.toFixed(2)),
    net_pnl_after_fees: parseFloat((totalPnl - totalFeesEst).toFixed(2)),
    largest_win: winners.length > 0 ? Math.max(...winners.map(l => l.pnl_usd)) : 0,
    largest_loss: losers.length > 0 ? Math.min(...losers.map(l => l.pnl_usd)) : 0,
    avg_holding_days: parseFloat(avgHoldingDays.toFixed(1)),
    lots,
    generated_at: new Date().toISOString(),
  };
}

/**
 * Generate CSV export string from tax report
 */
export function taxReportToCsv(report: TaxReport): string {
  const headers = [
    'Trade ID', 'Asset', 'Side', 'Amount', 'Entry Price', 'Exit Price',
    'P&L USD', 'P&L %', 'Opened', 'Closed', 'Holding Days', 'Term'
  ];
  const rows = report.lots.map(l => [
    l.trade_id, l.asset, l.side, l.amount, l.entry_price, l.exit_price,
    l.pnl_usd, l.pnl_pct, l.opened_at, l.closed_at, l.holding_days, l.term
  ]);
  const summary = [
    '',
    `Summary: Year ${report.year}`,
    `Total Trades,${report.total_trades}`,
    `Winning Trades,${report.winning_trades}`,
    `Losing Trades,${report.losing_trades}`,
    `Short-Term Gains,${report.short_term_gains}`,
    `Long-Term Gains,${report.long_term_gains}`,
    `Total Realized P&L,${report.total_realized_pnl}`,
    `Estimated Fees,${report.total_fees_est}`,
    `Net P&L After Fees,${report.net_pnl_after_fees}`,
    `Avg Holding Days,${report.avg_holding_days}`,
  ];

  const csvRows = [
    headers.join(','),
    ...rows.map(r => r.map(v => `"${v}"`).join(',')),
    ...summary,
  ];
  return csvRows.join('\n');
}
