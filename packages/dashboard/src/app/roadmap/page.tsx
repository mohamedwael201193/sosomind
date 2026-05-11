"use client";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { fetchWithMeta } from "@/lib/api";
import { GlassCard } from "@/components/GlassCard";
import { CacheBadge } from "@/components/CacheBadge";
import { Map, Check, Clock, Circle, Sparkles } from "lucide-react";

interface Phase {
  id: string;
  title: string;
  quarter: string;
  status: 'shipped' | 'in_progress' | 'planned';
  summary: string;
  checklist: { label: string; done: boolean }[];
}

interface Roadmap {
  updatedAt: string;
  phases: Phase[];
}

const STATUS_META: Record<Phase['status'], { color: string; label: string; Icon: any }> = {
  shipped:     { color: 'rgb(80,220,160)', label: 'Shipped',     Icon: Check },
  in_progress: { color: 'var(--accent)',   label: 'In Progress', Icon: Sparkles },
  planned:     { color: 'rgb(180,180,200)', label: 'Planned',    Icon: Circle },
};

export default function RoadmapPage() {
  const { data: resp } = useQuery({
    queryKey: ['roadmap'],
    queryFn: () => fetchWithMeta<Roadmap>('/api/roadmap'),
  });
  const roadmap = resp?.data;

  return (
    <div className="min-h-screen px-6 lg:px-10 py-8" style={{ background: 'var(--bg-base)' }}>
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
        className="mb-8 flex items-end justify-between flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2 text-xs uppercase tracking-[0.2em]" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
            <Map className="w-3.5 h-3.5" style={{ color: 'var(--accent)' }} />
            Build Plan
          </div>
          <h1 className="text-4xl lg:text-5xl font-black tracking-tight" style={{ fontFamily: 'var(--font-display)', color: 'var(--text-primary)', letterSpacing: '-0.04em' }}>
            Roadmap<span style={{ color: 'var(--accent)' }}>.</span>
          </h1>
          <p className="mt-2 max-w-2xl text-sm" style={{ color: 'var(--text-secondary)' }}>
            Where we are, where we're going. Each phase is verifiable from this dashboard's source.
          </p>
        </div>
        <CacheBadge meta={resp?.meta} size="md" />
      </motion.div>

      {!roadmap && (
        <GlassCard padding="lg"><p className="text-sm" style={{ color: 'var(--text-muted)' }}>Loading roadmap…</p></GlassCard>
      )}

      <div className="relative">
        {/* Vertical line */}
        <div className="absolute left-4 top-2 bottom-2 w-px hidden md:block" style={{ background: 'var(--glass-border)' }} />

        <div className="space-y-6">
          {roadmap?.phases.map((p, i) => {
            const meta = STATUS_META[p.status];
            const done = p.checklist.filter((c) => c.done).length;
            const pct = p.checklist.length ? (done / p.checklist.length) * 100 : 0;
            return (
              <motion.div key={p.id} initial={{ opacity: 0, x: -16 }} whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, margin: '-80px' }} transition={{ duration: 0.5, delay: i * 0.08 }}
                className="relative md:pl-12">
                {/* Dot */}
                <div className="hidden md:flex absolute left-0 top-3 w-9 h-9 items-center justify-center rounded-full border"
                  style={{
                    background: 'var(--bg-base)',
                    borderColor: meta.color,
                    boxShadow: `0 0 16px color-mix(in srgb, ${meta.color} 40%, transparent)`,
                  }}>
                  <meta.Icon className="w-4 h-4" style={{ color: meta.color }} />
                </div>

                <GlassCard padding="lg" glow={p.status === 'in_progress' ? 'orange' : 'none'}>
                  <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
                    <div>
                      <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.2em]"
                           style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                        <span>{p.quarter}</span>
                        <span style={{ color: meta.color }}>· {meta.label}</span>
                      </div>
                      <h3 className="text-xl lg:text-2xl font-bold mt-1" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>
                        {p.title}
                      </h3>
                    </div>
                    <div className="text-right">
                      <div className="text-xs" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                        {done} / {p.checklist.length}
                      </div>
                      <div className="w-32 h-1.5 rounded-full mt-1 overflow-hidden" style={{ background: 'var(--glass-border)' }}>
                        <motion.div initial={{ width: 0 }} whileInView={{ width: `${pct}%` }} viewport={{ once: true }}
                          transition={{ duration: 0.8, delay: i * 0.08 + 0.2 }}
                          style={{ height: '100%', background: meta.color }} />
                      </div>
                    </div>
                  </div>
                  <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>{p.summary}</p>

                  <ul className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {p.checklist.map((c, j) => (
                      <li key={c.label} className="flex items-start gap-2 text-xs">
                        {c.done ? (
                          <Check className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: 'rgb(80,220,160)' }} />
                        ) : (
                          <Clock className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: 'var(--text-muted)' }} />
                        )}
                        <span style={{ color: c.done ? 'var(--text-primary)' : 'var(--text-secondary)', textDecoration: c.done ? 'none' : 'none' }}>
                          {c.label}
                        </span>
                      </li>
                    ))}
                  </ul>
                </GlassCard>
              </motion.div>
            );
          })}
        </div>
      </div>

      {roadmap?.updatedAt && (
        <div className="mt-6 text-center text-[10px] uppercase tracking-[0.2em]" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
          Last updated · {roadmap.updatedAt}
        </div>
      )}
    </div>
  );
}
