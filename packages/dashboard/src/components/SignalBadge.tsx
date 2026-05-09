'use client';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface SignalBadgeProps {
  direction: 'LONG' | 'SHORT' | 'NEUTRAL' | string;
  size?: 'sm' | 'md' | 'lg';
}

export function SignalBadge({ direction, size = 'md' }: SignalBadgeProps) {
  const d = (direction || '').toUpperCase();
  const isLong = d === 'LONG';
  const isShort = d === 'SHORT';
  const iconSize = size === 'sm' ? 10 : size === 'lg' ? 16 : 12;
  const padding = size === 'sm' ? '2px 7px' : size === 'lg' ? '5px 14px' : '3px 10px';
  const fontSize = size === 'sm' ? 10 : size === 'lg' ? 13 : 11;

  return (
    <span
      className={`badge ${isLong ? 'badge-long' : isShort ? 'badge-short' : 'badge-neutral'}`}
      style={{ padding, fontSize, gap: 4 }}
    >
      {isLong ? <TrendingUp size={iconSize} /> : isShort ? <TrendingDown size={iconSize} /> : <Minus size={iconSize} />}
      {d}
    </span>
  );
}

interface ConfidenceBarProps {
  value: number; // 0-100
  animate?: boolean;
}

export function ConfidenceBar({ value, animate = true }: ConfidenceBarProps) {
  const color = value >= 70 ? 'var(--green)' : value >= 45 ? 'var(--orange)' : 'var(--red)';
  return (
    <div className="conf-bar" style={{ width: '100%' }}>
      <motion.div
        className="conf-bar-fill"
        initial={animate ? { width: 0 } : { width: `${value}%` }}
        animate={{ width: `${value}%` }}
        transition={{ duration: 0.8, ease: [0.16,1,0.3,1], delay: 0.2 }}
        style={{ background: color }}
      />
    </div>
  );
}

interface SignalCardProps {
  signal: {
    id?: string;
    asset?: string;
    direction?: string;
    confidence?: number;
    entry?: number;
    take_profit?: number;
    stop_loss?: number;
    reasoning?: string;
    time_horizon?: string;
    risk_level?: string;
    status?: string;
    created_at?: string;
  };
  delay?: number;
  onClick?: () => void;
}

export function SignalCard({ signal: s, delay = 0, onClick }: SignalCardProps) {
  const dir = (s.direction || 'NEUTRAL').toUpperCase();
  const isLong = dir === 'LONG';
  const isShort = dir === 'SHORT';
  const conf = Number(s.confidence ?? 0);

  return (
    <motion.div
      className="card"
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.16,1,0.3,1], delay }}
      whileHover={{ y: -2, boxShadow: `0 8px 32px ${isLong ? 'rgba(16,185,129,0.15)' : isShort ? 'rgba(239,68,68,0.15)' : 'rgba(0,0,0,0.3)'}` }}
      onClick={onClick}
      style={{
        cursor: onClick ? 'pointer' : 'default',
        borderLeft: `3px solid ${isLong ? 'var(--green)' : isShort ? 'var(--red)' : 'var(--muted)'}`,
        padding: '16px 18px',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontWeight: 800, fontSize: 16, letterSpacing: '-0.01em' }}>{s.asset}</span>
          <SignalBadge direction={dir} />
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, flexDirection: 'column' }}>
          <span style={{ fontSize: 20, fontWeight: 700, color: isLong ? 'var(--green)' : isShort ? 'var(--red)' : 'var(--muted2)' }} className="mono">
            {conf}%
          </span>
        </div>
      </div>

      <ConfidenceBar value={conf} />

      {/* Price targets */}
      <div style={{ display: 'flex', gap: 16, marginTop: 10, fontSize: 12 }}>
        {s.entry && <span style={{ color: 'var(--muted2)' }}>Entry <span className="mono" style={{ color: 'var(--text)' }}>${Number(s.entry).toLocaleString()}</span></span>}
        {s.take_profit && <span style={{ color: 'var(--muted2)' }}>TP <span className="mono" style={{ color: 'var(--green)' }}>${Number(s.take_profit).toLocaleString()}</span></span>}
        {s.stop_loss && <span style={{ color: 'var(--muted2)' }}>SL <span className="mono" style={{ color: 'var(--red)' }}>${Number(s.stop_loss).toLocaleString()}</span></span>}
      </div>

      {/* Reasoning */}
      {s.reasoning && (
        <p style={{ marginTop: 10, fontSize: 12, color: 'var(--muted2)', lineHeight: 1.6, borderTop: '1px solid var(--border)', paddingTop: 10 }}>
          {s.reasoning.slice(0, 160)}{s.reasoning.length > 160 ? '…' : ''}
        </p>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 11, color: 'var(--muted)' }}>
        <span>{s.time_horizon || '—'}</span>
        <span>{s.created_at ? new Date(s.created_at).toLocaleString() : ''}</span>
      </div>
    </motion.div>
  );
}
