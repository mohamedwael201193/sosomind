// Public signal leaderboard.
// Aggregates signal performance per user_id (or 'sosomind' for system signals).

import { supabase } from '../db/supabase';

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  totalSignals: number;
  wins: number;
  losses: number;
  pending: number;
  winRate: number;        // 0..1
  avgConfidence: number;  // 0..100
  rankScore: number;
}

export async function getLeaderboard(limit = 20): Promise<LeaderboardEntry[]> {
  const { data, error } = await supabase
    .from('signals')
    .select('user_id,status,confidence')
    .order('created_at', { ascending: false })
    .limit(2000);
  if (error) throw new Error(error.message);

  const buckets = new Map<string, { total: number; wins: number; losses: number; pending: number; conf: number[] }>();
  for (const row of data || []) {
    const uid = (row as any).user_id || 'sosomind';
    if (!buckets.has(uid)) buckets.set(uid, { total: 0, wins: 0, losses: 0, pending: 0, conf: [] });
    const b = buckets.get(uid)!;
    b.total++;
    const status = String((row as any).status || '');
    if (status === 'executed') b.wins++;
    else if (status === 'expired' || status === 'dismissed') b.losses++;
    else b.pending++;
    const c = Number((row as any).confidence ?? 0);
    if (Number.isFinite(c)) b.conf.push(c);
  }

  const entries: Omit<LeaderboardEntry, 'rank'>[] = [];
  for (const [userId, b] of buckets.entries()) {
    const winRate = b.total > 0 ? b.wins / b.total : 0;
    const avgConfidence = b.conf.length ? b.conf.reduce((a, c) => a + c, 0) / b.conf.length : 0;
    // Score weights win-rate, sample size and confidence
    const rankScore = Math.round(winRate * 100 * 0.6 + avgConfidence * 0.3 + Math.min(b.total, 50) * 0.2);
    entries.push({
      userId, totalSignals: b.total, wins: b.wins, losses: b.losses, pending: b.pending,
      winRate, avgConfidence, rankScore,
    });
  }

  entries.sort((a, b) => b.rankScore - a.rankScore);
  return entries.slice(0, limit).map((e, i) => ({ rank: i + 1, ...e }));
}
