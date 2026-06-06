/**
 * SoDEX Relay — non-custodial trading endpoint.
 *
 * The user signs an EIP-712 ExchangeAction in their browser (MetaMask) using
 * the algorithm in `lib/sodex-signing.ts` (mirrors backend `clients/sodex.ts:signBody`).
 * They POST the signed payload here. We:
 *   1. Verify the JWT (so we know who they are)
 *   2. Allowlist the action (only spot/perps order place/cancel)
 *   3. Re-derive the signing address from the signature and check it matches the JWT wallet
 *   4. Persist a row in `signed_orders` (audit trail)
 *   5. Forward to the official SoDEX REST gateway with the user's headers
 *   6. Persist the response and return it
 *
 * The backend NEVER touches a user private key.
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

const router = Router();

// ── Allowlist: only writes the user might intentionally make ──────────────
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

// SoDEX gateways (read from env so testnet/mainnet toggle works)
const CHAIN_ID = parseInt(process.env.SODEX_CHAIN_ID || '138565', 10);
const IS_TESTNET = CHAIN_ID === 138565;
const SPOT_BASE  = IS_TESTNET ? 'https://testnet-gw.sodex.dev/api/v1/spot'  : 'https://mainnet-gw.sodex.dev/api/v1/spot';
const PERPS_BASE = IS_TESTNET ? 'https://testnet-gw.sodex.dev/api/v1/perps' : 'https://mainnet-gw.sodex.dev/api/v1/perps';

// ── Per-user rate limit: 30 trades / min ──────────────────────────────────
const tradeLimiter = rateLimit({
  windowMs: 60_000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => (req as AuthedRequest).wallet || req.ip || 'anon',
  message: { error: 'rate_limited', message: 'Max 30 orders per minute per wallet' },
});

// ── EIP-712 type used for verification (must mirror clients/sodex.ts) ─────
const ACTION_TYPES = {
  ExchangeAction: [
    { name: 'payloadHash', type: 'bytes32' },
    { name: 'nonce',       type: 'uint64' },
  ],
};
function domain(scope: 'spot' | 'futures') {
  return { name: scope, version: '1', chainId: CHAIN_ID, verifyingContract: '0x0000000000000000000000000000000000000000' };
}

const RelaySchema = z.object({
  scope:       z.enum(SCOPES),
  actionName:  z.string().min(1),
  body:        z.record(z.string(), z.any()),       // action params (Go field order encoded by client)
  envelopeJson: z.string().min(1),                  // exact JSON.stringify({type, params}) the client signed
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
  const parsed = RelaySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'invalid_payload', issues: parsed.error.issues });
  const { scope, actionName, body, envelopeJson, nonce, sig, market, side, quantity, price, orderType, source } = parsed.data;

  if (!ALLOWED_ACTIONS.has(actionName)) {
    return res.status(400).json({ error: 'action_not_allowed', actionName });
  }
  const route = ENDPOINT_MAP[`${scope}:${actionName}`];
  if (!route) return res.status(400).json({ error: 'unknown_route', key: `${scope}:${actionName}` });

  // ── 1. Recover signer from the wire signature & verify it matches JWT ───
  // Wire format: 0x01 + r(32) + s(32) + v(0|1).  ethers.verifyTypedData wants 0x + r + s + v(27|28).
  let recovered: string;
  try {
    const sigBytes = ethers.getBytes('0x' + sig.slice(4));    // strip leading 0x01
    if (sigBytes.length !== 65) throw new Error('sig length');
    sigBytes[64] = sigBytes[64] + 27;                          // 0/1 → 27/28
    const ethSig = ethers.hexlify(sigBytes);
    const payloadHash = ethers.keccak256(ethers.toUtf8Bytes(envelopeJson));
    recovered = ethers.verifyTypedData(domain(scope), ACTION_TYPES, { payloadHash, nonce }, ethSig);
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

  // ── 3. Persist the audit row BEFORE submitting (so we have a trail even on failure) ──
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

  // ── 4. Forward to SoDEX with the user's signed headers ──────────────────
  const baseUrl = scope === 'spot' ? SPOT_BASE : PERPS_BASE;
  const url = `${baseUrl}${route.path}`;
  const headers: Record<string, string> = {
    'X-API-Sign': sig,
    'X-API-Nonce': String(nonce),
    'X-API-Chain': String(CHAIN_ID),
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

  // ── 5. Determine status & persist response ──────────────────────────────
  const sodexCode = upstream?.code;
  const ok = httpStatus >= 200 && httpStatus < 300 && (sodexCode === 0 || sodexCode === undefined);
  const finalStatus = ok ? 'submitted' : 'rejected';
  if (orderRowId) {
    await supabase
      .from('signed_orders')
      .update({
        sodex_response: upstream,
        status: finalStatus,
        error_message: ok ? null : (upstream?.error || upstream?.message || `HTTP ${httpStatus}`),
        submitted_at: new Date().toISOString(),
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
    status: finalStatus,
    sodex: upstream,
  });
}));

// ── List the signed-in user's signed orders ───────────────────────────────
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

// ── Lightweight info endpoint for the dashboard signing client ───────────
router.get('/info', (_req, res) => {
  res.json({
    chainId: CHAIN_ID,
    isTestnet: IS_TESTNET,
    spotBase: SPOT_BASE,
    perpsBase: PERPS_BASE,
    allowedActions: Array.from(ALLOWED_ACTIONS),
  });
});

export default router;
