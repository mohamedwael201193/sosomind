"use client";
import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { fetchWithMeta, api } from "@/lib/api";
import { API_URL } from "@/lib/env";
import { LabsPreviewBanner } from "@/components/LabsPreviewBanner";
import { GlassCard } from "@/components/GlassCard";
import { CacheBadge } from "@/components/CacheBadge";
import { Newspaper, Database, Send, RefreshCw, ExternalLink, FileText, Zap, Clock, AlertCircle } from "lucide-react";

interface Post {
  id: string;
  title: string;
  body: string;
  summary?: string | null;
  symbols?: string[];
  sentiment?: string | null;
  channel?: string | null;
  citations?: any[];
  published?: boolean;
  created_at: string;
}

function timeAgo(iso?: string) {
  if (!iso) return '';
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.floor(ms / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function AgeBadge({ iso }: { iso?: string }) {
  if (!iso) return null;
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.floor(ms / 60000);
  if (m < 30) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider"
        style={{ background: 'rgba(0,255,127,0.12)', color: '#00ff7f' }}>
        <Zap className="w-2.5 h-2.5" /> LIVE
      </span>
    );
  }
  if (m < 120) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider"
        style={{ background: 'rgba(251,191,36,0.12)', color: '#fbbf24' }}>
        <Clock className="w-2.5 h-2.5" /> {timeAgo(iso)}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider"
      style={{ background: 'rgba(239,68,68,0.12)', color: '#ef4444' }}>
      <AlertCircle className="w-2.5 h-2.5" /> STALE {timeAgo(iso)}
    </span>
  );
}

function GeneratingSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-5 rounded-lg w-3/4" style={{ background: 'var(--glass-border)' }} />
      <div className="space-y-2">
        {[100, 90, 95, 80, 85].map((w, i) => (
          <div key={i} className="h-3 rounded" style={{ background: 'var(--glass-border)', width: `${w}%` }} />
        ))}
      </div>
      <div className="flex items-center gap-2 pt-2">
        <div className="w-2 h-2 rounded-full" style={{ background: 'var(--accent)', animation: 'pulse 1s infinite' }} />
        <span className="text-xs" style={{ color: 'var(--accent)' }}>Synthesising market data via SoSoValue…</span>
      </div>
    </div>
  );
}

export default function NewsletterPage() {
  const [active, setActive] = useState<Post | null>(null);
  const [generating, setGenerating] = useState(false);
  const [sseStatus, setSseStatus] = useState<'idle' | 'connecting' | 'live'>('idle');
  const sseRef = useRef<EventSource | null>(null);

  const { data: postsResp, refetch, isFetching } = useQuery({
    queryKey: ['content', 'posts'],
    queryFn: () => fetchWithMeta<Post[]>('/api/content/posts?limit=20'),
    refetchInterval: 60_000,
  });
  const posts = postsResp?.data ?? [];
  const meta = postsResp?.meta;

  useEffect(() => { if (!active && posts.length) setActive(posts[0]); }, [posts, active]);

  // SSE — auto-refresh feed when new posts are generated server-side
  useEffect(() => {
    const backendUrl = API_URL;
    setSseStatus('connecting');
    const es = new EventSource(`${backendUrl}/api/content/stream`);
    sseRef.current = es;

    es.addEventListener('hello', () => setSseStatus('live'));
    es.addEventListener('post', (e) => {
      try {
        const post: Post = JSON.parse((e as MessageEvent).data);
        refetch();
        setActive(post);
      } catch {}
    });
    es.addEventListener('ping', () => setSseStatus('live'));
    es.onerror = () => setSseStatus('idle');

    return () => { es.close(); sseRef.current = null; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function triggerNew() {
    setGenerating(true);
    try {
      await api.post('/api/content/generate', {});
      await refetch();
    } finally { setGenerating(false); }
  }

  return (
    <div className="min-h-screen px-6 lg:px-10 py-8" style={{ background: 'var(--bg-base)' }}>
      <LabsPreviewBanner feature="Newsletter & briefings" />
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
        className="mb-6 flex items-end justify-between flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2 text-xs uppercase tracking-[0.2em]" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
            <Newspaper className="w-3.5 h-3.5" style={{ color: 'var(--accent)' }} />
            Smart-Money Brief · Powered by SoSoValue
            {sseStatus === 'live' && (
              <span className="flex items-center gap-1 ml-2" style={{ color: '#00ff7f' }}>
                <span className="w-1.5 h-1.5 rounded-full bg-[#00ff7f] animate-pulse" />
                live stream
              </span>
            )}
          </div>
          <h1 className="text-4xl lg:text-5xl font-black tracking-tight" style={{ fontFamily: 'var(--font-display)', color: 'var(--text-primary)', letterSpacing: '-0.04em' }}>
            Daily <span style={{ color: 'var(--accent)' }}>Brief</span>
          </h1>
          <p className="mt-2 max-w-2xl text-sm" style={{ color: 'var(--text-secondary)' }}>
            Auto-generated every 30 minutes. Each issue cites the live SoSoValue endpoints used — every figure traceable.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <CacheBadge meta={meta} size="md" />
          <button type="button" onClick={() => refetch()} className="px-3 py-2 rounded-xl border text-xs flex items-center gap-1.5"
            style={{ borderColor: 'var(--glass-border)', color: 'var(--text-secondary)' }}>
            <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} /> Refresh
          </button>
          <button type="button" onClick={triggerNew} disabled={generating}
            className="px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-1.5"
            style={{ background: 'var(--accent)', color: '#0a0a0a', opacity: generating ? 0.7 : 1 }}>
            <Send className="w-3.5 h-3.5" /> {generating ? 'Synthesizing…' : 'Generate Now'}
          </button>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-5">
        {/* Issue list */}
        <div className="space-y-2 max-h-[78vh] overflow-y-auto pr-1">
          {/* Generating skeleton — shown immediately when user triggers or when SSE connecting */}
          <AnimatePresence>
            {generating && (
              <motion.div key="skeleton" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="rounded-xl border p-4"
                style={{ borderColor: 'var(--accent)', background: 'color-mix(in srgb, var(--accent) 6%, var(--bg-card))' }}>
                <GeneratingSkeleton />
              </motion.div>
            )}
          </AnimatePresence>

          {posts.length === 0 && !generating && (
            <GlassCard padding="lg">
              <div className="flex items-center gap-2 mb-2" style={{ color: 'var(--text-muted)' }}>
                <FileText className="w-4 h-4" />
                <span className="text-sm">No issues yet</span>
              </div>
              <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                Click <strong>Generate Now</strong> to publish the first Smart-Money brief, or wait — the server auto-generates every 30 minutes.
              </p>
            </GlassCard>
          )}
          {posts.map((p, i) => {
            const isActive = active?.id === p.id;
            return (
              <motion.button key={p.id} type="button" onClick={() => setActive(p)}
                initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }}
                whileHover={{ x: 2 }}
                className="w-full text-left rounded-xl border p-3 transition"
                style={{
                  borderColor: isActive ? 'var(--accent)' : 'var(--glass-border)',
                  background: isActive ? 'color-mix(in srgb, var(--accent) 8%, var(--bg-card))' : 'var(--bg-card)',
                }}>
                <div className="flex items-center justify-between mb-1.5 gap-2 flex-wrap">
                  <AgeBadge iso={p.created_at} />
                  {p.published && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'rgba(80,220,160,0.12)', color: 'rgb(80,220,160)' }}>
                      telegram
                    </span>
                  )}
                </div>
                <div className="text-sm font-bold mb-1 line-clamp-2" style={{ color: 'var(--text-primary)' }}>
                  {p.title}
                </div>
                <div className="flex items-center gap-1.5 text-[10px]" style={{ color: 'var(--text-muted)' }}>
                  <Database className="w-3 h-3" />
                  {(p.citations?.length ?? 0)} sources
                </div>
              </motion.button>
            );
          })}
        </div>

        {/* Reader */}
        <AnimatePresence mode="wait">
          {generating && !active ? (
            <motion.div key="reader-skeleton" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <GlassCard padding="lg">
                <GeneratingSkeleton />
              </GlassCard>
            </motion.div>
          ) : active ? (
            <motion.div key={active.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.35 }}>
              <GlassCard padding="lg">
                <div className="flex items-center gap-3 mb-3 flex-wrap">
                  <div className="text-[10px] uppercase tracking-[0.2em]" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                    Issue
                  </div>
                  <AgeBadge iso={active.created_at} />
                </div>
                <h2 className="text-2xl lg:text-3xl font-black mb-4 tracking-tight" style={{ fontFamily: 'var(--font-display)', color: 'var(--text-primary)', letterSpacing: '-0.025em' }}>
                  {active.title}
                </h2>
                <div className="prose prose-invert max-w-none text-sm leading-relaxed"
                     style={{ color: 'var(--text-secondary)' }}
                     dangerouslySetInnerHTML={{ __html: active.body }} />

                {active.citations && active.citations.length > 0 && (
                  <div className="mt-6 pt-6 border-t" style={{ borderColor: 'var(--glass-border)' }}>
                    <div className="flex items-center gap-2 mb-3">
                      <Database className="w-4 h-4" style={{ color: 'var(--accent)' }} />
                      <h3 className="text-xs uppercase tracking-[0.2em]" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                        Provenance · {active.citations.length} citations
                      </h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {active.citations.map((c: any, i: number) => (
                        <motion.div key={`${c.hash ?? i}`} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
                          className="rounded-lg border p-2.5 text-[11px]"
                          style={{ borderColor: 'var(--glass-border)', background: 'var(--bg-card)' }}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-bold uppercase tracking-wider" style={{ color: 'var(--accent)', fontFamily: 'var(--font-mono)' }}>{c.source}</span>
                            <span style={{ color: 'var(--text-muted)' }}>{new Date(c.timestamp).toLocaleTimeString()}</span>
                          </div>
                          <code className="block text-[10px] truncate" style={{ color: 'var(--text-secondary)' }}>{c.endpoint}</code>
                          {c.hash && (
                            <code className="block text-[9px] mt-1 truncate" style={{ color: 'var(--text-muted)' }}>sha256:{String(c.hash).slice(0, 16)}…</code>
                          )}
                        </motion.div>
                      ))}
                    </div>
                  </div>
                )}
              </GlassCard>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </div>
  );
}
