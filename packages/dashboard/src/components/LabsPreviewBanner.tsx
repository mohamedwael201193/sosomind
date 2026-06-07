'use client';

import { Beaker } from 'lucide-react';

export function LabsPreviewBanner({ feature }: { feature?: string }) {
  return (
    <div
      className="flex items-start gap-3 px-4 py-3 rounded-xl border mb-6"
      style={{ borderColor: 'var(--glass-border)', background: 'var(--glass-bg)' }}
    >
      <Beaker className="w-4 h-4 flex-shrink-0 mt-0.5 text-[var(--text-muted)]" />
      <div>
        <p className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">Labs · Preview</p>
        <p className="text-xs mt-1 leading-relaxed text-[var(--text-secondary)]">
          {feature
            ? `${feature} is an experimental surface. Data may be limited or stubbed — core trading loop lives in Signals, Trade, and Portfolio.`
            : 'This page is in Labs preview. Data may be limited — the hero loop is Track Record → Signals → Trade → Portfolio.'}
        </p>
      </div>
    </div>
  );
}
