"use client";
/**
 * /trade/wizard — 4-step copy-trade wizard.
 *
 * Step 1 · Pick Signal      — choose a live signal or template.
 * Step 2 · Configure Size   — select asset, qty (% of USDC), order type, price.
 * Step 3 · Risk Pre-Flight  — server-side checks: circuit, asset block, slippage, exposure.
 * Step 4 · Sign & Submit    — EIP-712 signed via existing placeSpotOrder.
 *
 * Reuses: useWallet, placeSpotOrder, fetchWithMeta, /api/risk/preflight.
 */
import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { fetchWithMeta, fetcher } from "@/lib/api";
import { placeSpotOrder } from "@/lib/sodex-client";
import { useWallet } from "@/context/WalletContext";
import { GlassCard } from "@/components/GlassCard";
import { CacheBadge } from "@/components/CacheBadge";
import { CryptoIcon } from "@/components/CryptoIcon";
import {
  Check, ChevronRight, ChevronLeft, AlertTriangle, ShieldCheck, Zap,
  Loader2, Wallet, ArrowRight, Sparkles,
} from "lucide-react";

interface SignalRow {
  id?: string;
  symbol: string;
  side: 'long' | 'short' | 'buy' | 'sell' | string;
  confidence?: number;
  entry?: number;
  target?: number;
  stop?: number;
  agent?: string;
  rationale?: string;
  created_at?: string;
}

interface PreflightCheck { id: string; label: string; status: 'pass' | 'warn' | 'fail'; detail: string; }
interface Preflight {
  overall: 'pass' | 'warn' | 'fail';
  canProceed: boolean;
  checks: PreflightCheck[];
}

const STEP_LABELS = ['Signal', 'Size', 'Risk', 'Sign'];

function fmtMoney(n: number, d = 2) {
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
}

function dc(coin: string): string {
  if (!coin) return '';
  if (coin === 'WSOSO') return 'SOSO';
  return coin.startsWith('v') ? coin.slice(1) : coin;
}

function WizardInner() {
  const params = useSearchParams();
  const { address } = useWallet();

  const [step, setStep] = useState(0);
  const [signal, setSignal] = useState<SignalRow | null>(null);
  const [side, setSide] = useState<'buy' | 'sell'>('buy');
  const [orderType, setOrderType] = useState<'limit' | 'market'>('market');
  const [pctSize, setPctSize] = useState(10);
  const [limitPx, setLimitPx] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<any>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // ── data: signals + symbols + balances + ticker ────────────────
  const { data: signalsResp } = useQuery({
    queryKey: ['wizard', 'signals'],
    queryFn: () => fetchWithMeta<SignalRow[]>('/api/agents/signals?limit=12'),
    refetchInterval: 30_000,
  });
  const signals = signalsResp?.data ?? [];

  const { data: symbols = [] } = useQuery<any[]>({
    queryKey: ['wizard', 'symbols'],
    queryFn: () => fetcher('/api/sodex/spot/symbols'),
    staleTime: 5 * 60_000,
  });

  const { data: balData } = useQuery({
    queryKey: ['wizard', 'balances', address],
    queryFn: () => fetcher(`/api/sodex/account/balances?wallet=${address}`),
    enabled: !!address,
    refetchInterval: 15_000,
  });
  const usdc = useMemo(() => {
    const list = (balData as any)?.balances ?? [];
    const u = list.find((b: any) => b.coin === 'vUSDC' || b.coin === 'USDC');
    return u ? Number(u.total) - Number(u.locked || 0) : 0;
  }, [balData]);

  // Asset chosen from signal (e.g. 'BTC' or 'MAG7.ssi')
  const asset = useMemo(() => {
    if (!signal) return null;
    const sym = String(signal.symbol ?? '');
    // SSI index tickers pass through unchanged
    if (sym.includes('.ssi') || sym === 'USSI') return sym;
    return sym.replace(/USDT|USDC|\/.*/, '').toUpperCase();
  }, [signal]);

  // Find sodex spot symbol (e.g. vBTC_vUSDC)
  // MAG7.ssi is tradeable on SoDEX Spot via Mirror Protocol
  const symbol = useMemo(() => {
    if (!asset || !symbols?.length) return null;
    if (asset === 'MAG7.ssi') {
      // MAG7.ssi traded via Mirror Protocol on SoDEX Spot
      return (symbols as any[]).find((s) =>
        (s.baseCoin === 'MAG7.ssi' || s.baseCoin === 'vMAG7' || s.name?.includes('MAG7')) &&
        (s.quoteCoin === 'vUSDC' || s.quoteCoin === 'USDC')
      ) ?? { name: 'MAG7.ssi_vUSDC', id: 0, baseCoin: 'MAG7.ssi', quoteCoin: 'vUSDC', pricePrecision: 4, quantityPrecision: 4 };
    }
    const want = `v${asset}`;
    return (symbols as any[]).find((s) => s.baseCoin === want && (s.quoteCoin === 'vUSDC' || s.quoteCoin === 'USDC')) ?? null;
  }, [asset, symbols]);

  // Live ticker for chosen asset
  const { data: tickerData } = useQuery({
    queryKey: ['wizard', 'ticker', asset],
    queryFn: () => fetcher(`/api/market/price/${asset}`),
    enabled: !!asset,
    refetchInterval: 10_000,
  });
  const livePx = Number((tickerData as any)?.price ?? 0);

  // Default limit price
  useEffect(() => {
    if (orderType === 'limit' && livePx > 0 && !limitPx) {
      setLimitPx(livePx.toFixed(symbol?.pricePrecision ?? 2));
    }
  }, [orderType, livePx, limitPx, symbol]);

  // Side pre-fill from signal
  useEffect(() => {
    if (signal) {
      const s = String(signal.side).toLowerCase();
      setSide(s === 'short' || s === 'sell' ? 'sell' : 'buy');
    }
  }, [signal]);

  const px = orderType === 'market' ? livePx : Number(limitPx || livePx);
  const notional = (usdc * pctSize) / 100;
  const qty = px > 0 ? notional / px : 0;

  // ── preflight when entering step 3 ───────────────────────────────
  const [preflight, setPreflight] = useState<Preflight | null>(null);
  const [preflightLoading, setPreflightLoading] = useState(false);
  async function runPreflight() {
    if (!asset) return;
    setPreflightLoading(true);
    try {
      const market = symbol?.name ?? `v${asset}_vUSDC`;
      const url = `/api/risk/preflight?asset=${asset}&qty=${qty}&price=${px}&side=${side}&market=${market}&walletUsdc=${usdc}`;
      const r = await fetchWithMeta<Preflight>(url);
      setPreflight(r.data);
    } finally { setPreflightLoading(false); }
  }
  useEffect(() => { if (step === 2) runPreflight(); /* eslint-disable-next-line */ }, [step]);

  async function submit() {
    if (!symbol || !asset) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const result = await placeSpotOrder({
        accountID: 0,
        symbolID: Number(symbol.id),
        market: symbol.name,
        side,
        orderType,
        quantity: Number(qty.toFixed(symbol.quantityPrecision ?? 4)),
        price: orderType === 'limit' ? Number(Number(limitPx).toFixed(symbol.pricePrecision ?? 2)) : undefined,
      });
      setSubmitResult(result);
    } catch (e: any) {
      setSubmitError(e?.message ?? 'Submission failed');
    } finally { setSubmitting(false); }
  }

  function reset() {
    setStep(0); setSignal(null); setSubmitResult(null); setSubmitError(null);
    setPctSize(10); setLimitPx(''); setOrderType('market');
  }

  return (
    <div className="min-h-screen px-6 lg:px-10 py-8" style={{ background: 'var(--bg-base)' }}>
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
        className="mb-6 flex items-end justify-between flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2 text-xs uppercase tracking-[0.2em]" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
            <Sparkles className="w-3.5 h-3.5" style={{ color: 'var(--accent)' }} />
            Copy-Trade Wizard · SoDEX execution
          </div>
          <h1 className="text-3xl lg:text-4xl font-black tracking-tight" style={{ fontFamily: 'var(--font-display)', color: 'var(--text-primary)', letterSpacing: '-0.04em' }}>
            One signal → one order, in <span style={{ color: 'var(--accent)' }}>4 steps</span>.
          </h1>
        </div>
        <Link href="/trade" className="text-xs px-3 py-2 rounded-lg border" style={{ borderColor: 'var(--glass-border)', color: 'var(--text-secondary)' }}>
          Open advanced terminal →
        </Link>
      </motion.div>

      {/* Stepper */}
      <div className="mb-8 grid grid-cols-4 gap-3">
        {STEP_LABELS.map((label, i) => {
          const done = i < step;
          const active = i === step;
          return (
            <button key={label} type="button" onClick={() => i < step && setStep(i)}
              className="text-left rounded-xl border p-3 transition"
              style={{
                borderColor: active ? 'var(--accent)' : done ? 'rgb(80,220,160)' : 'var(--glass-border)',
                background: active ? 'color-mix(in srgb, var(--accent) 10%, transparent)' : 'var(--bg-card)',
              }}>
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold"
                  style={{
                    background: done ? 'rgb(80,220,160)' : active ? 'var(--accent)' : 'var(--glass-border)',
                    color: '#0a0a0a', fontFamily: 'var(--font-mono)',
                  }}>
                  {done ? <Check className="w-3.5 h-3.5" /> : i + 1}
                </span>
                <div>
                  <div className="text-[10px] uppercase tracking-[0.18em]" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                    Step {i + 1}
                  </div>
                  <div className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{label}</div>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <AnimatePresence mode="wait">
        {/* STEP 1 */}
        {step === 0 && (
          <motion.div key="s0" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.3 }}>
            <GlassCard padding="lg">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm uppercase tracking-[0.2em]" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                  Pick a live signal
                </h2>
                <CacheBadge meta={signalsResp?.meta} />
              </div>
              {signals.length === 0 && (
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                  No live signals yet — agents publish every research cycle. You can also enter a manual order via the
                  <Link href="/trade" className="mx-1" style={{ color: 'var(--accent)' }}>advanced terminal</Link>.
                </p>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {signals.map((s, i) => {
                  const sym = String(s.symbol ?? '').replace(/USDT|USDC|\/.*/, '').toUpperCase();
                  const sideTag = String(s.side ?? '').toUpperCase();
                  const isLong = sideTag.includes('LONG') || sideTag === 'BUY';
                  const isPicked = signal === s;
                  return (
                    <motion.button key={s.id ?? `${sym}-${i}`} type="button" onClick={() => setSignal(s)}
                      whileHover={{ y: -2 }} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                      className="text-left rounded-2xl border p-4 transition"
                      style={{
                        borderColor: isPicked ? 'var(--accent)' : 'var(--glass-border)',
                        background: isPicked ? 'color-mix(in srgb, var(--accent) 8%, var(--bg-card))' : 'var(--bg-card)',
                      }}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <CryptoIcon symbol={sym} size={28} />
                          <div>
                            <div className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{sym}/USDC</div>
                            <div className="text-[10px] uppercase tracking-[0.15em]" style={{ color: 'var(--text-muted)' }}>{s.agent ?? 'agent'}</div>
                          </div>
                        </div>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider"
                          style={{
                            background: isLong ? 'rgba(80,220,160,0.15)' : 'rgba(255,90,90,0.15)',
                            color: isLong ? 'rgb(80,220,160)' : 'rgb(255,90,90)',
                            fontFamily: 'var(--font-mono)',
                          }}>{sideTag || (isLong ? 'LONG' : 'SHORT')}</span>
                      </div>
                      {s.rationale && (
                        <p className="text-xs leading-relaxed mb-2 line-clamp-2" style={{ color: 'var(--text-secondary)' }}>{s.rationale}</p>
                      )}
                      <div className="grid grid-cols-3 text-[10px] gap-2" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                        <div>Confidence<br /><span className="text-sm" style={{ color: 'var(--text-primary)' }}>{s.confidence ?? '—'}%</span></div>
                        <div>Entry<br /><span className="text-sm" style={{ color: 'var(--text-primary)' }}>{s.entry ? fmtMoney(s.entry) : '—'}</span></div>
                        <div>Target<br /><span className="text-sm" style={{ color: 'var(--text-primary)' }}>{s.target ? fmtMoney(s.target) : '—'}</span></div>
                      </div>
                    </motion.button>
                  );
                })}
              </div>

              {/* SSI Index Baskets — tradeable on SoDEX Spot via Mirror Protocol */}
              <div className="mt-5 pt-4 border-t" style={{ borderColor: 'var(--glass-border)' }}>
                <div className="text-[10px] uppercase tracking-[0.2em] mb-3 flex items-center gap-2"
                  style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                  <Sparkles className="w-3 h-3" style={{ color: 'var(--accent)' }} />
                  SSI Index Baskets — tradeable on SoDEX via Mirror Protocol
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {[
                    { ticker: 'MAG7.ssi', label: 'MAG7', desc: 'Top 7 by market cap', badge: 'SPOT' },
                    { ticker: 'DEFI.ssi', label: 'DEFI', desc: 'Top DeFi protocols', badge: 'SPOT' },
                    { ticker: 'MEME.ssi', label: 'MEME', desc: 'Top 10 meme tokens', badge: 'SPOT' },
                    { ticker: 'USSI', label: 'USSI', desc: 'Hedged USD index', badge: 'STABLE' },
                  ].map((p) => {
                    const fakeSignal: SignalRow = { symbol: p.ticker, side: 'buy', agent: 'SSI Protocol', rationale: p.desc, confidence: 100 };
                    const isPicked = signal?.symbol === p.ticker;
                    return (
                      <motion.button key={p.ticker} type="button"
                        onClick={() => { setSignal(fakeSignal); setSide('buy'); }}
                        whileHover={{ y: -2 }}
                        className="text-left rounded-xl border p-3 transition"
                        style={{
                          borderColor: isPicked ? 'var(--accent)' : 'var(--glass-border)',
                          background: isPicked ? 'color-mix(in srgb, var(--accent) 10%, var(--bg-card))' : 'var(--bg-card)',
                        }}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>{p.label}</span>
                          <span className="text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider"
                            style={{ background: 'rgba(249,115,22,0.15)', color: 'var(--accent)', fontFamily: 'var(--font-mono)' }}>
                            {p.badge}
                          </span>
                        </div>
                        <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{p.desc}</div>
                        <div className="text-[9px] mt-1" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>Cobo/Ceffu custody</div>
                      </motion.button>
                    );
                  })}
                </div>
              </div>

              <div className="mt-5 flex justify-end">
                <button type="button" disabled={!signal} onClick={() => setStep(1)}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl font-bold text-sm"
                  style={{ background: 'var(--accent)', color: '#0a0a0a', opacity: signal ? 1 : 0.4 }}>
                  Configure size <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </GlassCard>
          </motion.div>
        )}

        {/* STEP 2 */}
        {step === 1 && signal && (
          <motion.div key="s1" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.3 }}>
            <GlassCard padding="lg">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="text-[10px] uppercase tracking-[0.2em]" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>Step 2 · Size & order type</div>
                  <h2 className="text-xl font-bold" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>
                    Trading <span style={{ color: 'var(--accent)' }}>{asset}/USDC</span>
                  </h2>
                </div>
                <div className="text-right">
                  <div className="text-[10px] uppercase tracking-[0.2em]" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>Live price</div>
                  <div className="text-lg font-bold" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>${fmtMoney(livePx)}</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 mb-4">
                {(['buy', 'sell'] as const).map((s) => (
                  <button key={s} type="button" onClick={() => setSide(s)}
                    className="py-3 rounded-xl text-sm font-bold uppercase tracking-wider border transition"
                    style={{
                      borderColor: side === s ? (s === 'buy' ? 'rgb(80,220,160)' : 'rgb(255,90,90)') : 'var(--glass-border)',
                      background: side === s ? `color-mix(in srgb, ${s === 'buy' ? 'rgb(80,220,160)' : 'rgb(255,90,90)'} 15%, transparent)` : 'transparent',
                      color: side === s ? (s === 'buy' ? 'rgb(80,220,160)' : 'rgb(255,90,90)') : 'var(--text-secondary)',
                      fontFamily: 'var(--font-mono)',
                    }}>{s}</button>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-2 mb-4">
                {(['market', 'limit'] as const).map((t) => (
                  <button key={t} type="button" onClick={() => setOrderType(t)}
                    className="py-2 rounded-lg text-xs uppercase tracking-wider border"
                    style={{
                      borderColor: orderType === t ? 'var(--accent)' : 'var(--glass-border)',
                      background: orderType === t ? 'color-mix(in srgb, var(--accent) 12%, transparent)' : 'transparent',
                      color: orderType === t ? 'var(--accent)' : 'var(--text-secondary)',
                      fontFamily: 'var(--font-mono)',
                    }}>{t}</button>
                ))}
              </div>

              {orderType === 'limit' && (
                <div className="mb-4">
                  <label className="block text-[10px] uppercase tracking-[0.2em] mb-1" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>Limit price (USDC)</label>
                  <input type="number" value={limitPx} onChange={(e) => setLimitPx(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border outline-none"
                    style={{ borderColor: 'var(--glass-border)', background: 'var(--bg-card)', color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }} />
                </div>
              )}

              <label className="block text-[10px] uppercase tracking-[0.2em] mb-1" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                Size · {pctSize}% of available USDC
              </label>
              <input type="range" min={1} max={100} value={pctSize} onChange={(e) => setPctSize(Number(e.target.value))}
                className="w-full mb-2" style={{ accentColor: 'var(--accent)' }} />
              <div className="grid grid-cols-4 gap-1.5 mb-4">
                {[10, 25, 50, 100].map((p) => (
                  <button key={p} type="button" onClick={() => setPctSize(p)}
                    className="py-1.5 text-[10px] uppercase tracking-wider rounded-lg border"
                    style={{
                      borderColor: pctSize === p ? 'var(--accent)' : 'var(--glass-border)',
                      color: pctSize === p ? 'var(--accent)' : 'var(--text-secondary)',
                      fontFamily: 'var(--font-mono)',
                    }}>{p}%</button>
                ))}
              </div>

              <div className="grid grid-cols-3 gap-3 p-3 rounded-xl border" style={{ borderColor: 'var(--glass-border)', background: 'var(--bg-card)' }}>
                <Stat label="Available" value={`$${fmtMoney(usdc)}`} />
                <Stat label="Notional"  value={`$${fmtMoney(notional)}`} accent />
                <Stat label={`Qty ${asset}`} value={fmtMoney(qty, 6)} />
              </div>

              <div className="mt-5 flex justify-between">
                <button type="button" onClick={() => setStep(0)} className="inline-flex items-center gap-1 px-4 py-2.5 rounded-xl border text-sm"
                  style={{ borderColor: 'var(--glass-border)', color: 'var(--text-secondary)' }}>
                  <ChevronLeft className="w-4 h-4" /> Back
                </button>
                <button type="button" onClick={() => setStep(2)} disabled={qty <= 0 || !symbol}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl font-bold text-sm"
                  style={{ background: 'var(--accent)', color: '#0a0a0a', opacity: qty > 0 && symbol ? 1 : 0.4 }}>
                  Run preflight <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </GlassCard>
          </motion.div>
        )}

        {/* STEP 3 */}
        {step === 2 && (
          <motion.div key="s2" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.3 }}>
            <GlassCard padding="lg" glow={preflight?.overall === 'fail' ? 'red' : preflight?.overall === 'warn' ? 'orange' : 'green'}>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="text-[10px] uppercase tracking-[0.2em]" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>Step 3 · Risk pre-flight</div>
                  <h2 className="text-xl font-bold" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>
                    Server-side guardrails
                  </h2>
                </div>
                <button type="button" onClick={runPreflight} className="text-xs px-3 py-1.5 rounded-lg border"
                  style={{ borderColor: 'var(--glass-border)', color: 'var(--text-secondary)' }}>
                  {preflightLoading ? 'Re-running…' : 'Re-run'}
                </button>
              </div>

              {preflightLoading && (
                <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-muted)' }}>
                  <Loader2 className="w-4 h-4 animate-spin" /> Running checks…
                </div>
              )}

              <div className="space-y-2">
                {preflight?.checks?.map((c, i) => {
                  const tint = c.status === 'pass' ? 'rgb(80,220,160)' : c.status === 'warn' ? 'rgb(255,170,40)' : 'rgb(255,90,90)';
                  const Icon = c.status === 'pass' ? ShieldCheck : c.status === 'warn' ? AlertTriangle : AlertTriangle;
                  return (
                    <motion.div key={c.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
                      className="flex items-start gap-3 p-3 rounded-xl border"
                      style={{ borderColor: `color-mix(in srgb, ${tint} 30%, transparent)`, background: 'var(--bg-card)' }}>
                      <Icon className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: tint }} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <div className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{c.label}</div>
                          <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded" style={{ background: `color-mix(in srgb, ${tint} 18%, transparent)`, color: tint, fontFamily: 'var(--font-mono)' }}>
                            {c.status}
                          </span>
                        </div>
                        <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>{c.detail}</p>
                      </div>
                    </motion.div>
                  );
                })}
              </div>

              <div className="mt-5 flex justify-between">
                <button type="button" onClick={() => setStep(1)} className="inline-flex items-center gap-1 px-4 py-2.5 rounded-xl border text-sm"
                  style={{ borderColor: 'var(--glass-border)', color: 'var(--text-secondary)' }}>
                  <ChevronLeft className="w-4 h-4" /> Back
                </button>
                <button type="button" onClick={() => setStep(3)} disabled={!preflight?.canProceed}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl font-bold text-sm"
                  style={{ background: 'var(--accent)', color: '#0a0a0a', opacity: preflight?.canProceed ? 1 : 0.4 }}>
                  Continue to sign <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </GlassCard>
          </motion.div>
        )}

        {/* STEP 4 */}
        {step === 3 && (
          <motion.div key="s3" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.3 }}>
            <GlassCard padding="lg" glow="orange">
              <div className="text-[10px] uppercase tracking-[0.2em] mb-1" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>Step 4 · Sign & submit</div>
              <h2 className="text-xl font-bold mb-4" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>
                Order summary
              </h2>

              <dl className="grid grid-cols-2 gap-y-2 gap-x-6 mb-6 text-sm">
                <Row label="Asset"     v={`${asset}/USDC`} />
                <Row label="Side"      v={side.toUpperCase()} accent={side === 'buy' ? 'green' : 'red'} />
                <Row label="Type"      v={orderType.toUpperCase()} />
                <Row label="Quantity"  v={`${fmtMoney(qty, 6)} ${asset}`} />
                <Row label="Price"     v={`$${fmtMoney(px)}`} />
                <Row label="Notional"  v={`$${fmtMoney(notional)}`} accent="orange" />
                <Row label="Wallet"    v={address ? `${address.slice(0, 6)}…${address.slice(-4)}` : 'Not connected'} />
                <Row label="Signal"    v={signal?.id ? signal.id.slice(0, 8) : signal?.agent ?? '—'} />
              </dl>

              {!address && (
                <div className="mb-4 p-3 rounded-xl border flex items-center gap-2"
                  style={{ borderColor: 'rgba(255,170,40,0.4)', background: 'rgba(255,170,40,0.05)', color: 'rgb(255,170,40)' }}>
                  <Wallet className="w-4 h-4" /> <span className="text-xs">Connect a wallet to sign the EIP-712 message.</span>
                </div>
              )}

              {submitError && (
                <div className="mb-4 p-3 rounded-xl border text-xs"
                  style={{ borderColor: 'rgba(255,90,90,0.4)', background: 'rgba(255,90,90,0.06)', color: 'rgb(255,90,90)' }}>
                  {submitError}
                </div>
              )}

              {submitResult && (
                <div className="mb-4 p-4 rounded-xl border"
                  style={{ borderColor: 'rgba(80,220,160,0.4)', background: 'rgba(80,220,160,0.06)' }}>
                  <div className="flex items-center gap-2 mb-2" style={{ color: 'rgb(80,220,160)' }}>
                    <Check className="w-4 h-4" /> <span className="text-sm font-bold">Order submitted</span>
                  </div>
                  <pre className="text-[10px] overflow-x-auto" style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
{JSON.stringify(submitResult, null, 2).slice(0, 600)}
                  </pre>
                </div>
              )}

              <div className="flex justify-between">
                <button type="button" onClick={() => setStep(2)} disabled={submitting} className="inline-flex items-center gap-1 px-4 py-2.5 rounded-xl border text-sm"
                  style={{ borderColor: 'var(--glass-border)', color: 'var(--text-secondary)' }}>
                  <ChevronLeft className="w-4 h-4" /> Back
                </button>
                {submitResult ? (
                  <button type="button" onClick={reset}
                    className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl font-bold text-sm"
                    style={{ background: 'rgb(80,220,160)', color: '#0a0a0a' }}>
                    Trade another <ArrowRight className="w-4 h-4" />
                  </button>
                ) : (
                  <button type="button" onClick={submit} disabled={!address || submitting}
                    className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl font-bold text-sm"
                    style={{ background: 'var(--accent)', color: '#0a0a0a', opacity: address && !submitting ? 1 : 0.4 }}>
                    {submitting ? (<><Loader2 className="w-4 h-4 animate-spin" /> Signing…</>) : (<><Zap className="w-4 h-4" /> Sign & submit</>)}
                  </button>
                )}
              </div>
            </GlassCard>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-[0.18em]" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{label}</div>
      <div className="text-base font-bold" style={{ color: accent ? 'var(--accent)' : 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{value}</div>
    </div>
  );
}
function Row({ label, v, accent }: { label: string; v: string; accent?: 'green' | 'red' | 'orange' }) {
  const c = accent === 'green' ? 'rgb(80,220,160)' : accent === 'red' ? 'rgb(255,90,90)' : accent === 'orange' ? 'var(--accent)' : 'var(--text-primary)';
  return (
    <div className="flex justify-between border-b py-1.5" style={{ borderColor: 'var(--glass-border)' }}>
      <dt className="text-xs uppercase tracking-[0.15em]" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{label}</dt>
      <dd className="text-sm font-bold" style={{ color: c, fontFamily: 'var(--font-mono)' }}>{v}</dd>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<div className="p-10 text-sm" style={{ color: 'var(--text-muted)' }}>Loading wizard…</div>}>
      <WizardInner />
    </Suspense>
  );
}
