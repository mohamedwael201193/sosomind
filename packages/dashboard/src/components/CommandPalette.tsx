'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Search } from 'lucide-react';

const ROUTES = [
  { href: '/dashboard', label: 'Overview', group: 'Core' },
  { href: '/track-record', label: 'Track Record', group: 'Prove' },
  { href: '/signals', label: 'Signals', group: 'Prove' },
  { href: '/methodology', label: 'Methodology', group: 'Prove' },
  { href: '/research', label: 'Research', group: 'Act' },
  { href: '/trade', label: 'Trade', group: 'Act' },
  { href: '/sectors', label: 'SSI Sectors', group: 'Act' },
  { href: '/portfolio', label: 'Portfolio', group: 'Monitor' },
  { href: '/agents', label: 'Market Regime', group: 'Monitor' },
  { href: '/status', label: 'System Status', group: 'Account' },
  { href: '/profile', label: 'Profile', group: 'Account' },
  { href: '/settings', label: 'Settings', group: 'Account' },
  { href: '/docs', label: 'API Docs', group: 'Resources' },
  { href: '/roadmap', label: 'Roadmap', group: 'Resources' },
  { href: '/strategies', label: 'Strategies', group: 'Labs' },
  { href: '/rebalance', label: 'Rebalance', group: 'Labs' },
  { href: '/newsletter', label: 'Newsletter', group: 'Labs' },
  { href: '/whales', label: 'Whales', group: 'Labs' },
  { href: '/arbitrage', label: 'Arbitrage', group: 'Labs' },
  { href: '/playbook', label: 'Playbook', group: 'Labs' },
  { href: '/leaderboard', label: 'Leaderboard', group: 'Labs' },
  { href: '/persona', label: 'Persona', group: 'Labs' },
  { href: '/alerts', label: 'Alerts', group: 'Labs' },
];

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return ROUTES;
    return ROUTES.filter((r) => r.label.toLowerCase().includes(needle) || r.group.toLowerCase().includes(needle));
  }, [q]);

  const go = (href: string) => {
    setOpen(false);
    setQ('');
    router.push(href);
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[200] flex items-start justify-center pt-[15vh] px-4"
          style={{ background: 'rgba(0,0,0,0.65)' }}
          onClick={() => setOpen(false)}
        >
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12 }}
            className="w-full max-w-lg rounded-2xl border overflow-hidden shadow-2xl"
            style={{ borderColor: 'var(--glass-border)', background: 'var(--bg-elevated)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 px-4 py-3 border-b" style={{ borderColor: 'var(--glass-border)' }}>
              <Search className="w-4 h-4 text-[var(--text-muted)]" />
              <input
                autoFocus
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Jump to page… (Ctrl+K)"
                className="flex-1 bg-transparent text-sm outline-none text-[var(--text-primary)]"
              />
            </div>
            <ul className="max-h-72 overflow-y-auto py-2">
              {filtered.map((r) => (
                <li key={r.href}>
                  <button
                    type="button"
                    onClick={() => go(r.href)}
                    className="w-full text-left px-4 py-2.5 flex items-center justify-between hover:bg-[var(--glass-bg)] transition-colors"
                  >
                    <span className="text-sm font-medium text-[var(--text-primary)]">{r.label}</span>
                    <span className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">{r.group}</span>
                  </button>
                </li>
              ))}
              {filtered.length === 0 && (
                <li className="px-4 py-6 text-sm text-center text-[var(--text-muted)]">No matches</li>
              )}
            </ul>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
