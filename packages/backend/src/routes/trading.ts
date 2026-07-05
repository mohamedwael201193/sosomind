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
  resolveProfileFromRequest,
} from '../config/environment.js';
import { getCircuitStatus } from '../agents/circuitBreaker.js';
import { extractSodexOrderMeta, isFilledOrderStatus, isFailedOrderStatus } from '../utils/sodexOrderParse.js';
import { getSodexClientFromRequest } from '../clients/sodex.js';

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

    let meta = extractSodexOrderMeta(data.sodex_response);
    const env = resolveProfileFromRequest(req);

    // Refresh status from SoDEX when still in-flight
    if (
      data.wallet_address &&
      meta.sodexOrderId &&
      !isFilledOrderStatus(meta.exchangeStatus) &&
      !isFailedOrderStatus(meta.exchangeStatus, meta.executedQty)
    ) {
      try {
        const sodex = getSodexClientFromRequest(req);
        const history = await sodex.getSpotOrderHistoryForAddress(String(data.wallet_address).toLowerCase(), undefined, 30);
        const rows = Array.isArray(history) ? history : (history as any)?.orders ?? [];
        const match = rows.find((o: any) => String(o.orderID ?? o.orderId ?? o.id) === meta.sodexOrderId);
        if (match?.status) {
          meta = {
            ...meta,
            exchangeStatus: String(match.status),
            avgPrice: match.avgPrice != null ? Number(match.avgPrice) : meta.avgPrice,
            executedQty: match.executedQty != null ? Number(match.executedQty) : meta.executedQty,
          };
          const liveStatus = mapLiveRelayStatus(meta.exchangeStatus, meta.executedQty);
          if (liveStatus !== data.status) {
            await supabase.from('signed_orders').update({
              status: liveStatus,
              updated_at: new Date().toISOString(),
              finalized_at: ['filled', 'rejected'].includes(liveStatus) ? new Date().toISOString() : null,
            }).eq('id', id);
          }
        }
      } catch {
        /* keep cached meta */
      }
    }

    const events = [
      { at: data.created_at, stage: 'submitted', detail: 'Signed order received by relay' },
    ];
    if (data.submitted_at) events.push({ at: data.submitted_at, stage: 'forwarded', detail: 'Forwarded to SoDEX gateway' });
    if (meta.sodexOrderId) {
      events.push({ at: data.submitted_at ?? data.updated_at ?? data.created_at, stage: 'exchange', detail: `SoDEX order ${meta.sodexOrderId}` });
    }
    if (meta.exchangeStatus) {
      events.push({ at: data.updated_at ?? data.created_at, stage: meta.exchangeStatus.toLowerCase(), detail: meta.exchangeStatus });
    }
    if (data.updated_at && data.updated_at !== data.created_at && !meta.exchangeStatus) {
      events.push({ at: data.updated_at, stage: data.status ?? 'updated', detail: data.error_message ?? 'Status updated' });
    }

    res.json(wrapMeta({
      order: data,
      meta,
      proof: {
        auditId: data.id,
        sodexOrderId: meta.sodexOrderId,
        sodexAppUrl: env.sodexAppUrl,
        explorer: env.explorer,
        explorerNote: 'Spot orders are not EVM transactions. Use SoDEX Portfolio → Order History.',
        pending: !isFilledOrderStatus(meta.exchangeStatus) && !isFailedOrderStatus(meta.exchangeStatus, meta.executedQty),
      },
      timeline: events,
    }, { ttlMs: 0, source: 'live' }));
  }),
);

export default router;

function mapLiveRelayStatus(exchangeStatus: string | null, executedQty: number | null): string {
  const s = (exchangeStatus ?? '').toUpperCase();
  if (s === 'FILLED' || s === 'PARTIAL_FILL') return 'filled';
  if (isFailedOrderStatus(exchangeStatus, executedQty)) return 'rejected';
  return 'submitted';
}
