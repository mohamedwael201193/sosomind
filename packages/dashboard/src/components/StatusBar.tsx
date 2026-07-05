'use client';
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Wifi, WifiOff } from 'lucide-react';
import { fetchLiveHealth, type HealthSnapshot, type ServiceStatus } from '@/lib/health';

export function StatusBar() {
  const [health, setHealth] = useState<HealthSnapshot>({
    api: 'loading',
    ws: 'loading',
    soso: 'loading',
    sodex: 'loading',
    wsConnections: 0,
    updatedAt: null,
  });

  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      const snap = await fetchLiveHealth();
      if (!cancelled) setHealth(snap);
    };
    check();
    const id = setInterval(check, 20_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  const dot = (s: ServiceStatus) =>
    s === 'up' ? <span className="dot dot-green dot-pulse" /> :
    s === 'warn' ? <span className="dot dot-yellow" /> :
    s === 'down' ? <span className="dot dot-red" /> :
    <span className="dot dot-gray dot-pulse" />;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="hidden md:flex"
      style={{
        position: 'fixed', bottom: 0, left: 240, right: 0,
        height: 36,
        background: 'rgba(3, 10, 5, 0.82)',
        backdropFilter: 'blur(24px) saturate(180%)',
        WebkitBackdropFilter: 'blur(24px) saturate(180%)',
        borderTop: '1px solid var(--glass-border)',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
        alignItems: 'center',
        padding: '0 20px',
        gap: 16,
        zIndex: 100,
        fontFamily: 'var(--font-mono)',
        fontSize: 11,
        letterSpacing: '0.03em',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--text-secondary)' }}>
        {dot(health.api)}
        <span>API</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--text-secondary)' }}>
        {dot(health.ws)}
        <span>WS{health.ws === 'up' ? ` · ${health.wsConnections}` : ''}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--text-secondary)' }}>
        {dot(health.soso)}
        <span>SoSoValue</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--text-secondary)' }}>
        {dot(health.sodex)}
        <span>SoDEX</span>
      </div>
      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
          {health.api === 'up' ? <Wifi className="w-3 h-3" style={{ color: 'var(--green)' }} /> : <WifiOff className="w-3 h-3" style={{ color: 'var(--red)' }} />}
          {health.updatedAt ? health.updatedAt.toLocaleTimeString() : '…'}
        </span>
      </div>
    </motion.div>
  );
}
