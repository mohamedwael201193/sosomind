import { Router } from 'express';
import { z } from 'zod';
import { supabase } from '../db/supabase.js';
import { asyncHandler, validate } from '../utils/http.js';
import { wrapMeta } from '../utils/responseMeta.js';
import {
  getDefaultProfileId,
  isTradingKillSwitchActive,
  parseAllowlist,
  publicProfileSummary,
  getProfile,
} from '../config/environment.js';
import { getCircuitStatus } from '../agents/circuitBreaker.js';

const router = Router();

router.get('/controls', asyncHandler(async (_req, res) => {
  const profile = getProfile(getDefaultProfileId());
  res.json(wrapMeta({
    killSwitch: isTradingKillSwitchActive(),
    dryRun: process.env.DRY_RUN === 'true',
    allowlist: Array.from(parseAllowlist()),
    maxNotionalUsd: profile.maxNotionalUsd,
    writesAllowed: profile.writesAllowed,
    environment: publicProfileSummary(profile),
    circuit: getCircuitStatus(),
  }, { ttlMs: 5_000, source: 'live' }));
}));

router.get('/orders/:id/timeline',
  validate(z.object({ id: z.string().uuid() }), 'params'),
  asyncHandler(async (req, res) => {
    const { id } = (req as any).validated;
    const { data, error } = await supabase
      .from('signed_orders')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) return res.status(500).json({ error: error.message });
    if (!data) return res.status(404).json({ error: 'order_not_found' });

    const events = [
      { at: data.created_at, stage: 'submitted', detail: 'Signed order received by relay' },
    ];
    if (data.submitted_at) events.push({ at: data.submitted_at, stage: 'forwarded', detail: 'Forwarded to SoDEX gateway' });
    if (data.updated_at && data.updated_at !== data.created_at) {
      events.push({ at: data.updated_at, stage: data.status ?? 'updated', detail: data.error_message ?? 'Status updated' });
    }
    if (data.sodex_order_id) {
      events.push({ at: data.updated_at ?? data.created_at, stage: 'exchange', detail: `SoDEX order ${data.sodex_order_id}` });
    }

    res.json(wrapMeta({ order: data, timeline: events }, { ttlMs: 0, source: 'live' }));
  }),
);

export default router;
