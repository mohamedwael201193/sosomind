'use client';

import { motion } from 'framer-motion';
import { AlertTriangle, Inbox, Loader2, Lock, WifiOff } from 'lucide-react';

export type ProductionStateKind = 'loading' | 'empty' | 'unavailable' | 'error' | 'degraded' | 'not_connected';

const DEFAULTS: Record<
  ProductionStateKind,
  { title: string; message: string; icon: typeof Inbox }
> = {
  loading: {
    title: 'Loading',
    message: 'Fetching live data…',
    icon: Loader2,
  },
  empty: {
    title: 'Nothing here yet',
    message: 'No records match this view. Activity will appear once data is available.',
    icon: Inbox,
  },
  unavailable: {
    title: 'Unavailable',
    message: 'This data source is temporarily unavailable. Try again shortly.',
    icon: WifiOff,
  },
  error: {
    title: 'Could not load',
    message: 'We could not reach the server. Check your connection and retry.',
    icon: AlertTriangle,
  },
  degraded: {
    title: 'Partial data',
    message: 'Some sources are delayed. Displayed values may be incomplete.',
    icon: AlertTriangle,
  },
  not_connected: {
    title: 'Not connected',
    message: 'Connect your wallet to view account-specific data.',
    icon: Lock,
  },
};

interface ProductionStateProps {
  state: ProductionStateKind;
  title?: string;
  message?: string;
  action?: React.ReactNode;
  compact?: boolean;
  className?: string;
}

export function ProductionState({
  state,
  title,
  message,
  action,
  compact,
  className = '',
}: ProductionStateProps) {
  const preset = DEFAULTS[state];
  const Icon = preset.icon;
  const spin = state === 'loading';

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      className={`rounded-[var(--radius-lg)] border text-center ${compact ? 'px-4 py-6' : 'px-6 py-10'} ${className}`}
      style={{
        borderColor: 'var(--glass-border)',
        background: 'var(--glass-bg)',
      }}
    >
      <div
        className={`mx-auto mb-3 flex items-center justify-center rounded-xl ${compact ? 'w-9 h-9' : 'w-11 h-11'}`}
        style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}
      >
        <Icon className={`${compact ? 'w-4 h-4' : 'w-5 h-5'} ${spin ? 'animate-spin' : ''}`} />
      </div>
      <p className={`font-bold text-[var(--text-primary)] ${compact ? 'text-sm' : 'text-base'} mb-1`}>
        {title ?? preset.title}
      </p>
      <p className={`text-[var(--text-secondary)] max-w-md mx-auto ${compact ? 'text-xs' : 'text-sm'} leading-relaxed`}>
        {message ?? preset.message}
      </p>
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </motion.div>
  );
}
