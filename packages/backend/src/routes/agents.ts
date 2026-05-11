import { Router } from 'express';
import { z } from 'zod';
import { runResearchAgent } from '../agents/research';
import { supabase } from '../db/supabase';
import { asyncHandler, validate } from '../utils/http';
import { wrapMeta } from '../utils/responseMeta';

const router = Router();

// Run research pipeline & persist signal
router.post('/research/:asset', asyncHandler(async (req, res) => {
  const asset = req.params.asset;
  const userId = (req.body?.userId as string | undefined) ?? undefined;
  const signal = await runResearchAgent(asset, { userId, saveToDb: true });
  res.json({ signal });
}));

// ─── Signal Track Record (public) ────────────────────────────────────────────
router.get('/signals/track-record', asyncHandler(async (_req, res) => {
  // Try to fetch persisted stats from agent_meta first
  const { data: metaRow } = await supabase
    .from('agent_meta')
    .select('value, updated_at')
    .eq('key', 'track_record')
    .maybeSingle();

  // Also pull live aggregate counts for enrichment
  const { data: liveStats } = await supabase
    .from('signals')
    .select('direction, status, outcome')
    .limit(1000);

  const totalSignals = liveStats?.length ?? 0;
  const activeSignals = liveStats?.filter((s: any) => s.status === 'active').length ?? 0;

  if (metaRow?.value) {
    const stored = metaRow.value as Record<string, any>;
    return res.json(wrapMeta(
      { ...stored, total_signals: totalSignals, active_signals: activeSignals },
      { cachedAt: metaRow.updated_at, ttlMs: 3_600_000, source: 'cache' },
    ));
  }

  // No persisted stats yet — return live aggregate placeholder
  const longSignals = liveStats?.filter((s: any) => s.direction === 'long').length ?? 0;
  const shortSignals = liveStats?.filter((s: any) => s.direction === 'short').length ?? 0;

  return res.json(wrapMeta(
    {
      hit_rate: null,
      evaluated_count: 0,
      avg_return_pct: null,
      by_direction: {
        long: { hits: 0, stops: 0, total: longSignals },
        short: { hits: 0, stops: 0, total: shortSignals },
      },
      by_asset: {},
      last_updated: null,
      total_signals: totalSignals,
      active_signals: activeSignals,
    },
    { ttlMs: 3_600_000, source: 'live' },
  ));
}));

router.get('/signals', validate(z.object({ status: z.string().optional(), asset: z.string().optional(), limit: z.coerce.number().default(50) })), asyncHandler(async (req, res) => {
  const { status, asset, limit } = (req as any).validated;
  let q = supabase.from('signals').select('*').order('created_at', { ascending: false }).limit(limit);
  if (status) q = q.eq('status', status);
  if (asset) q = q.eq('asset', asset.toUpperCase());
  const { data, error } = await q;
  if (error) throw error;
  res.json({ data });
}));

router.get('/signals/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  // Validate UUID format to prevent routing collision with named sub-routes
  // (e.g. GET /signals/funding which is registered in the features router)
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return res.status(404).json({ error: 'not_found' });
  }
  const { data, error } = await supabase.from('signals').select('*').eq('id', id).single();
  if (error) throw error;
  res.json({ data });
}));

router.delete('/signals/:id', asyncHandler(async (req, res) => {
  const { error } = await supabase.from('signals').update({ status: 'dismissed' }).eq('id', req.params.id);
  if (error) throw error;
  res.json({ ok: true });
}));

router.get('/agent-logs', validate(z.object({ agent: z.string().optional(), limit: z.coerce.number().default(100) })), asyncHandler(async (req, res) => {
  const { agent, limit } = (req as any).validated;
  let q = supabase.from('agent_logs').select('*').order('created_at', { ascending: false }).limit(limit);
  if (agent) q = q.eq('agent', agent);
  const { data, error } = await q;
  if (error) throw error;
  res.json({ data });
}));

export default router;
