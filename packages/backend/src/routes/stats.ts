import { Router } from 'express';
import { supabase } from '../db/supabase';
import { asyncHandler } from '../utils/http';
const router = Router();

router.get('/accuracy', asyncHandler(async (_req, res) => {
  // Fetch signals from last 30 days with outcomes
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { data: signals, error } = await supabase
    .from('signals')
    .select('id, asset, direction, confidence, created_at, status')
    .gte('created_at', since)
    .order('created_at', { ascending: false });
  if (error) throw error;

  const total = signals?.length ?? 0;
  const byStatus: Record<string, number> = {};
  for (const s of signals ?? []) {
    byStatus[s.status] = (byStatus[s.status] ?? 0) + 1;
  }

  const { data: outcomeRows } = await supabase
    .from('signals')
    .select('outcome')
    .gte('created_at', since)
    .not('outcome', 'is', null);

  const hits = (outcomeRows ?? []).filter((s) => s.outcome === 'HIT').length;
  const stops = (outcomeRows ?? []).filter((s) => s.outcome === 'STOP').length;
  const decisive = hits + stops;
  const winRate = decisive > 0 ? (hits / decisive) * 100 : null;
  const avgConfidence = total > 0
    ? (signals ?? []).reduce((s, x) => s + Number(x.confidence ?? 0), 0) / total
    : 0;

  res.json({
    data: {
      total,
      byStatus,
      winRate: winRate !== null ? `${winRate.toFixed(1)}%` : 'insufficient_data',
      avgConfidence: avgConfidence.toFixed(1),
      period: '30d',
    },
  });
}));

router.get('/performance', asyncHandler(async (_req, res) => {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { data: trades, error } = await supabase
    .from('trades')
    .select('market, side, amount, price, status, created_at')
    .gte('created_at', since)
    .order('created_at', { ascending: false });
  if (error) throw error;

  const total = trades?.length ?? 0;
  const byStatus: Record<string, number> = {};
  for (const t of trades ?? []) byStatus[t.status] = (byStatus[t.status] ?? 0) + 1;
  const totalVolume = (trades ?? []).reduce((s, t) => s + Number(t.amount ?? 0) * Number(t.price ?? 0), 0);

  res.json({ data: { total, byStatus, totalVolumeUsd: totalVolume.toFixed(2), period: '30d' } });
}));

export default router;
