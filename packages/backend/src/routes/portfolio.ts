import { Router } from 'express';
import { z } from 'zod';
import { supabase } from '../db/supabase';
import { sosovalue } from '../clients/sosovalue';
import { asyncHandler, validate } from '../utils/http';

const router = Router();

router.get('/', asyncHandler(async (_req, res) => {
  const { data: positions, error } = await supabase
    .from('positions')
    .select('*')
    .eq('status', 'open')
    .order('opened_at', { ascending: false });
  if (error) throw error;

  // Mark-to-market with live prices (one call per symbol; SoSoValue has no batch endpoint)
  const symbols = Array.from(new Set((positions || []).map((p: any) => (p.market || '').split('-')[0]).filter(Boolean)));
  const priceMap = new Map<string, number>();
  await Promise.all(symbols.map(async (sym) => {
    try {
      const snap: any = await sosovalue.getMarketSnapshot(sym);
      const p = Number(snap?.price ?? snap?.last_price ?? 0);
      if (Number.isFinite(p)) priceMap.set(sym, p);
    } catch {}
  }));

  let totalValue = 0;
  let totalPnl = 0;
  const enriched = (positions || []).map((p: any) => {
    const sym = (p.market || '').split('-')[0];
    const mark = priceMap.get(sym) ?? Number(p.entry_price);
    const size = Number(p.size);
    const entry = Number(p.entry_price);
    const value = mark * size;
    const pnl = (mark - entry) * size * (p.side === 'short' ? -1 : 1);
    totalValue += value;
    totalPnl += pnl;
    return { ...p, mark_price: mark, value_usd: value, pnl_usd: pnl };
  });

  res.json({ data: enriched, summary: { totalValueUsd: totalValue, totalPnlUsd: totalPnl, positions: enriched.length } });
}));

router.get('/positions', asyncHandler(async (_req, res) => {
  const { data, error } = await supabase.from('positions').select('*').order('opened_at', { ascending: false });
  if (error) throw error;
  res.json({ data });
}));

router.get('/trades', validate(z.object({ limit: z.coerce.number().default(50) })), asyncHandler(async (req, res) => {
  const { limit } = (req as any).validated;
  const { data, error } = await supabase.from('trades').select('*').order('created_at', { ascending: false }).limit(limit);
  if (error) throw error;
  res.json({ data });
}));

router.get('/history', validate(z.object({ limit: z.coerce.number().default(30) })), asyncHandler(async (req, res) => {
  const { limit } = (req as any).validated;
  try {
    const { data, error } = await supabase
      .from('portfolio_snapshots')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) {
      return res.json({ data: [], _note: 'portfolio_snapshots table not yet created' });
    }
    res.json({ data: data || [] });
  } catch {
    res.json({ data: [], _note: 'portfolio_snapshots table not yet created' });
  }
}));

router.get('/allocations', asyncHandler(async (_req, res) => {
  const { data: positions, error } = await supabase.from('positions').select('market,size,entry_price').eq('status', 'open');
  if (error) throw error;
  const totals = new Map<string, number>();
  for (const p of positions || []) {
    const k = (p as any).market.split('-')[0];
    const v = Number((p as any).size) * Number((p as any).entry_price);
    totals.set(k, (totals.get(k) ?? 0) + v);
  }
  const data = [...totals.entries()].map(([asset, value]) => ({ asset, value }));
  res.json({ data });
}));

export default router;
