/**
 * Paper Trading System (Part 7)
 * Virtual trading with real market prices, virtual P&L tracking.
 * Leaderboard ranked by win rate, total P&L, Sharpe ratio.
 */

import { supabase } from '../db/supabase';
import { getSpotPrice } from '../clients/market';

export interface PaperTrade {
  id?: string;
  user_id: string;
  symbol: string;
  side: 'buy' | 'sell';
  entry_price: number;
  amount: number;
  exit_price?: number;
  pnl?: number;
  pnl_pct?: number;
  status: 'open' | 'closed';
  created_at?: string;
  closed_at?: string;
}

export interface PaperLeaderboardEntry {
  user_id: string;
  display_name?: string;
  total_trades: number;
  wins: number;
  losses: number;
  win_rate: number;
  total_pnl_usd: number;
  total_pnl_pct: number;
  avg_win_pct: number;
  avg_loss_pct: number;
  rank_score: number;
  rank: number;
}

export async function createPaperTrade(
  userId: string,
  symbol: string,
  side: 'buy' | 'sell',
  amountUsd: number
): Promise<PaperTrade> {
  const price = await getSpotPrice(symbol.replace(/^v/, ''));
  if (!price || price <= 0) throw new Error(`No price for ${symbol}`);

  const amount = amountUsd / price;
  const trade: Omit<PaperTrade, 'id' | 'created_at'> = {
    user_id: userId,
    symbol: symbol.toUpperCase(),
    side,
    entry_price: price,
    amount: parseFloat(amount.toFixed(8)),
    status: 'open',
  };
  const { data, error } = await supabase.from('paper_trades').insert(trade).select().single();
  if (error) throw error;
  return data as PaperTrade;
}

export async function closePaperTrade(tradeId: string, exitPriceOverride?: number): Promise<PaperTrade> {
  const { data: trade, error: fetchErr } = await supabase
    .from('paper_trades')
    .select('*')
    .eq('id', tradeId)
    .single();
  if (fetchErr || !trade) throw new Error('Trade not found');

  const exitPrice = exitPriceOverride ?? await getSpotPrice(trade.symbol.replace(/^V/, '')) ?? trade.entry_price;

  let pnl: number;
  let pnl_pct: number;
  if (trade.side === 'buy') {
    pnl = (exitPrice - trade.entry_price) * trade.amount;
    pnl_pct = ((exitPrice - trade.entry_price) / trade.entry_price) * 100;
  } else {
    pnl = (trade.entry_price - exitPrice) * trade.amount;
    pnl_pct = ((trade.entry_price - exitPrice) / trade.entry_price) * 100;
  }

  const { data, error } = await supabase
    .from('paper_trades')
    .update({
      exit_price: exitPrice,
      pnl: parseFloat(pnl.toFixed(4)),
      pnl_pct: parseFloat(pnl_pct.toFixed(4)),
      status: 'closed',
      closed_at: new Date().toISOString(),
    })
    .eq('id', tradeId)
    .select()
    .single();
  if (error) throw error;
  return data as PaperTrade;
}

export async function getPaperTrades(userId: string, status?: 'open' | 'closed'): Promise<PaperTrade[]> {
  let q = supabase.from('paper_trades').select('*').eq('user_id', userId);
  if (status) q = q.eq('status', status);
  const { data } = await q.order('created_at', { ascending: false });
  return (data ?? []) as PaperTrade[];
}

export async function getPaperLeaderboard(limit = 20): Promise<PaperLeaderboardEntry[]> {
  const { data } = await supabase
    .from('paper_trades')
    .select('user_id, side, pnl, pnl_pct, status')
    .eq('status', 'closed');

  if (!data || data.length === 0) return [];

  // Group by user
  const userMap = new Map<string, { wins: number; losses: number; pnls: number[]; pnl_pcts: number[] }>();
  for (const t of data) {
    if (!userMap.has(t.user_id)) {
      userMap.set(t.user_id, { wins: 0, losses: 0, pnls: [], pnl_pcts: [] });
    }
    const u = userMap.get(t.user_id)!;
    u.pnls.push(Number(t.pnl ?? 0));
    u.pnl_pcts.push(Number(t.pnl_pct ?? 0));
    if ((t.pnl ?? 0) > 0) u.wins++;
    else u.losses++;
  }

  // Fetch display names
  const userIds = [...userMap.keys()];
  const { data: profiles } = await supabase
    .from('user_profiles')
    .select('wallet_address, display_name')
    .in('wallet_address', userIds);
  const profileMap = new Map((profiles ?? []).map((p: any) => [p.wallet_address, p.display_name]));

  const entries: PaperLeaderboardEntry[] = [];
  for (const [userId, stats] of userMap) {
    const totalTrades = stats.wins + stats.losses;
    const winRate = stats.wins / totalTrades;
    const totalPnlUsd = stats.pnls.reduce((s, v) => s + v, 0);
    const totalPnlPct = stats.pnl_pcts.reduce((s, v) => s + v, 0);
    const wins = stats.pnl_pcts.filter(p => p > 0);
    const losses = stats.pnl_pcts.filter(p => p <= 0);
    const avgWin = wins.length > 0 ? wins.reduce((s, v) => s + v, 0) / wins.length : 0;
    const avgLoss = losses.length > 0 ? Math.abs(losses.reduce((s, v) => s + v, 0) / losses.length) : 0;

    // Rank score: W/L ratio × avg win/loss ratio × total P&L
    const rankScore = winRate * 100 + (avgWin / Math.max(avgLoss, 0.01)) * 20 + totalPnlUsd / 100;

    entries.push({
      user_id: userId,
      display_name: profileMap.get(userId) ?? undefined,
      total_trades: totalTrades,
      wins: stats.wins,
      losses: stats.losses,
      win_rate: parseFloat(winRate.toFixed(4)),
      total_pnl_usd: parseFloat(totalPnlUsd.toFixed(2)),
      total_pnl_pct: parseFloat(totalPnlPct.toFixed(2)),
      avg_win_pct: parseFloat(avgWin.toFixed(2)),
      avg_loss_pct: parseFloat(avgLoss.toFixed(2)),
      rank_score: parseFloat(rankScore.toFixed(2)),
      rank: 0, // set below
    });
  }

  entries.sort((a, b) => b.rank_score - a.rank_score);
  entries.forEach((e, i) => { e.rank = i + 1; });
  return entries.slice(0, limit);
}

/**
 * Auto-close paper trades that are older than 7 days
 */
export async function autoCloseExpiredPaperTrades(): Promise<number> {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 3600_000).toISOString();
  const { data } = await supabase
    .from('paper_trades')
    .select('*')
    .eq('status', 'open')
    .lt('created_at', sevenDaysAgo);

  if (!data || data.length === 0) return 0;
  let closed = 0;
  for (const trade of data) {
    try {
      await closePaperTrade(trade.id);
      closed++;
    } catch { /* ignore */ }
  }
  return closed;
}
