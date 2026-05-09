'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, fetcher } from '@/lib/api';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, Plus, Trash2, TrendingUp, TrendingDown, AlertTriangle, CheckCircle } from 'lucide-react';
import { PageHeader } from '@/components/LoadingSkeleton';

const INPUT_STYLE: React.CSSProperties = {
  padding: '10px 12px', borderRadius: 10, background: 'var(--bg-elev)',
  border: '1px solid var(--border)', color: 'var(--text)', fontSize: 13,
  outline: 'none', transition: 'border-color 0.15s',
};

const ALERT_SEVERITY: Record<string, { color: string; bg: string; icon: any }> = {
  critical: { color: '#ef4444', bg: 'rgba(239,68,68,0.08)', icon: AlertTriangle },
  warning:  { color: '#f59e0b', bg: 'rgba(245,158,11,0.08)', icon: AlertTriangle },
  info:     { color: '#3b82f6', bg: 'rgba(59,130,246,0.08)', icon: Bell },
};

export default function AlertsPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['alerts'], queryFn: () => fetcher('/api/alerts'), refetchInterval: 30000 });
  const list: any[] = Array.isArray(data) ? data as any[] : [];

  const [asset, setAsset] = useState('BTC');
  const [cond, setCond] = useState<'gt' | 'lt'>('gt');
  const [threshold, setThreshold] = useState('');
  const [filter, setFilter] = useState<'all' | 'active' | 'triggered'>('all');

  const create = useMutation({
    mutationFn: () => api.post('/api/alerts', {
      type: cond === 'gt' ? 'price_above' : 'price_below',
      asset, condition: cond, threshold: Number(threshold),
      message: `${asset} ${cond === 'gt' ? 'above' : 'below'} $${Number(threshold).toLocaleString()}`,
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['alerts'] }); setThreshold(''); },
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/api/alerts/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['alerts'] }),
  });

  const filtered = list.filter(a =>
    filter === 'all' ? true : filter === 'active' ? a.is_active : !a.is_active
  );

  return (
    <div>
      <PageHeader title="Alerts" subtitle="Price and signal alert management with real-time monitoring" />

      {/* Create form */}
      <motion.div className="card" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} style={{ marginBottom: 16 }}>
        <h3 style={{ fontSize: 13, fontWeight: 700, marginBottom: 12, color: 'var(--muted2)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Create Alert</h3>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            value={asset} onChange={(e) => setAsset(e.target.value.toUpperCase())}
            placeholder="BTC" style={{ ...INPUT_STYLE, width: 90 }}
          />
          <select value={cond} onChange={(e) => setCond(e.target.value as 'gt' | 'lt')} style={{ ...INPUT_STYLE, cursor: 'pointer' }}>
            <option value="gt">price above</option>
            <option value="lt">price below</option>
          </select>
          <div style={{ position: 'relative', flex: 1, minWidth: 160 }}>
            <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)', fontSize: 13 }}>$</span>
            <input
              value={threshold} onChange={(e) => setThreshold(e.target.value)}
              placeholder="80,000" type="number" style={{ ...INPUT_STYLE, paddingLeft: 22, width: '100%' }}
            />
          </div>
          <motion.button
            className="btn" onClick={() => create.mutate()}
            disabled={!threshold || create.isPending}
            whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
            style={{ display: 'flex', alignItems: 'center', gap: 6, opacity: !threshold ? 0.5 : 1 }}
          >
            <Plus size={14} /> {create.isPending ? 'Adding…' : 'Add Alert'}
          </motion.button>
        </div>
      </motion.div>

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        {(['all', 'active', 'triggered'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{
            padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600,
            background: filter === f ? 'rgba(16,185,129,0.12)' : 'transparent',
            border: filter === f ? '1px solid rgba(16,185,129,0.3)' : '1px solid var(--border)',
            color: filter === f ? 'var(--green)' : 'var(--muted2)', cursor: 'pointer',
            textTransform: 'capitalize',
          }}>
            {f === 'all' ? `All (${list.length})` : f === 'active' ? `Active (${list.filter(a => a.is_active).length})` : `Triggered (${list.filter(a => !a.is_active).length})`}
          </button>
        ))}
      </div>

      {/* Alert list */}
      <motion.div className="card">
        {isLoading && <div style={{ color: 'var(--muted)', fontSize: 13, padding: '20px 0', textAlign: 'center' }}>Loading alerts…</div>}
        {!isLoading && filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: '48px 0' }}>
            <Bell size={32} style={{ color: 'var(--muted)', marginBottom: 12 }} />
            <div style={{ color: 'var(--muted2)', fontWeight: 600 }}>No alerts</div>
            <div style={{ color: 'var(--muted)', fontSize: 12, marginTop: 4 }}>Create a price alert above to get notified when thresholds are hit.</div>
          </div>
        )}
        <AnimatePresence>
          {filtered.map((a: any, i: number) => {
            const isActive = a.is_active;
            const isAbove = a.condition === 'gt' || a.type === 'price_above';
            return (
              <motion.div
                key={a.id}
                layout
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 12, height: 0, marginBottom: 0 }}
                transition={{ duration: 0.25, delay: i * 0.04 }}
                style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '14px 0', borderTop: i > 0 ? '1px solid var(--border)' : 'none',
                  gap: 12,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: 10,
                    background: isActive ? 'rgba(16,185,129,0.1)' : 'rgba(100,116,139,0.08)',
                    display: 'grid', placeItems: 'center', flexShrink: 0,
                  }}>
                    {isAbove
                      ? <TrendingUp size={16} style={{ color: isActive ? 'var(--green)' : 'var(--muted)' }} />
                      : <TrendingDown size={16} style={{ color: isActive ? 'var(--red)' : 'var(--muted)' }} />
                    }
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700 }}>
                      <span style={{ color: 'var(--text)' }}>{a.asset}</span>
                      <span style={{ color: 'var(--muted)', fontWeight: 400, marginLeft: 6 }}>
                        {isAbove ? 'above' : 'below'}{' '}
                        <span className="mono" style={{ color: isActive ? 'var(--text)' : 'var(--muted)' }}>
                          ${Number(a.threshold).toLocaleString()}
                        </span>
                      </span>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2, display: 'flex', gap: 8 }}>
                      <span>{new Date(a.created_at).toLocaleString()}</span>
                      <span style={{ color: isActive ? 'var(--green)' : 'var(--muted2)', fontWeight: 600 }}>
                        {isActive ? '● Active' : '✓ Triggered'}
                      </span>
                    </div>
                  </div>
                </div>
                <motion.button
                  onClick={() => remove.mutate(a.id)}
                  whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }}
                  style={{ background: 'transparent', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 8px', cursor: 'pointer', color: 'var(--muted)', transition: 'all 0.15s' }}
                >
                  <Trash2 size={13} />
                </motion.button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
