/**
 * SoDEX Relay — non-custodial trading endpoint.
 */
import { Router } from 'express';
import { z } from 'zod';
import axios, { AxiosError } from 'axios';
import { ethers } from 'ethers';
import rateLimit from 'express-rate-limit';
import { supabase } from '../db/supabase.js';
import { requireWallet, AuthedRequest } from '../middleware/requireWallet.js';
import { asyncHandler } from '../utils/http.js';
import { assertTradingAllowed, recordTradeResult, estimatePnlPct } from '../agents/circuitBreaker.js';
import { runRiskAgent } from '../agents/risk.js';
import {
  resolveProfileFromRequest,
  isTradingKillSwitchActive,
  isWalletAllowlisted,
  publicProfileSummary,
} from '../config/environment.js';
import { extractSodexOrderMeta, mapExchangeStatusToRelayStatus } from '../utils/sodexOrderParse.js';

const router = Router();

const SCOPES = ['spot', 'futures'] as const;
const ALLOWED_ACTIONS = new Set([
  'batchNewOrder',
  'batchCancelOrder',
  'newOrder',
  'cancelOrder',
]);
const ENDPOINT_MAP: Record<string, { method: 'POST' | 'DELETE'; path: string; scope: 'spot' | 'futures' }> = {
  'spot:batchNewOrder':     { method: 'POST',   path: '/trade/orders/batch', scope: 'spot' },
  'spot:batchCancelOrder':  { method: 'DELETE', path: '/trade/orders/batch', scope: 'spot' },
  'futures:newOrder':       { method: 'POST',   path: '/trade/orders',       scope: 'futures' },
  'futures:cancelOrder':    { method: 'DELETE', path: '/trade/orders',       scope: 'futures' },
};

const tradeLimiter = rateLimit({
  windowMs: 60_000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => (req as AuthedRequest).wallet || req.ip || 'anon',
  message: { error: 'rate_limited', message: 'Max 30 orders per minute per wallet' },
});

const ACTION_TYPES = {
  ExchangeAction: [
    { name: 'payloadHash', type: 'bytes32' },
    { name: 'nonce',       type: 'uint64' },
  ],
};
function domain(scope: 'spot' | 'futures', chainId: number) {
  return { name: scope, version: '1', chainId, verifyingContract: '0x0000000000000000000000000000000000000000' };
}

const RelaySchema = z.object({
  scope:       z.enum(SCOPES),
  actionName:  z.string().min(1),
  body:        z.record(z.string(), z.any()),
  envelopeJson: z.string().min(1),
  nonce:       z.coerce.number().int().positive(),
  sig:         z.string().regex(/^0x01[0-9a-fA-F]{130}$/, 'sig must be 0x01 + 130 hex chars'),
  market:      z.string().optional(),
  side:        z.enum(['buy','sell']).optional(),
  quantity:    z.coerce.number().optional(),
  price:       z.coerce.number().optional(),
  orderType:   z.enum(['limit','market']).optional(),
  source:      z.enum(['dashboard','telegram','api']).default('dashboard'),
});

router.post('/', requireWallet, tradeLimiter, asyncHandler(async (req: AuthedRequest, res) => {
  const profile = resolveProfileFromRequest(req);

  if (isTradingKillSwitchActive()) {
    return res.status(503).json({ error: 'kill_switch', message: 'Trading is temporarily disabled' });
  }
  if (!profile.writesAllowed) {
    return res.status(403).json({
      error: 'read_only',
      message: 'Trading writes are not enabled for this environment',
      environment: publicProfileSummary(profile),
    });
  }
  if (!isWalletAllowlisted(req.wallet!)) {
    return res.status(403).json({ error: 'not_allowlisted', message: 'Wallet not on trading allowlist' });
  }

  const parsed = RelaySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'invalid_payload', issues: parsed.error.issues });
  const { scope, actionName, body, envelopeJson, nonce, sig, market, side, quantity, price, orderType, source } = parsed.data;

  if (quantity && price) {
    const notional = quantity * price;
    if (notional > profile.maxNotionalUsd) {
      return res.status(403).json({
        error: 'notional_cap',
        maxNotionalUsd: profile.maxNotionalUsd,
        notional,
      });
    }
  }

  if (!ALLOWED_ACTIONS.has(actionName)) {
    return res.status(400).json({ error: 'action_not_allowed', actionName });
  }
  const route = ENDPOINT_MAP[`${scope}:${actionName}`];
  if (!route) return res.status(400).json({ error: 'unknown_route', key: `${scope}:${actionName}` });

  let recovered: string;
  try {
    const sigBytes = ethers.getBytes('0x' + sig.slice(4));
    if (sigBytes.length !== 65) throw new Error('sig length');
    sigBytes[64] = sigBytes[64] + 27;
    const ethSig = ethers.hexlify(sigBytes);
    const payloadHash = ethers.keccak256(ethers.toUtf8Bytes(envelopeJson));
    recovered = ethers.verifyTypedData(domain(scope, profile.chainId), ACTION_TYPES, { payloadHash, nonce }, ethSig);
  } catch (e: any) {
    return res.status(400).json({ error: 'sig_verify_failed', message: e?.message });
  }
  if (recovered.toLowerCase() !== req.wallet) {
    return res.status(401).json({ error: 'signer_mismatch', expected: req.wallet, recovered: recovered.toLowerCase() });
  }

  const assetFromMarket = (market ?? '').split('_')[0]?.replace(/^v/i, '').replace(/TEST/i, '') || '';
  const circuit = assertTradingAllowed(assetFromMarket || undefined);
  if (!circuit.ok) {
    return res.status(423).json({ error: 'circuit_breaker', message: circuit.reason });
  }

  let userId: string | null = null;
  try {
    const { data } = await supabase.from('user_profiles').select('id').eq('wallet_address', req.wallet).maybeSingle();
    if (data?.id) userId = data.id as string;
  } catch { /* ignore */ }

  if (side && quantity && price) {
    const risk = await runRiskAgent({
      userId: userId ?? undefined,
      asset: assetFromMarket || 'BTC',
      side,
      amount: quantity,
      price,
    });
    if (risk.verdict === 'REJECTED' || risk.verdict === 'HALT') {
      return res.status(403).json({ error: 'risk_rejected', verdict: risk.verdict, reasons: risk.reasons });
    }
  }

  const { data: inserted, error: insErr } = await supabase
    .from('signed_orders')
    .insert({
      user_id: userId,
      wallet_address: req.wallet,
      scope,
      action_name: actionName,
      market: market ?? null,
      side: side ?? null,
      quantity: quantity ?? null,
      price: price ?? null,
      order_type: orderType ?? null,
      nonce,
      sig,
      payload: body,
      source,
      status: 'pending',
    })
    .select('id').single();
  if (insErr) console.error('[sodex-relay] insert error:', insErr);
  const orderRowId = inserted?.id as string | undefined;

  const baseUrl = scope === 'spot' ? profile.spotRest : profile.perpsRest;
  const url = `${baseUrl}${route.path}`;
  const headers: Record<string, string> = {
    'X-API-Sign': sig,
    'X-API-Nonce': String(nonce),
    'X-API-Chain': String(profile.chainId),
    'Content-Type': 'application/json',
  };
  let upstream: any;
  let httpStatus = 500;
  try {
    const r = route.method === 'POST'
      ? await axios.post(url, body, { headers, timeout: 15_000 })
      : await axios.delete(url, { data: body, headers, timeout: 15_000 });
    upstream = r.data;
    httpStatus = r.status;
  } catch (e) {
    const ax = e as AxiosError<any>;
    upstream = ax.response?.data ?? { error: ax.message };
    httpStatus = ax.response?.status ?? 500;
  }

  const sodexCode = upstream?.code;
  const ok = httpStatus >= 200 && httpStatus < 300 && (sodexCode === 0 || sodexCode === undefined);
  const orderMeta = extractSodexOrderMeta(upstream);
  const finalStatus = mapExchangeStatusToRelayStatus(orderMeta.exchangeStatus, ok);
  if (orderRowId) {
    await supabase
      .from('signed_orders')
      .update({
        sodex_response: upstream,
        status: finalStatus,
        error_message: ok ? null : (upstream?.error || upstream?.message || orderMeta.exchangeStatus || `HTTP ${httpStatus}`),
        submitted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        finalized_at: ['filled', 'rejected'].includes(finalStatus) ? new Date().toISOString() : null,
      })
      .eq('id', orderRowId);
  }

  if (ok && side && price && assetFromMarket) {
    const fillPx = Number(upstream?.data?.avgPrice ?? upstream?.data?.price ?? price);
    recordTradeResult(assetFromMarket, estimatePnlPct(side, Number(price), fillPx));
  }

  return res.status(httpStatus).json({
    ok,
    orderId: orderRowId,
    sodexOrderId: orderMeta.sodexOrderId,
    exchangeStatus: orderMeta.exchangeStatus,
    status: finalStatus,
    environment: publicProfileSummary(profile),
    sodex: upstream,
  });
}));

router.get('/orders', requireWallet, asyncHandler(async (req: AuthedRequest, res) => {
  const limit = Math.min(Number(req.query.limit) || 50, 200);
  const { data, error } = await supabase
    .from('signed_orders')
    .select('*')
    .eq('wallet_address', req.wallet!)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ data: data ?? [] });
}));

router.get('/info', (req, res) => {
  const profile = resolveProfileFromRequest(req);
  res.json({
    chainId: profile.chainId,
    isTestnet: profile.isTestnet,
    spotBase: profile.spotRest,
    perpsBase: profile.perpsRest,
    writesAllowed: profile.writesAllowed,
    maxNotionalUsd: profile.maxNotionalUsd,
    environment: publicProfileSummary(profile),
    allowedActions: Array.from(ALLOWED_ACTIONS),
  });
});

export default router;
