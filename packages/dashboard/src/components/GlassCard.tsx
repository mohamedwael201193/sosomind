'use client';
import { useState } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface GlassCardProps {
  children?: React.ReactNode;
  className?: string;
  hover?: boolean;
  glow?: 'green' | 'red' | 'blue' | 'purple' | 'orange' | 'none';
  padding?: 'sm' | 'md' | 'lg';
  animate?: boolean;
  spotlight?: boolean;
  style?: React.CSSProperties;
}

export function GlassCard({
  children,
  className,
  hover = true,
  glow = 'none',
  padding = 'md',
  animate = true,
  spotlight = true,
  style,
}: GlassCardProps) {
  const [pos, setPos] = useState({ x: 0, y: 0, opacity: 0 });

  const glowMap: Record<string, string> = {
    green:  'shadow-[0_0_30px_rgba(34,197,94,0.12)] border-[rgba(34,197,94,0.22)]',
    red:    'shadow-[0_0_40px_rgba(255,71,87,0.12)] border-[rgba(255,71,87,0.22)]',
    blue:   'shadow-[0_0_40px_rgba(0,229,255,0.12)] border-[rgba(0,229,255,0.22)]',
    purple: 'shadow-[0_0_40px_rgba(180,122,255,0.12)] border-[rgba(180,122,255,0.22)]',
    orange: 'shadow-[0_0_30px_rgba(249,115,22,0.15)] border-[rgba(249,115,22,0.28)]',
    none:   '',
  };

  const paddingMap: Record<string, string> = { sm: 'p-3', md: 'p-4', lg: 'p-6' };

  return (
    <motion.div
      initial={animate ? { opacity: 0, y: 20 } : false}
      animate={animate ? { opacity: 1, y: 0 } : false}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      style={style}
      className={cn(
        'relative overflow-hidden rounded-[var(--radius-lg)] border border-[var(--glass-border)]',
        'bg-[var(--bg-card)] backdrop-blur-xl',
        hover && 'transition-all duration-300 hover:border-[var(--glass-border-strong)]',
        glowMap[glow],
        paddingMap[padding],
        className
      )}
      onMouseMove={spotlight ? (e) => {
        const r = e.currentTarget.getBoundingClientRect();
        setPos({ x: e.clientX - r.left, y: e.clientY - r.top, opacity: 1 });
      } : undefined}
      onMouseLeave={spotlight ? () => setPos((p) => ({ ...p, opacity: 0 })) : undefined}
    >
      {/* Spotlight mouse-follow glow */}
      {spotlight && (
        <div
          className="pointer-events-none absolute inset-0 transition-opacity duration-500"
          style={{
            opacity: pos.opacity,
            background: `radial-gradient(500px circle at ${pos.x}px ${pos.y}px, rgba(249,115,22,0.05), transparent 50%)`,
          }}
        />
      )}
      {/* Top highlight shimmer */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[rgba(255,255,255,0.10)] to-transparent" />
      {children}
    </motion.div>
  );
}

