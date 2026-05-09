'use client';
import { useEffect, useRef, useState } from 'react';
import { motion, useSpring, useMotionValue } from 'framer-motion';

interface AnimatedNumberProps {
  value: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  className?: string;
  style?: React.CSSProperties;
}

export function AnimatedNumber({ value, prefix = '', suffix = '', decimals = 2, className, style }: AnimatedNumberProps) {
  const mv = useMotionValue(value);
  const spring = useSpring(mv, { stiffness: 80, damping: 20, mass: 0.5 });
  const [display, setDisplay] = useState(value);
  const prev = useRef(value);

  useEffect(() => {
    mv.set(value);
    const unsub = spring.on('change', (v) => setDisplay(v));
    return unsub;
  }, [value]);

  const flashClass = value > prev.current ? 'flash-green' : value < prev.current ? 'flash-red' : '';
  useEffect(() => { prev.current = value; }, [value]);

  return (
    <span className={`mono ${flashClass} ${className ?? ''}`} style={style}>
      {prefix}{display.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}{suffix}
    </span>
  );
}

interface StatCardProps {
  label: string;
  value: string | number;
  sub?: string;
  icon?: React.ReactNode;
  trend?: number;   // +/-% raw number
  color?: string;
  delay?: number;
}

export function StatCard({ label, value, sub, icon, trend, color = 'var(--green)', delay = 0 }: StatCardProps) {
  const isUp = typeof trend === 'number' && trend > 0;
  const isDown = typeof trend === 'number' && trend < 0;
  return (
    <motion.div
      className="card"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.16,1,0.3,1], delay }}
      style={{ padding: '18px 20px' }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
        <span style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 500 }}>{label}</span>
        {icon && (
          <div style={{ width: 32, height: 32, borderRadius: 8, background: `${color}18`, display: 'grid', placeItems: 'center', color }}>
            {icon}
          </div>
        )}
      </div>
      <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.03em', color: 'var(--text)', lineHeight: 1 }} className="mono">
        {value}
      </div>
      {(sub || typeof trend === 'number') && (
        <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
          {typeof trend === 'number' && (
            <span style={{
              fontSize: 11, fontWeight: 600, padding: '2px 6px', borderRadius: 6,
              background: isUp ? 'rgba(16,185,129,0.12)' : isDown ? 'rgba(239,68,68,0.12)' : 'rgba(100,116,139,0.12)',
              color: isUp ? 'var(--green)' : isDown ? 'var(--red)' : 'var(--muted2)',
            }}>
              {isUp ? '▲' : isDown ? '▼' : '●'} {Math.abs(trend).toFixed(2)}%
            </span>
          )}
          {sub && <span style={{ fontSize: 11, color: 'var(--muted)' }}>{sub}</span>}
        </div>
      )}
    </motion.div>
  );
}
