'use client';
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Wifi, WifiOff } from 'lucide-react';
import { API_URL } from '@/lib/api';
import { JudgePathButton } from './JudgePathBanner';

type ServiceStatus = 'up' | 'down' | 'loading';

export function StatusBar() {
  const [wsStatus, setWsStatus] = useState<ServiceStatus>('loading');
  const [apiStatus, setApiStatus] = useState<ServiceStatus>('loading');
  const [sosoStatus, setSosoStatus] = useState<ServiceStatus>('loading');
  const [sodexStatus, setSodexStatus] = useState<ServiceStatus>('loading');
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
        const sv = json?.services?.sosovalue?.status;
        setSosoStatus(sv === 'ok' ? 'up' : sv === 'down' ? 'down' : 'up');
        const sd = json?.services?.sodex?.status;
        setSodexStatus(sd === 'ok' ? 'up' : sd === 'down' ? 'down' : 'up');
        setLastUpdate(new Date());
      } catch {
        setApiStatus('down');
        setWsStatus('down');
        setSosoStatus('down');
        setSodexStatus('down');
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
        {dot(apiStatus)}
        <span>API</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--text-secondary)' }}>
        {dot(wsStatus)}
        <span>WS{wsStatus === 'up' ? ` · ${wsConnections}` : ''}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--text-secondary)' }}>
        {dot(sosoStatus)}
        <span>SoSoValue</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--text-secondary)' }}>
        {dot(sodexStatus)}
        <span>SoDEX</span>
      </div>
      <span
        className="px-2 py-0.5 rounded text-[10px] font-bold uppercase"
        style={{ background: 'var(--accent-soft)', color: 'var(--accent)', border: '1px solid var(--accent-border)' }}
      >
        Testnet
      </span>
      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
        <JudgePathButton />
        <span style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
          {apiStatus === 'up' ? <Wifi className="w-3 h-3" style={{ color: 'var(--green)' }} /> : <WifiOff className="w-3 h-3" style={{ color: 'var(--red)' }} />}
          {lastUpdate ? lastUpdate.toLocaleTimeString() : '…'}
        </span>
      </div>
    </motion.div>
  );
}
