"use client";
import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { fetchWithMeta, api } from "@/lib/api";
import { GlassCard } from "@/components/GlassCard";
import { CacheBadge } from "@/components/CacheBadge";
import { CryptoIcon } from "@/components/CryptoIcon";
import { CandlestickChart, ArrowUpRight, ArrowDownRight, Sparkles, Layers, ShieldCheck, TrendingUp, Brain } from "lucide-react";

interface SSIProduct {
  ticker: string;
  sector: string;
  thesis: string;
  price: number;
  change24h: number;
  tvl: number;
  apy: number;
  holders: number;
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
            {productList.map((p, i) => {
              const active = activeTicker === p.ticker;
              const up = p.change24h >= 0;
              return (
                <motion.button
                  key={p.ticker}
                  type="button"
                  initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04, duration: 0.4 }}
                  onClick={() => setSelected(p.ticker)}
                  whileHover={{ y: -2 }} whileTap={{ scale: 0.985 }}
                  className="text-left rounded-2xl border overflow-hidden transition-colors"
                  style={{
                    borderColor: active ? 'var(--accent)' : 'var(--glass-border)',
                    background: active ? 'color-mix(in srgb, var(--accent) 8%, var(--bg-card))' : 'var(--bg-card)',
                    boxShadow: active ? '0 0 24px color-mix(in srgb, var(--accent) 20%, transparent)' : 'none',
                  }}
                >
                  <div className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs"
                             style={{ background: 'color-mix(in srgb, var(--accent) 15%, transparent)', color: 'var(--accent)', fontFamily: 'var(--font-mono)' }}>
                          {p.ticker.replace(/^ssi/, '')}
                        </div>
                        <div>
                          <div className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{p.ticker}</div>
                          <div className="text-[10px] uppercase tracking-[0.15em]" style={{ color: 'var(--text-muted)' }}>{p.sector}</div>
                        </div>
                      </div>
                      <div className={`flex items-center gap-1 text-xs font-bold ${up ? '' : ''}`} style={{ color: up ? 'rgb(80,220,160)' : 'rgb(255,90,90)' }}>
                        {up ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                        {fmtPct(p.change24h)}
                      </div>
                    </div>
                    <p className="text-xs leading-relaxed mb-3" style={{ color: 'var(--text-secondary)' }}>{p.thesis}</p>
                    <div className="grid grid-cols-3 gap-2 text-[10px]" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                      <div>
                        <div>NAV</div>
                        <div className="text-sm" style={{ color: 'var(--text-primary)' }}>{fmtMoney(p.price)}</div>
                      </div>
                      <div>
                        <div>TVL</div>
                        <div className="text-sm" style={{ color: 'var(--text-primary)' }}>{fmtMoney(p.tvl)}</div>
                      </div>
                      <div>
                        <div>APY</div>
                        <div className="text-sm" style={{ color: 'var(--text-primary)' }}>{p.apy ? `${p.apy.toFixed(2)}%` : '—'}</div>
                      </div>
                    </div>
                  </div>
                </motion.button>
              );
            })}
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
