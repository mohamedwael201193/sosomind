"use client";
import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { fetchWithMeta, api } from "@/lib/api";
import { GlassCard } from "@/components/GlassCard";
import { CacheBadge } from "@/components/CacheBadge";
import { CryptoIcon } from "@/components/CryptoIcon";
import { ArrowUpRight, ArrowDownRight, Sparkles, Layers, ShieldCheck, TrendingUp, Brain, Activity } from "lucide-react";
import { LabsPreviewBanner } from "@/components/LabsPreviewBanner";

interface SSIProduct {
  ticker: string;
  name?: string;
  sector: string;
  thesis: string;
  price: number;
  change24h: number;
  tvl: number;
  apy: number;
  holders?: number;
  roi_7d?: number | null;
  roi_1m?: number | null;
  roi_3m?: number | null;
  roi_1y?: number | null;
  ytd?: number | null;
}

interface Constituent {
  symbol: string;
  name: string;
  weight: number;
  weight_pct: number;
  change24h: number;
  price: number;
}

interface Composite {
  product: SSIProduct;
  constituents: any[];
  klines: any[];
}

const PERSONAS: { id: 'aggressive' | 'balanced' | 'conservative' | 'quant' | 'swing'; label: string; sub: string }[] = [
  { id: 'conservative', label: 'Conservative', sub: 'Low vol · Mag7 + RWA bias' },
  { id: 'balanced',     label: 'Balanced',     sub: 'L1 + DeFi core' },
  { id: 'aggressive',   label: 'Aggressive',   sub: 'AI + meme tilt' },
  { id: 'quant',        label: 'Quant',        sub: 'TVL & momentum-weighted' },
  { id: 'swing',        label: 'Swing',        sub: 'High |Δ24h| baskets' },
];

function fmtMoney(n: number) {
  if (!Number.isFinite(n) || n === 0) return '—';
  if (Math.abs(n) >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(2)}B`;
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(2)}K`;
  return `$${n.toFixed(4)}`;
}
function fmtPct(n: number) {
  if (!Number.isFinite(n)) return '—';
  return `${n > 0 ? '+' : ''}${n.toFixed(2)}%`;
}

function SSICard({ p, active, onClick, index }: { p: SSIProduct; active: boolean; onClick: () => void; index: number }) {
  const [spot, setSpot] = useState({ x: 0, y: 0, visible: false });
  const up = p.change24h >= 0;
  const name = (p.name ?? p.ticker.replace(/^ssi/i, '')) || p.ticker;

  const roiRows = [
    { label: '7D',  val: p.roi_7d  },
    { label: '1M',  val: p.roi_1m  },
    { label: '3M',  val: p.roi_3m  },
    { label: '1Y',  val: p.roi_1y  },
  ].filter(r => r.val != null && Number.isFinite(r.val));

  const maxAbs = Math.max(...roiRows.map(r => Math.abs(r.val ?? 0)), 0.01);

  return (
    <motion.button
      type="button"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
      onClick={onClick}
      whileHover={{ y: -3 }}
      whileTap={{ scale: 0.985 }}
      className="relative text-left rounded-2xl overflow-hidden w-full"
      style={{
        border: active ? '1px solid var(--accent)' : '1px solid rgba(255,255,255,0.07)',
        background: active ? 'color-mix(in srgb, var(--accent) 6%, var(--bg-card))' : 'var(--bg-card)',
        boxShadow: active ? '0 0 32px color-mix(in srgb, var(--accent) 22%, transparent), inset 0 1px 0 rgba(255,255,255,0.08)' : 'inset 0 1px 0 rgba(255,255,255,0.04)',
      }}
      onMouseMove={e => {
        const r = e.currentTarget.getBoundingClientRect();
        setSpot({ x: e.clientX - r.left, y: e.clientY - r.top, visible: true });
      }}
      onMouseLeave={() => setSpot(s => ({ ...s, visible: false }))}
    >
      {/* Spotlight */}
      <div className="pointer-events-none absolute inset-0 rounded-2xl transition-opacity duration-300"
        style={{ opacity: spot.visible ? 1 : 0, background: `radial-gradient(480px circle at ${spot.x}px ${spot.y}px, rgba(249,115,22,0.10), transparent 55%)` }} />

      {/* Active top shimmer */}
      {active && (
        <div className="absolute top-0 left-8 right-8 h-[1px]"
          style={{ background: 'linear-gradient(90deg, transparent, var(--accent), transparent)' }} />
      )}

      <div className="p-4">
        {/* Header row */}
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center font-black text-[11px] flex-shrink-0"
              style={{ background: 'color-mix(in srgb, var(--accent) 16%, transparent)', color: 'var(--accent)', fontFamily: 'var(--font-mono)', letterSpacing: '-0.01em' }}>
              {name.length > 5 ? name.slice(0, 5) : name}
            </div>
            <div className="min-w-0">
              <div className="font-bold text-sm leading-tight truncate" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>
                {name}
              </div>
              <div className="text-[10px] mt-0.5 leading-none uppercase tracking-[0.1em]" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                {p.sector}
              </div>
            </div>
          </div>
          {/* 24h badge */}
          <div className="flex items-center gap-0.5 text-[11px] font-bold px-2 py-1 rounded-lg flex-shrink-0"
            style={{ background: up ? 'rgba(80,220,160,0.1)' : 'rgba(255,90,90,0.1)', color: up ? 'rgb(80,220,160)' : 'rgb(255,90,90)' }}>
            {up ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
            {fmtPct(p.change24h)}
          </div>
        </div>

        {/* NAV price */}
        <div className="mb-3">
          <div className="text-2xl font-black leading-none" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-display)', letterSpacing: '-0.04em' }}>
            {fmtMoney(p.price)}
          </div>
          <div className="text-[10px] mt-1 uppercase tracking-[0.15em]" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
            NAV / unit
          </div>
        </div>

        {/* ROI bars */}
        {roiRows.length > 0 ? (
          <div className="border-t pt-3 space-y-2" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
            {roiRows.map(({ label, val }) => {
              const v = val ?? 0;
              const barPct = Math.min(100, (Math.abs(v) / maxAbs) * 100);
              const pos = v >= 0;
              return (
                <div key={label} className="flex items-center gap-2">
                  <span className="text-[10px] w-5 flex-shrink-0 font-bold" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                    {label}
                  </span>
                  <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)' }}>
                    <div style={{ width: `${barPct}%`, height: '100%', borderRadius: 999, background: pos ? 'rgb(80,220,160)' : 'rgb(255,90,90)', transition: 'width 0.9s cubic-bezier(0.16,1,0.3,1)' }} />
                  </div>
                  <span className="text-[10px] w-14 text-right flex-shrink-0 font-bold" style={{ color: pos ? 'rgb(80,220,160)' : 'rgb(255,90,90)', fontFamily: 'var(--font-mono)' }}>
                    {fmtPct(v)}
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="border-t pt-3 flex items-center gap-1.5" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
            <Activity className="w-3 h-3" style={{ color: 'var(--text-muted)' }} />
            <span className="text-[10px]" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>Fetching ROI data…</span>
          </div>
        )}
      </div>
    </motion.button>
  );
}

export default function StrategiesPage() {
  const [selected, setSelected] = useState<string | null>(null);
  const [persona, setPersona] = useState<typeof PERSONAS[number]['id']>('balanced');
  const [horizon, setHorizon] = useState<'short' | 'medium' | 'long'>('medium');
  const [risk, setRisk] = useState(50);
  const [recommendation, setRecommendation] = useState<any>(null);
  const [recommending, setRecommending] = useState(false);

  const { data: products = [], meta } = useQuery({
    queryKey: ['ssi', 'products'],
    queryFn: async () => {
      const r = await fetchWithMeta<SSIProduct[]>('/api/ssi/products');
      return r;
    },
    refetchInterval: 60_000,
    select: (r) => r,
  }) as any;
  const productList: SSIProduct[] = products?.data ?? [];
  const productMeta = products?.meta;

  const activeTicker = selected ?? productList[0]?.ticker ?? null;

  const { data: composite } = useQuery({
    queryKey: ['ssi', 'composite', activeTicker],
    queryFn: () => fetchWithMeta<Composite>(`/api/ssi/products/${activeTicker}`),
    enabled: !!activeTicker,
    refetchInterval: 30_000,
  });

  async function runRecommendation() {
    setRecommending(true);
    try {
      const r = await api.post('/api/ssi/recommend', { persona, horizon, riskAppetite: risk });
      setRecommendation(r.data?.data ?? r.data);
    } finally { setRecommending(false); }
  }

  const totalTVL = useMemo(() => productList.reduce((s, p) => s + (p.tvl || 0), 0), [productList]);
  const avgChange = useMemo(() => productList.length ? productList.reduce((s, p) => s + (p.change24h || 0), 0) / productList.length : 0, [productList]);

  return (
    <div className="min-h-screen px-6 lg:px-10 py-8" style={{ background: 'var(--bg-base)' }}>
      <LabsPreviewBanner feature="Strategies & SSI products" />
      {/* Hero */}
      <motion.div
        initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
        className="mb-6 flex items-end justify-between flex-wrap gap-4"
      >
        <div>
          <div className="flex items-center gap-2 mb-2 text-xs uppercase tracking-[0.2em]" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
            <Sparkles className="w-3.5 h-3.5" style={{ color: 'var(--accent)' }} />
            SoSoValue Indexes · SSI Protocol
          </div>
          <h1 className="text-4xl lg:text-5xl font-black tracking-tight" style={{ fontFamily: 'var(--font-display)', color: 'var(--text-primary)', letterSpacing: '-0.04em' }}>
            Index <span style={{ color: 'var(--accent)' }}>Studio</span>
          </h1>
          <p className="mt-2 max-w-2xl text-sm" style={{ color: 'var(--text-secondary)' }}>
            On-chain spot baskets — one token, full thematic exposure. Built on the SSI protocol.
            Browse, compare, and let the orchestrator pick the basket that matches your persona.
          </p>
        </div>
        <CacheBadge meta={productMeta} size="md" />
      </motion.div>

      {/* Top stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Indexes Live', value: String(productList.length), icon: Layers },
          { label: 'Total TVL', value: fmtMoney(totalTVL), icon: ShieldCheck },
          { label: 'Avg 24h', value: fmtPct(avgChange), icon: TrendingUp, accent: avgChange >= 0 ? 'green' : 'red' },
          { label: 'Protocol', value: 'SoSoValue', icon: Brain },
        ].map((s, i) => (
          <GlassCard key={s.label} animate={false} padding="sm">
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase tracking-[0.2em]" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                  {s.label}
                </span>
                <s.icon className="w-3.5 h-3.5" style={{ color: 'var(--accent)' }} />
              </div>
              <div className="text-xl font-bold mt-2" style={{
                color: s.accent === 'green' ? 'rgb(80,220,160)' : s.accent === 'red' ? 'rgb(255,90,90)' : 'var(--text-primary)',
                fontFamily: 'var(--font-display)',
              }}>{s.value}</div>
            </motion.div>
          </GlassCard>
        ))}
      </div>

      {/* Two-col */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_420px] gap-6">
        {/* Left: index list */}
        <div className="space-y-3">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-xs uppercase tracking-[0.2em]" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
              All SSI Baskets
            </h2>
            <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Tap to inspect →</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {productList.map((p, i) => (
              <SSICard
                key={p.ticker}
                p={p}
                active={activeTicker === p.ticker}
                onClick={() => setSelected(p.ticker)}
                index={i}
              />
            ))}
          </div>
        </div>

        {/* Right: detail + recommend */}
        <div className="space-y-4">
          {/* Recommender */}
          <GlassCard glow="orange" animate>
            <div className="flex items-center gap-2 mb-3">
              <Brain className="w-4 h-4" style={{ color: 'var(--accent)' }} />
              <h3 className="text-sm font-bold uppercase tracking-[0.18em]" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
                Persona Recommender
              </h3>
            </div>
            <div className="grid grid-cols-2 gap-2 mb-3">
              {PERSONAS.map((p) => (
                <button key={p.id} type="button" onClick={() => setPersona(p.id)}
                  className="text-left rounded-xl border px-3 py-2 transition"
                  style={{
                    borderColor: persona === p.id ? 'var(--accent)' : 'var(--glass-border)',
                    background: persona === p.id ? 'color-mix(in srgb, var(--accent) 10%, transparent)' : 'transparent',
                    color: 'var(--text-primary)',
                  }}>
                  <div className="text-xs font-bold">{p.label}</div>
                  <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{p.sub}</div>
                </button>
              ))}
            </div>
            <div className="grid grid-cols-3 gap-1.5 mb-3">
              {(['short', 'medium', 'long'] as const).map((h) => (
                <button key={h} onClick={() => setHorizon(h)} type="button"
                  className="text-xs uppercase tracking-wider py-1.5 rounded-lg border"
                  style={{
                    borderColor: horizon === h ? 'var(--accent)' : 'var(--glass-border)',
                    color: horizon === h ? 'var(--accent)' : 'var(--text-secondary)',
                    background: horizon === h ? 'color-mix(in srgb, var(--accent) 12%, transparent)' : 'transparent',
                    fontFamily: 'var(--font-mono)',
                  }}>{h}</button>
              ))}
            </div>
            <label className="block text-[10px] uppercase tracking-[0.2em] mb-1" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
              Risk Appetite · {risk}/100
            </label>
            <input type="range" min={0} max={100} value={risk} onChange={(e) => setRisk(Number(e.target.value))}
              className="w-full mb-3" style={{ accentColor: 'var(--accent)' }} />
            <button type="button" onClick={runRecommendation} disabled={recommending}
              className="w-full py-2.5 rounded-xl font-bold text-sm transition"
              style={{ background: 'var(--accent)', color: '#0a0a0a', opacity: recommending ? 0.7 : 1 }}>
              {recommending ? 'Synthesizing…' : 'Recommend Basket'}
            </button>
            <AnimatePresence>
              {recommendation && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                  className="mt-3 pt-3 border-t" style={{ borderColor: 'var(--glass-border)' }}>
                  <div className="text-[10px] uppercase tracking-[0.18em] mb-2" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                    Top picks
                  </div>
                  <div className="space-y-1.5 mb-3">
                    {(recommendation.ranked ?? []).slice(0, 3).map((r: any, i: number) => (
                      <div key={r.ticker} className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded-md flex items-center justify-center font-bold text-[10px]"
                                style={{ background: 'var(--accent)', color: '#0a0a0a' }}>{i + 1}</span>
                          <span style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{r.ticker}</span>
                          <span style={{ color: 'var(--text-muted)' }}>· {r.sector}</span>
                        </div>
                        <span style={{ color: r.change24h >= 0 ? 'rgb(80,220,160)' : 'rgb(255,90,90)' }}>{fmtPct(r.change24h)}</span>
                      </div>
                    ))}
                  </div>
                  <p className="text-[11px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{recommendation.rationale}</p>
                </motion.div>
              )}
            </AnimatePresence>
          </GlassCard>

          {/* Composition */}
          {composite?.data && (
            <GlassCard animate>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <div className="text-[10px] uppercase tracking-[0.2em]" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                    Basket Composition
                  </div>
                  <h3 className="text-lg font-bold" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>
                    {composite.data.product?.ticker}
                  </h3>
                </div>
                <CacheBadge meta={composite.meta} />
              </div>
              <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
                {(composite.data.constituents ?? []).slice(0, 20).map((c: any, i: number) => {
                  const sym = String(c.symbol ?? c.token ?? c.name ?? '?');
                  const w = Number(c.weight_pct ?? c.weight ?? 0);
                  const ch = Number(c.price_change_percent_24h ?? c.change_24h ?? c.change24h ?? 0);
                  return (
                    <motion.div key={`${sym}-${i}`} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.02 }}
                      className="flex items-center gap-3">
                      <CryptoIcon symbol={sym} size={22} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold truncate" style={{ color: 'var(--text-primary)' }}>{sym.toUpperCase()}</span>
                          <span style={{ color: ch >= 0 ? 'rgb(80,220,160)' : 'rgb(255,90,90)' }}>{fmtPct(ch)}</span>
                        </div>
                        <div className="mt-1 h-1 rounded-full overflow-hidden" style={{ background: 'var(--glass-border)' }}>
                          <div style={{ width: `${Math.min(100, w)}%`, height: '100%', background: 'var(--accent)' }} />
                        </div>
                      </div>
                      <span className="text-[10px] w-12 text-right" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                        {w.toFixed(2)}%
                      </span>
                    </motion.div>
                  );
                })}
                {(!composite.data.constituents || composite.data.constituents.length === 0) && (
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Constituents unavailable for this basket.</p>
                )}
              </div>
            </GlassCard>
          )}
        </div>
      </div>
    </div>
  );
}
