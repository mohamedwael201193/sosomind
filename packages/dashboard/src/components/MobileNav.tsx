'use client';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard, Zap, PieChart, CandlestickChart, Menu, X,
  Target, Grid3X3, Search, BarChart3, User, Settings, Beaker,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const primaryItems = [
  { href: '/dashboard', label: 'Overview', icon: LayoutDashboard },
  { href: '/signals', label: 'Signals', icon: Zap },
  { href: '/trade', label: 'Trade', icon: CandlestickChart },
  { href: '/portfolio', label: 'Portfolio', icon: PieChart },
];

const moreItems = [
  { href: '/research', label: 'Research', icon: Search },
  { href: '/sectors', label: 'SSI Sectors', icon: Grid3X3 },
  { href: '/agents', label: 'Market Regime', icon: BarChart3 },
  { href: '/perps', label: 'Perps', icon: BarChart3 },
  { href: '/account', label: 'Account', icon: User },
  { href: '/settings', label: 'Settings', icon: Settings },
  { href: '/track-record', label: 'Track Record', icon: Target },
  { href: '/strategies', label: 'Advanced / Labs', icon: Beaker },
];

export function MobileNav() {
  const { pathname } = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);

  if (pathname === '/landing' || pathname?.startsWith('/docs')) return null;

  const isMoreActive = moreItems.some((i) => pathname === i.href || pathname?.startsWith(i.href + '/'));

  return (
    <>
      <AnimatePresence>
        {moreOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[60] md:hidden bg-black/70 backdrop-blur-sm"
              onClick={() => setMoreOpen(false)}
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 320, damping: 32 }}
              className="fixed bottom-16 left-0 right-0 z-[70] md:hidden rounded-t-2xl border-t max-h-[60vh] overflow-y-auto"
              style={{ borderColor: 'var(--glass-border)', background: 'var(--bg-elevated)' }}
            >
              <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: 'var(--glass-border)' }}>
                <span className="text-sm font-bold text-[var(--text-primary)]">More</span>
                <button type="button" onClick={() => setMoreOpen(false)} aria-label="Close menu">
                  <X className="w-5 h-5 text-[var(--text-muted)]" />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2 p-4">
                {moreItems.map((item) => {
                  const active = pathname === item.href || pathname?.startsWith(item.href + '/');
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      to={item.href}
                      onClick={() => setMoreOpen(false)}
                      className={cn(
                        'flex items-center gap-2 px-3 py-3 rounded-xl text-sm font-semibold transition-colors',
                        active ? 'text-[var(--accent)] bg-[var(--accent-soft)]' : 'text-[var(--text-secondary)] bg-[var(--bg-glass)]',
                      )}
                    >
                      <Icon className="w-4 h-4" />
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <nav className="fixed bottom-0 left-0 right-0 md:hidden z-50 border-t border-[var(--glass-border)] bg-[var(--bg-card)] backdrop-blur-xl">
        <div className="flex items-center justify-around h-16 px-1">
          {primaryItems.map((item) => {
            const isActive = pathname === item.href || (item.href !== '/' && pathname?.startsWith(item.href));
            const Icon = item.icon;
            return (
              <Link key={item.href} to={item.href} className="flex-1">
                <motion.div
                  whileTap={{ scale: 0.96 }}
                  className={cn(
                    'flex flex-col items-center gap-1 py-2 transition-colors duration-200',
                    isActive ? 'text-[var(--accent)]' : 'text-[var(--text-muted)]',
                  )}
                >
                  <Icon className="w-5 h-5" />
                  <span className="text-[10px] font-semibold">{item.label}</span>
                </motion.div>
              </Link>
            );
          })}
          <button type="button" className="flex-1" onClick={() => setMoreOpen(true)}>
            <motion.div
              whileTap={{ scale: 0.96 }}
              className={cn(
                'flex flex-col items-center gap-1 py-2 transition-colors duration-200',
                isMoreActive || moreOpen ? 'text-[var(--accent)]' : 'text-[var(--text-muted)]',
              )}
            >
              <Menu className="w-5 h-5" />
              <span className="text-[10px] font-semibold">More</span>
            </motion.div>
          </button>
        </div>
      </nav>
    </>
  );
}
