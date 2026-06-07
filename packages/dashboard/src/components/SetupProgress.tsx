'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { CheckCircle2, Circle, ExternalLink, ChevronRight } from 'lucide-react';
import { useSetupProgress } from '@/hooks/useSetupProgress';
import { useWallet } from '@/context/WalletContext';
import { cn } from '@/lib/utils';

type Variant = 'compact' | 'card' | 'full';

export function SetupProgress({ variant = 'card', className }: { variant?: Variant; className?: string }) {
  const { connect, isConnecting, address } = useWallet();
  const { steps, completedCount, totalSteps, isComplete, nextStep, isLoading } = useSetupProgress();

  if (isComplete && variant === 'compact') return null;

  const pct = Math.round((completedCount / totalSteps) * 100);

  if (variant === 'compact') {
    return (
      <Link
        href="/dashboard"
        className={cn('block px-3 py-2 rounded-xl text-left transition-colors hover:bg-[var(--glass-bg)]', className)}
        title="Setup progress"
      >
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--accent)]">
            Setup {completedCount}/{totalSteps}
          </span>
          <ChevronRight className="w-3 h-3 text-[var(--text-muted)]" />
        </div>
        <div className="h-1 rounded-full overflow-hidden bg-[var(--glass-bg)]">
          <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: 'var(--accent)' }} />
        </div>
      </Link>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn('rounded-2xl border p-4', className)}
      style={{ borderColor: 'var(--glass-border)', background: 'var(--bg-card)' }}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--accent)]">
            {isComplete ? 'Setup complete' : 'Trading setup'}
          </p>
          <h3 className="text-sm font-bold text-[var(--text-primary)] mt-0.5">
            {isComplete ? 'Ready to trade on SoDEX testnet' : nextStep?.label ?? 'Getting started'}
          </h3>
        </div>
        <span className="text-xs font-mono font-bold text-[var(--text-muted)]">{completedCount}/{totalSteps}</span>
      </div>

      <div className="h-1.5 rounded-full overflow-hidden mb-4 bg-[var(--glass-bg)]">
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: 'var(--accent)' }} />
      </div>

      <ul className={cn('space-y-2', variant === 'full' ? 'space-y-3' : '')}>
        {steps.map((step) => (
          <li key={step.id} className="flex items-start gap-2.5">
            {step.done ? (
              <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5 text-[var(--green)]" />
            ) : (
              <Circle className="w-4 h-4 flex-shrink-0 mt-0.5 text-[var(--text-muted)]" />
            )}
            <div className="flex-1 min-w-0">
              <p className={cn('text-xs font-medium', step.done ? 'text-[var(--text-muted)] line-through' : 'text-[var(--text-primary)]')}>
                {step.label}
              </p>
              {!step.done && step.id === 'connect' && !address && (
                <button
                  type="button"
                  onClick={() => connect()}
                  disabled={isConnecting}
                  className="text-[10px] font-semibold mt-1 text-[var(--accent)]"
                >
                  {isConnecting ? 'Connecting…' : 'Connect MetaMask →'}
                </button>
              )}
              {!step.done && step.external && step.id !== 'connect' && (
                <a
                  href={step.external}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[10px] font-semibold mt-1 text-[var(--accent)]"
                >
                  Open SoDEX <ExternalLink className="w-3 h-3" />
                </a>
              )}
              {!step.done && step.href && step.id !== 'connect' && (
                <Link href={step.href} className="text-[10px] font-semibold mt-1 text-[var(--accent)] block">
                  Continue →
                </Link>
              )}
            </div>
          </li>
        ))}
      </ul>

      {isLoading && (
        <p className="text-[10px] text-[var(--text-muted)] mt-3 font-mono">Checking SoDEX account…</p>
      )}
    </motion.div>
  );
}
