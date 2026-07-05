'use client';

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Target, Zap, CandlestickChart, PieChart, X, CheckCircle2 } from 'lucide-react';

const STEPS = [
  { id: 'record', label: 'Track Record', href: '/track-record', icon: Target, match: ['/track-record'] },
  { id: 'signal', label: 'Inspect Signal', href: '/signals', icon: Zap, match: ['/signals'] },
  { id: 'trade', label: 'Preflight + Sign', href: '/trade', icon: CandlestickChart, match: ['/trade'] },
  { id: 'portfolio', label: 'Verify Portfolio', href: '/portfolio', icon: PieChart, match: ['/portfolio'] },
];

const STORAGE_KEY = 'sosomind-judge-path';

export function JudgePathBanner() {
  const { pathname } = useLocation();
  const [active, setActive] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const sync = () => setActive(localStorage.getItem(STORAGE_KEY) === '1');
    sync();
    window.addEventListener('sosomind-judge-path', sync);
    return () => window.removeEventListener('sosomind-judge-path', sync);
  }, []);

  if (!active || pathname === '/landing') return null;

  const currentIdx = STEPS.findIndex((s) => s.match.some((m) => pathname === m || pathname.startsWith(m + '/')));
  const doneUpTo = currentIdx >= 0 ? currentIdx : -1;

  const dismiss = () => {
    localStorage.removeItem(STORAGE_KEY);
    setActive(false);
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -12 }}
        className="mb-4 rounded-xl border overflow-hidden"
        style={{ borderColor: 'var(--accent-border)', background: 'color-mix(in srgb, var(--accent) 6%, var(--bg-card))' }}
      >
        <div className="flex items-center justify-between px-4 py-2 border-b" style={{ borderColor: 'var(--glass-border)' }}>
          <p className="text-xs font-bold uppercase tracking-wider text-[var(--accent)]">5-Min Judge Path</p>
          <button type="button" onClick={dismiss} aria-label="Dismiss judge path">
            <X className="w-4 h-4 text-[var(--text-muted)]" />
          </button>
        </div>
        <div className="flex flex-wrap gap-2 p-3">
          {STEPS.map((step, i) => {
            const done = i < doneUpTo || (i === doneUpTo && pathname.startsWith(step.href));
            const current = i === doneUpTo || (doneUpTo === -1 && i === 0);
            const Icon = step.icon;
            return (
              <Link
                key={step.id}
                to={step.href}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors"
                style={{
                  background: current ? 'var(--accent-soft)' : 'var(--glass-bg)',
                  color: done ? 'var(--green)' : current ? 'var(--accent)' : 'var(--text-muted)',
                  border: current ? '1px solid var(--accent-border)' : '1px solid transparent',
                }}
              >
                {done ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Icon className="w-3.5 h-3.5" />}
                {step.label}
              </Link>
            );
          })}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

export function startJudgePath() {
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, '1');
    window.dispatchEvent(new Event('sosomind-judge-path'));
  }
}

export function JudgePathButton({ className }: { className?: string }) {
  const { pathname } = useLocation();

  if (pathname === '/landing') return null;

  return (
    <button
      type="button"
      onClick={() => {
        startJudgePath();
        window.location.href = '/track-record';
      }}
      className={className}
      style={{
        fontSize: 11,
        fontWeight: 700,
        padding: '4px 10px',
        borderRadius: 8,
        background: 'var(--accent-soft)',
        color: 'var(--accent)',
        border: '1px solid var(--accent-border)',
      }}
    >
      Judge Path ▶
    </button>
  );
}
