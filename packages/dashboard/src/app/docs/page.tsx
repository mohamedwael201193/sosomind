"use client";
import { useState } from "react";
import { motion } from "framer-motion";
import { GlassCard } from "@/components/GlassCard";
import { Code2, Copy, Check, Server, Zap, Database, Newspaper, Layers, Shield, Map, Activity } from "lucide-react";
import { API_URL } from "@/lib/api";

interface Endpoint {
  method: 'GET' | 'POST';
  path: string;
  desc: string;
  example?: string;
}

const SECTIONS: { id: string; label: string; icon: any; endpoints: Endpoint[] }[] = [
  {
    id: 'ssi', label: 'SoSoValue Indexes (SSI)', icon: Layers, endpoints: [
      { method: 'GET',  path: '/api/ssi/products', desc: 'List all SSI baskets with NAV / TVL / 24h change.' },
      { method: 'GET',  path: '/api/ssi/products/:ticker', desc: 'Composite snapshot — product + constituents + 30-day klines.', example: '/api/ssi/products/ssiAI' },
      { method: 'GET',  path: '/api/ssi/products/:ticker/composition', desc: 'Constituent breakdown with normalized weights.' },
      { method: 'GET',  path: '/api/ssi/products/:ticker/klines?limit=30', desc: 'Historical NAV klines.' },
      { method: 'POST', path: '/api/ssi/recommend', desc: 'AI-ranked basket for { persona, horizon, riskAppetite }.' },
      { method: 'GET',  path: '/api/ssi/portfolio/:wallet', desc: 'SSI holdings for a wallet (case-insensitive).' },
    ],
  },
  {
    id: 'content', label: 'Smart-Money Newsletter', icon: Newspaper, endpoints: [
      { method: 'GET',  path: '/api/content/posts?limit=20', desc: 'Most recent published briefs.' },
      { method: 'GET',  path: '/api/content/latest', desc: 'Single most-recent issue with citations.' },
      { method: 'GET',  path: '/api/content/post/:id', desc: 'Fetch one issue by id.' },
      { method: 'POST', path: '/api/content/generate', desc: 'Synthesize a brief without publishing.' },
      { method: 'POST', path: '/api/content/publish', desc: 'Publish to Telegram + persist with citations.' },
      { method: 'POST', path: '/api/content/trigger', desc: 'Run the daily-brief pipeline now (cron-secret protected).' },
      { method: 'GET',  path: '/api/content/stream', desc: 'Server-sent-events stream of new posts.' },
    ],
  },
  {
    id: 'risk', label: 'Risk · Pre-Flight', icon: Shield, endpoints: [
      { method: 'GET',  path: '/api/risk/status', desc: 'Live circuit-breaker state.' },
      { method: 'GET',  path: '/api/risk/preflight?asset&qty&price&side&market&walletUsdc', desc: '4-check preflight: circuit, asset block, slippage, exposure.' },
    ],
  },
  {
    id: 'market', label: 'Market · Pricing', icon: Activity, endpoints: [
      { method: 'GET',  path: '/api/market/price/:symbol', desc: 'Real-time price + 24h change (SoSoValue → Binance fallback).' },
      { method: 'GET',  path: '/api/market/klines/:symbol?interval=1h&limit=100', desc: 'Klines / candles.' },
      { method: 'GET',  path: '/api/market/orderbook/:market?depth=20', desc: 'SoDEX spot orderbook depth.' },
    ],
  },
  {
    id: 'sodex', label: 'SoDEX · Execution', icon: Zap, endpoints: [
      { method: 'GET',  path: '/api/sodex/spot/symbols', desc: 'Tradable spot pairs.' },
      { method: 'GET',  path: '/api/sodex/spot/tickers', desc: 'Live ticker snapshots.' },
      { method: 'GET',  path: '/api/sodex/spot/orderbook/:market', desc: 'Aggregated orderbook.' },
      { method: 'POST', path: '/api/sodex/spot/place', desc: 'Submit signed EIP-712 spot order.' },
    ],
  },
  {
    id: 'data', label: 'SoSoValue · Data', icon: Database, endpoints: [
      { method: 'GET', path: '/api/currencies/:symbol', desc: 'Token info + supply + economics.' },
      { method: 'GET', path: '/api/etf/list?asset=BTC&region=US', desc: 'Spot ETF list (BTC / ETH).' },
      { method: 'GET', path: '/api/news/hot?page_size=20', desc: 'Hot crypto news feed.' },
      { method: 'GET', path: '/api/sectors/spotlight', desc: 'Sector momentum spotlight.' },
      { method: 'GET', path: '/api/macro/events', desc: 'Macro economic event calendar.' },
      { method: 'GET', path: '/api/indices/snapshot/:ticker', desc: 'Index market snapshot.' },
    ],
  },
  {
    id: 'roadmap', label: 'Roadmap', icon: Map, endpoints: [
      { method: 'GET', path: '/api/roadmap', desc: 'Phase-by-phase delivery plan.' },
    ],
  },
];

export default function DocsPage() {
  const [copied, setCopied] = useState<string | null>(null);
  const [active, setActive] = useState<string>('ssi');

  function copy(s: string) {
    navigator.clipboard?.writeText(s).then(() => {
      setCopied(s);
      setTimeout(() => setCopied(null), 1200);
    });
  }

  const section = SECTIONS.find((s) => s.id === active) ?? SECTIONS[0];

  return (
    <div className="min-h-screen px-6 lg:px-10 py-8" style={{ background: 'var(--bg-base)' }}>
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="mb-6">
        <div className="flex items-center gap-2 mb-2 text-xs uppercase tracking-[0.2em]" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
          <Code2 className="w-3.5 h-3.5" style={{ color: 'var(--accent)' }} />
          Public REST API
        </div>
        <h1 className="text-4xl lg:text-5xl font-black tracking-tight" style={{ fontFamily: 'var(--font-display)', color: 'var(--text-primary)', letterSpacing: '-0.04em' }}>
          Docs<span style={{ color: 'var(--accent)' }}>.</span>
        </h1>
        <p className="mt-2 max-w-2xl text-sm" style={{ color: 'var(--text-secondary)' }}>
          Every endpoint exposes a uniform <code className="px-1.5 py-0.5 rounded" style={{ background: 'var(--bg-card)', color: 'var(--accent)' }}>{`{ data, meta }`}</code> envelope —
          the <code style={{ color: 'var(--accent)' }}>meta</code> block carries <code>cachedAt</code>, <code>ageMs</code>, <code>isStale</code>, and <code>source</code> for client-side freshness rendering.
        </p>
        <div className="mt-3 flex items-center gap-2">
          <Server className="w-3.5 h-3.5" style={{ color: 'var(--accent)' }} />
          <button onClick={() => copy(API_URL)} type="button"
            className="px-2 py-1 rounded text-xs flex items-center gap-1.5 border"
            style={{ borderColor: 'var(--glass-border)', background: 'var(--bg-card)', color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
            {API_URL}
            {copied === API_URL ? <Check className="w-3 h-3" style={{ color: 'rgb(80,220,160)' }} /> : <Copy className="w-3 h-3" style={{ color: 'var(--text-muted)' }} />}
          </button>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-6">
        {/* Sidebar */}
        <nav className="space-y-1 lg:sticky lg:top-6 self-start">
          {SECTIONS.map((s) => {
            const isActive = active === s.id;
            const Icon = s.icon;
            return (
              <button key={s.id} type="button" onClick={() => setActive(s.id)}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left text-sm transition"
                style={{
                  background: isActive ? 'color-mix(in srgb, var(--accent) 12%, transparent)' : 'transparent',
                  color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
                }}>
                <Icon className="w-4 h-4" />
                {s.label}
              </button>
            );
          })}
        </nav>

        {/* Endpoints */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 mb-1">
            <section.icon className="w-4 h-4" style={{ color: 'var(--accent)' }} />
            <h2 className="text-xs uppercase tracking-[0.2em]" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
              {section.label}
            </h2>
          </div>
          {section.endpoints.map((ep, i) => {
            const fullPath = (ep.example ?? ep.path);
            return (
              <motion.div key={`${ep.path}-${i}`} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
                <GlassCard animate={false} padding="md">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase"
                        style={{
                          background: ep.method === 'POST' ? 'rgba(180,122,255,0.15)' : 'rgba(80,220,160,0.15)',
                          color: ep.method === 'POST' ? 'rgb(180,122,255)' : 'rgb(80,220,160)',
                          fontFamily: 'var(--font-mono)',
                        }}>{ep.method}</span>
                      <code className="text-sm truncate" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{ep.path}</code>
                    </div>
                    <button type="button" onClick={() => copy(`${API_URL}${fullPath}`)}
                      className="flex items-center gap-1 px-2 py-1 rounded text-[10px] border flex-shrink-0"
                      style={{ borderColor: 'var(--glass-border)', color: 'var(--text-muted)' }}>
                      {copied === `${API_URL}${fullPath}` ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      cURL
                    </button>
                  </div>
                  <p className="text-xs mt-2" style={{ color: 'var(--text-secondary)' }}>{ep.desc}</p>
                  {ep.method === 'GET' && (
                    <details className="mt-2">
                      <summary className="text-[10px] uppercase tracking-[0.18em] cursor-pointer" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                        Try it
                      </summary>
                      <pre className="mt-2 p-3 rounded-lg overflow-x-auto text-[11px]"
                        style={{ background: 'var(--bg-card)', border: '1px solid var(--glass-border)', color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
{`curl -s "${API_URL}${fullPath}" | jq '.'`}
                      </pre>
                    </details>
                  )}
                </GlassCard>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
