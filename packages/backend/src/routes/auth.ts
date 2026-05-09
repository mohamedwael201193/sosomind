/**
 * Wallet-based authentication
 * Flow: POST /api/auth/nonce → user signs message → POST /api/auth/verify → JWT
 * Telegram linking: POST /api/auth/link-code → user does /link CODE in bot → POST /api/auth/link-telegram (internal)
 */
import { Router } from 'express';
import { ethers } from 'ethers';
import { createHmac, randomBytes } from 'crypto';
import { supabase } from '../db/supabase';
import { asyncHandler } from '../utils/http';

const router = Router();

const JWT_SECRET = process.env.JWT_SECRET || 'sosomind-dev-secret-change-in-prod';

// ── In-memory stores (single-instance; fine for dev) ──────────────────────
const nonceStore = new Map<string, { nonce: string; message: string; expires: number }>();
const linkCodes = new Map<string, { address: string; expires: number }>();

// ── JWT helpers ────────────────────────────────────────────────────────────
export function signToken(payload: Record<string, unknown>): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify({
    ...payload,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 86400 * 7, // 7 days
  })).toString('base64url');
  const sig = createHmac('sha256', JWT_SECRET).update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${sig}`;
}

export function verifyToken(token: string): Record<string, unknown> {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Invalid token format');
  const [h, b, s] = parts;
  const expected = createHmac('sha256', JWT_SECRET).update(`${h}.${b}`).digest('base64url');
  if (expected !== s) throw new Error('Invalid signature');
  const payload = JSON.parse(Buffer.from(b, 'base64url').toString('utf8'));
  if (payload.exp < Math.floor(Date.now() / 1000)) throw new Error('Token expired');
  return payload;
}

export function extractWallet(authHeader: string | undefined): string | null {
  if (!authHeader?.startsWith('Bearer ')) return null;
  try {
    const p = verifyToken(authHeader.slice(7));
    return typeof p.wallet === 'string' ? p.wallet : null;
  } catch {
    return null;
  }
}

// ── POST /api/auth/nonce  { address } ─────────────────────────────────────
router.post('/nonce', asyncHandler(async (req, res) => {
  const { address } = req.body ?? {};
  if (!address || !/^0x[0-9a-fA-F]{40}$/.test(address)) {
    return res.status(400).json({ error: 'Valid Ethereum address required (0x + 40 hex chars)' });
  }
  const addr = address.toLowerCase();
  const nonce = randomBytes(16).toString('hex');
  const ts = new Date().toISOString();
  const message =
    `Sign in to SosoMind\n\nWallet: ${address}\nNonce: ${nonce}\nTimestamp: ${ts}\n\n` +
    `This request will not trigger a blockchain transaction or cost any gas fees.`;

  nonceStore.set(addr, { nonce, message, expires: Date.now() + 5 * 60 * 1000 });
  res.json({ nonce, message, expiresInSeconds: 300 });
}));

// ── POST /api/auth/verify  { address, signature } ─────────────────────────
router.post('/verify', asyncHandler(async (req, res) => {
  const { address, signature } = req.body ?? {};
  if (!address || !signature) {
    return res.status(400).json({ error: 'address and signature required' });
  }
  const addr = address.toLowerCase();
  const stored = nonceStore.get(addr);
  if (!stored || Date.now() > stored.expires) {
    return res.status(401).json({ error: 'Nonce expired or not found. Request a new one.' });
  }

  let recovered: string;
  try {
    recovered = ethers.verifyMessage(stored.message, signature).toLowerCase();
  } catch {
    return res.status(401).json({ error: 'Invalid signature format' });
  }

  if (recovered !== addr) {
    return res.status(401).json({ error: 'Signature does not match address' });
  }

  // Consume nonce
  nonceStore.delete(addr);

  // Upsert user profile
  let profile: any = null;
  try {
    const { data } = await supabase
      .from('user_profiles')
      .upsert(
        { wallet_address: addr, last_seen_at: new Date().toISOString() },
        { onConflict: 'wallet_address' },
      )
      .select()
      .single();
    profile = data;
  } catch {
    // Table might not exist yet; continue without profile
    profile = { wallet_address: addr };
  }

  const token = signToken({
    sub: addr,
    wallet: addr,
    display: profile?.display_name ?? null,
  });

  res.json({ token, address: addr, profile: profile ?? { wallet_address: addr } });
}));

// ── GET /api/auth/me  (Bearer token required) ─────────────────────────────
router.get('/me', asyncHandler(async (req, res) => {
  const wallet = extractWallet(req.headers.authorization);
  if (!wallet) return res.status(401).json({ error: 'Valid Bearer token required' });

  let profile: any = { wallet_address: wallet };
  try {
    const { data } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('wallet_address', wallet)
      .single();
    if (data) profile = data;

    // Update last_seen
    await supabase
      .from('user_profiles')
      .update({ last_seen_at: new Date().toISOString() })
      .eq('wallet_address', wallet);
  } catch { /* table may not exist */ }

  res.json({ wallet, profile });
}));

// ── POST /api/auth/link-code  (Bearer required) — generate Telegram link code
router.post('/link-code', asyncHandler(async (req, res) => {
  const wallet = extractWallet(req.headers.authorization);
  if (!wallet) return res.status(401).json({ error: 'Valid Bearer token required' });

  const code = randomBytes(3).toString('hex').toUpperCase(); // e.g. "A3F7C2"
  linkCodes.set(code, { address: wallet, expires: Date.now() + 15 * 60 * 1000 });
  res.json({ code, expiresInMinutes: 15, instruction: `Send /link ${code} to @SosoMindbot on Telegram` });
}));

// ── POST /api/auth/link-telegram  (called internally by bot) ──────────────
router.post('/link-telegram', asyncHandler(async (req, res) => {
  const { code, telegramChatId } = req.body ?? {};
  if (!code || !telegramChatId) return res.status(400).json({ error: 'code and telegramChatId required' });

  const entry = linkCodes.get(code.toUpperCase());
  if (!entry || Date.now() > entry.expires) {
    return res.status(400).json({ error: 'Invalid or expired link code' });
  }
  linkCodes.delete(code.toUpperCase());

  try {
    await supabase
      .from('user_profiles')
      .upsert(
        { wallet_address: entry.address, telegram_chat_id: String(telegramChatId), last_seen_at: new Date().toISOString() },
        { onConflict: 'wallet_address' },
      );
  } catch { /* table may not exist */ }

  res.json({ success: true, address: entry.address });
}));

// ── GET /api/auth/check-link/:chatId  (called by bot) ─────────────────────
router.get('/check-link/:chatId', asyncHandler(async (req, res) => {
  try {
    const { data } = await supabase
      .from('user_profiles')
      .select('wallet_address, display_name, created_at')
      .eq('telegram_chat_id', req.params.chatId)
      .single();
    if (data) return res.json({ linked: true, wallet: data.wallet_address, display: data.display_name });
  } catch { /* ignore */ }
  res.json({ linked: false });
}));

export default router;
