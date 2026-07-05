'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { fetcher } from '@/lib/api';
import { PageHeader } from '@/components/LoadingSkeleton';
import { StatCard } from '@/components/AnimatedNumber';
import { useWallet } from '@/context/WalletContext';
import { useEnvironment } from '@/context/EnvironmentContext';
import {
  Wallet, Loader2, RefreshCw, ExternalLink, AlertTriangle,
  TrendingUp, Shield, Activity,
} from 'lucide-react';

function fmt(n: number | string | null | undefined, dec = 4) {
  const v = typeof n === 'string' ? parseFloat(n) : n;
  if (v == null || !Number.isFinite(v)) return '—';
  return v.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: dec });
}

function normalizeRows(raw: unknown, keys = ['balances', 'positions', 'orders', 'data', 'list']): any[] {
  if (Array.isArray(raw)) return raw;
  if (raw && typeof raw === 'object') {
    for (const k of keys) {
      const v = (raw as Record<string, unknown>)[k];
      if (Array.isArray(v)) return v;
    }
  }
  return [];
}

export default function PerpsPage() {
  const { address, connect, isConnecting } = useWallet();
  const { selector, config } = useEnvironment();
  const sodexAppUrl = config?.active?.sodexAppUrl ?? (selector === 'testnet' ? 'https://testnet.sodex.com' : 'https://sodex.com');
  const envLabel = config?.active?.label ?? (selector === 'testnet' ? 'Testnet' : 'Mainnet');

  const markPrices = useQuery<any[]>({
    queryKey: ['sodex', selector, 'perps', 'mark-prices'],
    refetchInterval: 15_000,
    queryFn: async () => {
      const raw = await fetcher<any>('/api/sodex/perps/mark-prices');
      return normalizeRows(raw);
    },
  });

  const balances = useQuery<any>({
    queryKey: ['sodex', selector, 'perps-balances', address],
    enabled: Boolean(address),
    refetchInterval: 12_000,
    queryFn: () => fetcher(`/api/sodex/user/${address}/perps/balances`),
  });

  const positions = useQuery<any>({
    queryKey: ['sodex', selector, 'perps-positions', address],
    enabled: Boolean(address),
    refetchInterval: 10_000,
    queryFn: () => fetcher(`/api/sodex/user/${address}/perps/positions`),
  });

  const fundingQuery = useQuery<any>({
    queryKey: ['account', 'funding', selector, address],
    enabled: Boolean(address),
    refetchInterval: 30_000,
    queryFn: () => fetcher(`/api/account/funding?address=${address}`),
  });

  const balanceRows = useMemo(() => normalizeRows(balances.data), [balances.data]);
  const positionRows = useMemo(() => normalizeRows(positions.data, ['positions', 'data', 'list']), [positions.data]);
  const usdcAvail = useMemo(() => {
    const row = balanceRows.find((b) => ['USDC', 'vUSDC'].includes(String(b.coin ?? b.asset ?? '').toUpperCase()));
    return parseFloat(row?.available ?? row?.avail ?? row?.free ?? '0') || 0;
  }, [balanceRows]);

  const perpsFunded = Boolean((fundingQuery.data as any)?.perps?.funded) || usdcAvail > 0;

  const fundingRates = useMemo(() => {
    return (markPrices.data ?? [])
      .filter((m) => m.fundingRate != null || m.funding_rate != null)
      .slice(0, 12)
      .map((m) => ({
        symbol: m.symbol ?? m.market,
        rate: parseFloat(m.fundingRate ?? m.funding_rate ?? '0'),
        mark: parseFloat(m.markPrice ?? m.mark_price ?? m.lastPx ?? '0'),
        index: parseFloat(m.indexPrice ?? m.index_price ?? '0'),
      }));
  }, [markPrices.data]);

  const liquidationRisk = useMemo(() => {
    return positionRows.map((p) => {
      const liq = parseFloat(p.liquidationPrice ?? p.liqPrice ?? '0');
      const mark = parseFloat(p.markPrice ?? p.mark_price ?? '0');
      const margin = parseFloat(p.margin ?? p.initialMargin ?? '0');
      const dist = liq > 0 && mark > 0 ? Math.abs((mark - liq) / mark) * 100 : null;
      return { ...p, liq, mark, margin, distPct: dist };
    });
  }, [positionRows]);

  return (
    <div>
      <PageHeader
        title="Perps Terminal"
        subtitle={`Read-only futures data from SoDEX ${envLabel} — no execution until production-ready`}
      />

      <div className="flex flex-wrap gap-3 mb-4">
        <a
          href={`${sodexAppUrl}/portfolio`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 text-xs font-semibold px-3 py-2 rounded-lg border"
          style={{ borderColor: 'var(--glass-border)', color: 'var(--accent)' }}
        >
          Verify on SoDEX <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>

      <div className="card mb-4 text-xs flex items-start gap-2" style={{ borderColor: 'var(--accent-border)', color: 'var(--text-secondary)' }}>
        <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" />
        <span>
          Perps trading execution is disabled in SoSoMind until official documentation confirms production readiness.
          This page shows live margin, funding, positions, and liquidation distance from SoDEX APIs only.
        </span>
      </div>

      {!address ? (
        <div className="card text-center py-12" style={{ color: 'var(--muted)' }}>
          <Wallet size={32} className="mx-auto mb-3 opacity-40" />
          <p className="text-sm font-semibold mb-2">Connect your wallet</p>
          <button
            type="button"
            onClick={() => connect()}
            disabled={isConnecting}
            className="px-5 py-2.5 rounded-xl text-sm font-bold disabled:opacity-60"
            style={{ background: 'var(--accent)', color: '#fff' }}
          >
            {isConnecting ? 'Connecting…' : 'Connect MetaMask'}
          </button>
        </div>
      ) : (
        <>
          <div className="grid-4 mb-4">
            <StatCard
              label="Futures Funded"
              icon={<Shield size={15} />}
              color={perpsFunded ? 'var(--green)' : 'var(--orange)'}
              delay={0}
              value={perpsFunded ? 'Yes' : 'No'}
              sub={perpsFunded ? `${fmt(usdcAvail, 2)} USDC avail` : 'Transfer from Spot on SoDEX'}
            />
            <StatCard
              label="Open Positions"
              icon={<TrendingUp size={15} />}
              color="var(--blue)"
              delay={0.06}
              value={String(positionRows.length)}
              sub={positionRows.length ? 'Live from SoDEX' : 'None'}
            />
            <StatCard
              label="Unrealized PnL"
              icon={<Activity size={15} />}
              color="var(--purple)"
              delay={0.12}
              value="Unavailable"
              sub="SoDEX does not expose aggregate PnL via this API"
            />
            <StatCard
              label="Funding Markets"
              icon={<Activity size={15} />}
              color="var(--green)"
              delay={0.18}
              value={String(fundingRates.length)}
              sub="Mark price feed"
            />
          </div>

          {/* Positions + liquidation */}
          <motion.div className="card mb-4" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold">Open Positions</h3>
              <button type="button" onClick={() => positions.refetch()} className="text-[var(--muted)] p-1">
                <RefreshCw size={13} />
              </button>
            </div>
            {positions.isLoading ? (
              <div className="flex items-center gap-2 text-sm text-[var(--muted)]"><Loader2 size={14} className="animate-spin" /> Loading…</div>
            ) : liquidationRisk.length === 0 ? (
              <p className="text-sm text-[var(--muted)]">No open futures positions.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-[var(--muted)] uppercase tracking-wide">
                      {['Symbol', 'Side', 'Size', 'Entry', 'Mark', 'Liq Price', 'Dist to Liq', 'Margin'].map((h) => (
                        <th key={h} className="text-left py-2 px-2 font-medium">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {liquidationRisk.map((p, i) => (
                      <tr key={i} style={{ borderTop: '1px solid var(--border)' }}>
                        <td className="py-2 px-2 font-semibold">{p.symbol ?? '—'}</td>
                        <td className="py-2 px-2">{p.side ?? p.positionSide ?? '—'}</td>
                        <td className="py-2 px-2 mono text-right">{fmt(p.quantity ?? p.size ?? p.qty)}</td>
                        <td className="py-2 px-2 mono text-right">{fmt(p.entryPrice ?? p.avgEntryPrice)}</td>
                        <td className="py-2 px-2 mono text-right">{fmt(p.mark)}</td>
                        <td className="py-2 px-2 mono text-right">{p.liq > 0 ? fmt(p.liq) : '—'}</td>
                        <td className="py-2 px-2 mono text-right" style={{ color: p.distPct != null && p.distPct < 10 ? '#ef4444' : 'var(--green)' }}>
                          {p.distPct != null ? `${p.distPct.toFixed(1)}%` : 'Unavailable'}
                        </td>
                        <td className="py-2 px-2 mono text-right">{fmt(p.margin)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </motion.div>

          {/* Funding rates */}
          <motion.div className="card" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold">Funding Rates (8h)</h3>
              <button type="button" onClick={() => markPrices.refetch()} className="text-[var(--muted)] p-1">
                <RefreshCw size={13} />
              </button>
            </div>
            {markPrices.isLoading ? (
              <div className="flex items-center gap-2 text-sm text-[var(--muted)]"><Loader2 size={14} className="animate-spin" /> Loading…</div>
            ) : fundingRates.length === 0 ? (
              <p className="text-sm text-[var(--muted)]">No funding data returned from SoDEX mark prices API.</p>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {fundingRates.map((f) => (
                  <div key={f.symbol} className="rounded-lg px-3 py-2" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}>
                    <div className="text-xs font-bold">{f.symbol}</div>
                    <div className="text-[10px] text-[var(--muted)] mt-1">Mark {fmt(f.mark)} · Index {fmt(f.index)}</div>
                    <div className={`text-sm font-mono font-bold mt-1 ${f.rate >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {(f.rate * 100).toFixed(4)}%
                    </div>
                  </div>
                ))}
              </div>
            )}
            <p className="text-[10px] text-[var(--muted)] mt-3 flex items-center gap-1">
              <ExternalLink size={10} /> Live from SoDEX {envLabel} · Read-only
            </p>
          </motion.div>
        </>
      )}
    </div>
  );
}
