'use client';
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Wifi, WifiOff, Activity, Database, Cpu } from 'lucide-react';
import { API_URL } from '@/lib/api';

type ServiceStatus = 'up' | 'down' | 'loading';

interface StatusItem {
  label: string;
  status: ServiceStatus;
  icon: React.ReactNode;
}

export function StatusBar() {
  const [wsStatus, setWsStatus] = useState<ServiceStatus>('loading');
  const [apiStatus, setApiStatus] = useState<ServiceStatus>('loading');
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [wsConnections, setWsConnections] = useState<number>(0);

  useEffect(() => {
    const check = async () => {
      try {
        const r = await fetch(`${API_URL}/api/health`, { signal: AbortSignal.timeout(4000) });
        const json = await r.json();
        setApiStatus('up');
        const ws = json?.services?.websocket;
        setWsStatus(ws?.status === 'ok' || ws?.status === 'running' ? 'up' : 'down');
        setWsConnections(ws?.connections ?? 0);
        setLastUpdate(new Date());
      } catch {
        setApiStatus('down');
        setWsStatus('down');
      }
    };
    check();
    const id = setInterval(check, 30_000);
    return () => clearInterval(id);
  }, []);

  const dot = (s: ServiceStatus) =>
    s === 'up' ? <span className="dot dot-green dot-pulse" /> :
    s === 'down' ? <span className="dot dot-red" /> :
    <span className="dot dot-gray dot-pulse" />;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.5, ease: [0.16, 1, 0.3, 1] }}
      style={{
        position: 'fixed', bottom: 0, left: 240, right: 0,
        height: 36,
        background: 'rgba(3, 10, 5, 0.82)',
        backdropFilter: 'blur(24px) saturate(180%)',
        WebkitBackdropFilter: 'blur(24px) saturate(180%)',
        borderTop: '1px solid var(--glass-border)',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
        display: 'flex', alignItems: 'center',
        padding: '0 20px',
        gap: 20,
        zIndex: 100,
        fontFamily: 'var(--font-mono)',
        fontSize: 11,
        letterSpacing: '0.03em',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--text-secondary)' }}>
        {dot(apiStatus)}
        <span>API</span>
        <span style={{ color: apiStatus === 'up' ? 'var(--green)' : apiStatus === 'down' ? 'var(--red)' : 'var(--text-muted)' }}>
          {apiStatus === 'up' ? 'connected' : apiStatus === 'down' ? 'offline' : 'checking'}
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--text-secondary)' }}>
        {dot(wsStatus)}
        <span>WS</span>
        <span style={{ color: wsStatus === 'up' ? 'var(--green)' : wsStatus === 'down' ? 'var(--red)' : 'var(--text-muted)' }}>
          {wsStatus === 'up' ? `live · ${wsConnections} conn` : wsStatus === 'down' ? 'offline' : '…'}
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--text-secondary)' }}>
        <span className="dot dot-green dot-pulse" /> SoSoValue
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--text-secondary)' }}>
        <span className="dot dot-green dot-pulse" /> SoDEX
      </div>
      <div style={{
        marginLeft: 'auto',
        color: 'var(--text-muted)',
        display: 'flex', alignItems: 'center', gap: 4,
      }}>
        <span
          style={{
            display: 'inline-block', width: 4, height: 4,
            borderRadius: '50%', background: 'var(--green)',
            boxShadow: '0 0 6px var(--green)',
            animation: 'glowPulse 2s ease-in-out infinite',
          }}
        />
        {lastUpdate ? `Updated ${lastUpdate.toLocaleTimeString()}` : 'Connecting…'}
      </div>
    </motion.div>
  );
}
