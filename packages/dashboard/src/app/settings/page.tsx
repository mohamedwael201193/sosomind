'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Settings, Shield, Bell, Cpu, BarChart2, Sliders, Wallet } from 'lucide-react';
import { PageHeader } from '@/components/LoadingSkeleton';
import { ConnectWallet } from '@/components/ConnectWallet';
import { useWallet } from '@/context/WalletContext';

const SECTION = ({ title, icon: Icon, children }: { title: string; icon: any; children: React.ReactNode }) => (
  <motion.div className="card" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} style={{ marginBottom: 14 }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, paddingBottom: 12, borderBottom: '1px solid var(--border)' }}>
      <div style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(16,185,129,0.1)', display: 'grid', placeItems: 'center' }}>
        <Icon size={14} style={{ color: 'var(--green)' }} />
      </div>
      <h3 style={{ fontSize: 14, fontWeight: 700 }}>{title}</h3>
    </div>
    {children}
  </motion.div>
);

const Toggle = ({ label, sub, defaultOn = false }: { label: string; sub?: string; defaultOn?: boolean }) => {
  const [on, setOn] = useState(defaultOn);
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0' }}>
      <div>
        <div style={{ fontSize: 13, fontWeight: 500 }}>{label}</div>
        {sub && <div style={{ fontSize: 11, color: 'var(--muted)' }}>{sub}</div>}
      </div>
      <motion.button
        onClick={() => setOn(!on)}
        style={{
          width: 40, height: 22, borderRadius: 11,
          background: on ? 'var(--green)' : 'var(--border)',
          position: 'relative', border: 'none', cursor: 'pointer', flexShrink: 0,
          transition: 'background 0.2s',
        }}
      >
        <motion.span
          animate={{ x: on ? 20 : 2 }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          style={{ width: 16, height: 16, borderRadius: 8, background: '#fff', position: 'absolute', top: 3 }}
        />
      </motion.button>
    </div>
  );
};

const RangeSlider = ({ label, min, max, step, defaultVal, suffix = '' }: { label: string; min: number; max: number; step: number; defaultVal: number; suffix?: string }) => {
  const [val, setVal] = useState(defaultVal);
  return (
    <div style={{ padding: '8px 0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 8 }}>
        <span style={{ fontWeight: 500 }}>{label}</span>
        <span className="mono" style={{ color: 'var(--green)' }}>{val}{suffix}</span>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={val}
        onChange={(e) => setVal(Number(e.target.value))}
        style={{ width: '100%', accentColor: 'var(--green)' }}
      />
    </div>
  );
};

export default function SettingsPage() {
  const { address, profile, refreshProfile } = useWallet();

  // Refresh profile whenever address/token loads (covers initial mount + reconnect)
  useEffect(() => {
    if (address) refreshProfile();
  }, [address]);
  return (
    <div>
      <PageHeader title="Settings" subtitle="Configure AI providers, risk parameters and notification preferences" />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <div>
          {/* Wallet / Identity */}
          <SECTION title="Wallet & Identity" icon={Wallet}>
            <div style={{ marginBottom: 12 }}>
              {address ? (
                <div style={{ marginBottom: 8, padding: '10px 12px', borderRadius: 8, background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.15)', fontSize: 12, color: 'var(--muted)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <span>Wallet:</span>
                    <span style={{ fontFamily: 'monospace', color: 'var(--text)', fontSize: 11 }}>{address.slice(0, 8)}…{address.slice(-6)}</span>
                    {profile?.display_name && <span style={{ color: 'var(--green)' }}>· {profile.display_name}</span>}
                  </div>
                  {profile?.telegram_chat_id ? (
                    <div style={{ fontSize: 11, color: 'var(--green)', display: 'flex', alignItems: 'center', gap: 4 }}>
                      🔗 Telegram linked
                    </div>
                  ) : (
                    <div style={{ fontSize: 11, color: 'var(--muted)' }}>Telegram not linked</div>
                  )}
                  {profile?.created_at && (
                    <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 3 }}>
                      Member since {new Date(profile.created_at).toLocaleDateString()}
                    </div>
                  )}
                </div>
              ) : (
                <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 10 }}>
                  Connect your MetaMask wallet to get a personalised dashboard, alerts, and Telegram bot integration.
                </p>
              )}
              <ConnectWallet variant="full" />
            </div>
          </SECTION>

          <SECTION title="AI Providers" icon={Cpu}>
            {['OpenAI GPT-4o', 'Claude Sonnet 4.5', 'Gemini Flash 2.0', 'Perplexity Sonar'].map((p, i) => (
              <div key={p} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: i < 3 ? '1px solid var(--border)' : 'none' }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{p}</div>
                  <div style={{ fontSize: 11, color: 'var(--muted)' }}>Priority {i + 1}</div>
                </div>
                <span className="badge badge-active" style={{ fontSize: 10 }}>ACTIVE</span>
              </div>
            ))}
          </SECTION>

          <SECTION title="Risk Management" icon={Shield}>
            <RangeSlider label="Max Position Size" min={1} max={25} step={0.5} defaultVal={10} suffix="%" />
            <RangeSlider label="Stop Loss Default" min={1} max={15} step={0.5} defaultVal={5} suffix="%" />
            <RangeSlider label="Take Profit Target" min={5} max={50} step={1} defaultVal={20} suffix="%" />
            <RangeSlider label="Max Drawdown Limit" min={5} max={30} step={1} defaultVal={15} suffix="%" />
          </SECTION>
        </div>

        <div>
          <SECTION title="Notifications" icon={Bell}>
            <Toggle label="Signal Alerts" sub="Push notification on new AI signals" defaultOn />
            <Toggle label="Price Alerts" sub="Alert on watchlist price movements" defaultOn />
            <Toggle label="Macro Events" sub="Notify on ETF inflows and macro events" />
            <Toggle label="PnL Threshold" sub="Alert when PnL drops below threshold" defaultOn />
            <Toggle label="WebSocket Disconnect" sub="Alert if live data connection drops" defaultOn />
          </SECTION>

          <SECTION title="Dashboard" icon={BarChart2}>
            <Toggle label="Animated Numbers" sub="Spring-physics number transitions" defaultOn />
            <Toggle label="Grain Texture" sub="Subtle noise overlay for depth" defaultOn />
            <Toggle label="Gradient Background" sub="Animated mesh gradient" defaultOn />
            <Toggle label="Compact Mode" sub="Reduce padding for more data density" />
          </SECTION>

          <SECTION title="Data Sources" icon={Sliders}>
            {[
              { label: 'SoSoValue ETF API', status: 'Connected' },
              { label: 'SoDEX Testnet', status: 'Connected' },
              { label: 'Binance (fallback)', status: 'Standby' },
              { label: 'ElevenLabs Voice', status: 'Configurable' },
            ].map((s, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: i < 3 ? '1px solid var(--border)' : 'none' }}>
                <span style={{ fontSize: 13 }}>{s.label}</span>
                <span style={{
                  fontSize: 11, padding: '2px 8px', borderRadius: 6, fontWeight: 600,
                  background: s.status === 'Connected' ? 'rgba(16,185,129,0.1)' : 'rgba(100,116,139,0.1)',
                  color: s.status === 'Connected' ? 'var(--green)' : 'var(--muted2)',
                }}>{s.status}</span>
              </div>
            ))}
          </SECTION>
        </div>
      </div>
    </div>
  );
}
