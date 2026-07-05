'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetcher } from '@/lib/api';
import { motion } from 'framer-motion';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
} from 'recharts';
import { Wallet, ShieldCheck, BarChart2, RefreshCw, Loader2, ExternalLink } from 'lucide-react';
import { StatCard } from '@/components/AnimatedNumber';
import { PageHeader } from '@/components/LoadingSkeleton';
import { useWallet } from '@/context/WalletContext';
import { useEnvironment } from '@/context/EnvironmentContext';
import { CryptoIcon } from '@/components/CryptoIcon';

const CHART_COLORS = ['#10b981','#3b82f6','#8b5cf6','#f59e0b','#ef4444','#06b6d4','#84cc16'];

const STABLE_COINS = new Set(['USDC', 'VUSDC', 'USDT', 'VUSDT']);

function dc(coin: string): string {
  if (!coin) return '';
  if (coin === 'WSOSO') return 'SOSO';
  return coin.startsWith('v') ? coin.slice(1) : coin;
}

function isStable(coin: string): boolean {
  return STABLE_COINS.has(coin.toUpperCase()) || coin.toUpperCase().startsWith('VUSDC');
}

function fmt(n: number, dec = 2) {
  return n.toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

function normalizeList(raw: unknown): any[] {
  if (Array.isArray(raw)) return raw;
  if (raw && typeof raw === 'object') {
    for (const k of ['balances', 'orders', 'trades', 'data', 'list']) {
      const v = (raw as Record<string, unknown>)[k];
      if (Array.isArray(v)) return v;
    }
  }
  return [];
}

function coinPrecision(coin: string, symbols: any[]): number {
  const sym = symbols.find((s) => s.baseCoin === coin || s.baseCoin === `v${coin}` || dc(s.baseCoin ?? '') === dc(coin));
  return sym?.quantityPrecision ?? (isStable(coin) ? 4 : 6);
}

export default function PortfolioPage() {
  const { address, connect, isConnecting } = useWallet();
  const { selector, config } = useEnvironment();
  const sodexAppUrl = config?.active?.sodexAppUrl ?? (selector === 'testnet' ? 'https://testnet.sodex.com' : 'https://sodex.com');
  const envLabel = config?.active?.label ?? (selector === 'testnet' ? 'Testnet' : 'Mainnet');
  const faucetAvailable = config?.active?.faucetAvailable ?? selector === 'testnet';

  const balanceQuery = useQuery<any>({
    queryKey: ['sodex', selector, 'user-balance', address],
    enabled: Boolean(address),
    refetchInterval: 15_000,
    queryFn: () => fetcher(`/api/sodex/user/${address}/balances`),
  });

  const tickers = useQuery<any[]>({
    queryKey: ['sodex', selector, 'spot', 'tickers'],
    refetchInterval: 10_000,
    queryFn: () => fetcher('/api/sodex/spot/tickers'),
  });

  const orderHistory = useQuery<any>({
    queryKey: ['sodex', selector, 'user-orders-history', address],
    enabled: Boolean(address),
    refetchInterval: 15_000,
    queryFn: () => fetcher(`/api/sodex/user/${address}/orders/history?limit=50`),
  });

  const openOrders = useQuery<any>({
    queryKey: ['sodex', selector, 'user-orders-open', address],
    enabled: Boolean(address),
    refetchInterval: 12_000,
    queryFn: () => fetcher(`/api/sodex/user/${address}/orders`),
  });

  const fills = useQuery<any>({
    queryKey: ['sodex', selector, 'user-trades', address],
    enabled: Boolean(address),
    refetchInterval: 15_000,
    queryFn: () => fetcher(`/api/sodex/user/${address}/trades?limit=50`),
  });

  const symbols = useQuery<any[]>({
    queryKey: ['sodex', selector, 'spot', 'symbols'],
    staleTime: 60_000,
    queryFn: () => fetcher('/api/sodex/spot/symbols'),
  });

  const priceMap = useMemo(() => {
    const map = new Map<string, number>();
    map.set('vUSDC', 1); map.set('USDC', 1); map.set('vUSDT', 1); map.set('USDT', 1);
    for (const t of tickers.data ?? []) {
      const sym = String(t.symbol ?? '');
      const [base] = sym.split('_');
      const price = parseFloat(t.lastPx);
      if (base && !Number.isNaN(price)) {
        map.set(base, price);
        map.set(dc(base), price);
        if (base === 'WSOSO' || base === 'SOSO') {
          map.set('WSOSO', price);
          map.set('SOSO', price);
        }
      }
    }
    return map;
  }, [tickers.data]);

  const symbolList = symbols.data ?? [];

  const balances = useMemo(() => {
    const raw = normalizeList(balanceQuery.data);
    return raw.map((b) => {
      const total = parseFloat(b.total ?? b.balance ?? '0');
      const locked = parseFloat(b.locked ?? b.frozen ?? '0');
      const avail = parseFloat(b.available ?? b.free ?? String(Math.max(0, total - locked)));
      const coin = String(b.coin ?? b.asset ?? '');
      const price = priceMap.get(coin) ?? priceMap.get(dc(coin)) ?? 0;
      const dec = coinPrecision(coin, symbolList);
      return { ...b, coin, avail, totalNum: total, lockedNum: locked, usdValue: avail * price, price, dec };
    }).filter((b) => b.totalNum > 0);
  }, [balanceQuery.data, priceMap, symbolList]);

  const totalUsd = useMemo(() => balances.reduce((s, b) => s + b.usdValue, 0), [balances]);
  const usdcBal = useMemo(() => {
    const row = balances.find((b) => isStable(b.coin));
    return row?.avail ?? 0;
  }, [balances]);
  const nonStable = useMemo(() => balances.filter((b) => !isStable(b.coin)), [balances]);

  const allocList = useMemo(() =>
    balances.map((b, i) => ({
      name: dc(b.coin),
      value: b.usdValue,
      pct: totalUsd > 0 ? (b.usdValue / totalUsd) * 100 : 0,
      color: CHART_COLORS[i % CHART_COLORS.length],
    })).filter((a) => a.value > 0),
  [balances, totalUsd]);

  const orders = normalizeList(orderHistory.data);
  const openOrderRows = normalizeList(openOrders.data);
  const fillRows = normalizeList(fills.data);
  const filledOrders = orders.filter((o) => o.status === 'FILLED' || o.status === 'PARTIAL_FILL');

  return (
    <div>
      <PageHeader
        title="Portfolio Terminal"
        subtitle={`Live Spot balances, orders, and fills from SoDEX ${envLabel}`}
      />

      {address && (
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
      )}

      {address && usdcBal > 0 && nonStable.length === 0 && (
        <div className="card mb-4 text-sm" style={{ borderColor: 'var(--accent-border)', color: 'var(--text-secondary)' }}>
          You have USDC in Spot. Place a trade from{' '}
          <a href="/trade" className="font-semibold" style={{ color: 'var(--accent)' }}>Trade</a> to complete the proof loop.
        </div>
      )}

      {!address ? (
        <div className="card" style={{ textAlign: 'center', padding: '48px 24px', color: 'var(--muted)' }}>
          <Wallet size={32} style={{ margin: '0 auto 12px', opacity: 0.4 }} />
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>Connect your wallet</div>
          <div style={{ fontSize: 13, marginBottom: 16 }}>Connect a wallet to see your real SoDEX balances and order history.</div>
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
          <div className="grid-4" style={{ marginBottom: 18 }}>
            <StatCard
              label="Total Assets (Spot)" icon={<Wallet size={15} />} color="var(--green)" delay={0}
              value={balanceQuery.isLoading ? '…' : totalUsd > 0 ? `$${fmt(totalUsd, 2)}` : '$0.00'}
            />
            <StatCard
              label="USDC Available" icon={<ShieldCheck size={15} />} color="var(--blue)" delay={0.06}
              value={balanceQuery.isLoading ? '…' : `$${fmt(usdcBal, 4)}`}
              sub="Spot cash"
            />
            <StatCard
              label="Total PnL" icon={<BarChart2 size={15} />} color="var(--purple)" delay={0.12}
              value="Unavailable"
              sub="Not exposed by SoDEX Spot API"
            />
            <StatCard
              label="Filled Orders" icon={<BarChart2 size={15} />} color="var(--green)" delay={0.18}
              value={String(filledOrders.length)}
              sub={`${orders.length} history · ${fillRows.length} fills`}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16, marginBottom: 18 }}>
            <motion.div className="card" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <h3 style={{ fontSize: 14, fontWeight: 700 }}>Spot Balances</h3>
                <button
                  type="button"
                  onClick={() => { balanceQuery.refetch(); tickers.refetch(); }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: 4 }}
                >
                  <RefreshCw size={13} />
                </button>
              </div>

              {balanceQuery.isLoading ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--muted)', fontSize: 13 }}>
                  <Loader2 size={14} className="animate-spin" /> Loading balances…
                </div>
              ) : balances.length === 0 ? (
                <div style={{ color: 'var(--muted)', fontSize: 13, padding: '24px 0' }}>
                  {faucetAvailable
                    ? 'No balance found. Get testnet tokens from the SoDEX faucet.'
                    : 'No balance found. Deposit on SoDEX to fund your Spot account.'}
                </div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr>
                      {['Asset', 'Total', 'Available', 'Locked', 'Price', 'USD Value'].map((h) => (
                        <th key={h} style={{ textAlign: h === 'Asset' ? 'left' : 'right', padding: '0 8px 8px', color: 'var(--muted)', fontSize: 11, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {balances.map((b, i) => (
                      <motion.tr
                        key={b.coin}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.25 + i * 0.05 }}
                        style={{ borderTop: '1px solid var(--border)' }}
                      >
                        <td style={{ padding: '10px 8px', fontWeight: 700 }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <CryptoIcon symbol={b.coin} size={20} />
                            {dc(b.coin)}
                          </span>
                        </td>
                        <td className="mono" style={{ textAlign: 'right', padding: '10px 8px' }}>{fmt(b.totalNum, b.dec)}</td>
                        <td className="mono" style={{ textAlign: 'right', padding: '10px 8px', color: 'var(--green)' }}>{fmt(b.avail, b.dec)}</td>
                        <td className="mono" style={{ textAlign: 'right', padding: '10px 8px', color: b.lockedNum > 0 ? 'var(--orange, #f59e0b)' : 'var(--muted)' }}>
                          {b.lockedNum > 0 ? fmt(b.lockedNum, b.dec) : '—'}
                        </td>
                        <td className="mono" style={{ textAlign: 'right', padding: '10px 8px', color: 'var(--muted)' }}>
                          {b.price > 0 ? `$${fmt(b.price, isStable(b.coin) ? 4 : 6)}` : '—'}
                        </td>
                        <td className="mono" style={{ textAlign: 'right', padding: '10px 8px', fontWeight: 600 }}>
                          {b.usdValue > 0 ? `$${fmt(b.usdValue, 2)}` : '—'}
                        </td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              )}
            </motion.div>

            <motion.div className="card" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 14 }}>Allocation</h3>
              {allocList.length === 0 ? (
                <div style={{ textAlign: 'center', color: 'var(--muted)', fontSize: 12, paddingTop: 40 }}>No holdings yet</div>
              ) : (
                <>
                  <ResponsiveContainer width="100%" height={150}>
                    <PieChart>
                      <Pie data={allocList} dataKey="value" nameKey="name" outerRadius={60} innerRadius={35}>
                        {allocList.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                      </Pie>
                      <Tooltip
                        formatter={(v: any, name: any) => [`$${fmt(Number(v), 2)}`, name]}
                        contentStyle={{ background: 'var(--bg-elev)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 11 }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {allocList.map((a, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                          <span style={{ width: 8, height: 8, borderRadius: 2, background: a.color, display: 'inline-block' }} />
                          {a.name}
                        </span>
                        <span className="mono" style={{ color: 'var(--muted2)' }}>{a.pct.toFixed(1)}%</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </motion.div>
          </div>

          {/* Open orders */}
          {openOrderRows.length > 0 && (
            <motion.div className="card mb-4" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 14 }}>Open Orders ({openOrderRows.length})</h3>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 520 }}>
                  <thead>
                    <tr>
                      {['Market', 'Side', 'Price', 'Qty', 'Filled', 'Status'].map((h) => (
                        <th key={h} style={{ textAlign: 'left', padding: '0 8px 8px', color: 'var(--muted)', fontSize: 11, fontWeight: 500, textTransform: 'uppercase' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {openOrderRows.map((o, i) => {
                      const sym = symbolList.find((s: any) => s.name === o.symbol);
                      const disp = sym?.displayName ?? String(o.symbol ?? '').replace(/_vUSDC$/, '/USDC').replace(/_USDC$/, '/USDC').replace(/^v/, '');
                      return (
                        <tr key={o.orderID ?? i} style={{ borderTop: '1px solid var(--border)' }}>
                          <td style={{ fontWeight: 600, padding: '9px 8px' }}>{disp}</td>
                          <td style={{ padding: '9px 8px' }}>{o.side}</td>
                          <td className="mono" style={{ padding: '9px 8px' }}>{o.price}</td>
                          <td className="mono" style={{ padding: '9px 8px' }}>{o.origQty}</td>
                          <td className="mono" style={{ padding: '9px 8px' }}>{o.executedQty || '0'}</td>
                          <td style={{ padding: '9px 8px' }}>{o.status}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </motion.div>
          )}

          {/* Order history */}
          <motion.div className="card mb-4" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <h3 style={{ fontSize: 14, fontWeight: 700 }}>Order History</h3>
              <button type="button" onClick={() => orderHistory.refetch()} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: 4 }}>
                <RefreshCw size={13} />
              </button>
            </div>

            {orderHistory.isLoading ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--muted)', fontSize: 13 }}>
                <Loader2 size={14} className="animate-spin" /> Loading orders…
              </div>
            ) : orders.length === 0 ? (
              <div style={{ color: 'var(--muted)', fontSize: 13, padding: '24px 0', textAlign: 'center' }}>
                No orders yet — make a trade to see your history here.
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 580 }}>
                  <thead>
                    <tr>
                      {['Time', 'Market', 'Side', 'Type', 'Price', 'Amount', 'Filled', 'Fee', 'Status'].map((h) => (
                        <th key={h} style={{ textAlign: h === 'Side' || h === 'Time' || h === 'Market' || h === 'Type' ? 'left' : 'right', padding: '0 8px 8px', color: 'var(--muted)', fontSize: 11, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map((o, i) => {
                      const sym = symbolList.find((s: any) => s.name === o.symbol);
                      const disp = sym?.displayName ?? String(o.symbol ?? '').replace(/_vUSDC$/, '/USDC').replace(/_USDC$/, '/USDC').replace(/^v/, '');
                      return (
                        <tr key={o.orderID ?? i} style={{ borderTop: '1px solid var(--border)' }}>
                          <td style={{ padding: '9px 8px', color: 'var(--muted)', fontSize: 11, whiteSpace: 'nowrap' }}>
                            {new Date(o.createdAt ?? o.time ?? o.updatedAt).toLocaleString()}
                          </td>
                          <td style={{ fontWeight: 600, padding: '9px 8px' }}>{disp}</td>
                          <td style={{ padding: '9px 8px' }}>
                            <span className={`badge ${o.side === 'BUY' ? 'badge-long' : 'badge-short'}`} style={{ padding: '2px 8px', fontSize: 10 }}>
                              {o.side}
                            </span>
                          </td>
                          <td style={{ padding: '9px 8px', color: 'var(--muted)', fontSize: 11 }}>{o.type}</td>
                          <td className="mono" style={{ textAlign: 'right', padding: '9px 8px' }}>{o.price}</td>
                          <td className="mono" style={{ textAlign: 'right', padding: '9px 8px' }}>{o.origQty}</td>
                          <td className="mono" style={{ textAlign: 'right', padding: '9px 8px', color: 'var(--muted)' }}>{o.executedQty || '0'}</td>
                          <td className="mono" style={{ textAlign: 'right', padding: '9px 8px', color: 'var(--muted)' }}>{o.fee ?? o.commission ?? '—'}</td>
                          <td style={{ textAlign: 'right', padding: '9px 8px' }}>
                            <span style={{
                              fontSize: 10, fontWeight: 600, padding: '2px 6px', borderRadius: 4,
                              background: o.status === 'FILLED' ? 'rgba(16,185,129,0.15)' : o.status === 'CANCELED' ? 'rgba(239,68,68,0.15)' : o.status === 'PARTIAL_FILL' ? 'rgba(59,130,246,0.15)' : 'rgba(245,158,11,0.15)',
                              color: o.status === 'FILLED' ? '#10b981' : o.status === 'CANCELED' ? '#ef4444' : o.status === 'PARTIAL_FILL' ? '#3b82f6' : '#f59e0b',
                            }}>
                              {o.status}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </motion.div>

          {/* Fills / trades */}
          <motion.div className="card" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <h3 style={{ fontSize: 14, fontWeight: 700 }}>Trade History (Fills)</h3>
              <button type="button" onClick={() => fills.refetch()} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: 4 }}>
                <RefreshCw size={13} />
              </button>
            </div>

            {fills.isLoading ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--muted)', fontSize: 13 }}>
                <Loader2 size={14} className="animate-spin" /> Loading fills…
              </div>
            ) : fillRows.length === 0 ? (
              <div style={{ color: 'var(--muted)', fontSize: 13, padding: '24px 0', textAlign: 'center' }}>
                No fills yet.
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 520 }}>
                  <thead>
                    <tr>
                      {['Time', 'Market', 'Side', 'Price', 'Qty', 'Fee', 'Role'].map((h) => (
                        <th key={h} style={{ textAlign: h === 'Time' || h === 'Market' || h === 'Side' ? 'left' : 'right', padding: '0 8px 8px', color: 'var(--muted)', fontSize: 11, fontWeight: 500, textTransform: 'uppercase' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {fillRows.map((t, i) => {
                      const sym = symbolList.find((s: any) => s.name === t.symbol);
                      const disp = sym?.displayName ?? String(t.symbol ?? '').replace(/_USDC$/, '/USDC').replace(/^v/, '');
                      return (
                        <tr key={t.tradeID ?? t.id ?? i} style={{ borderTop: '1px solid var(--border)' }}>
                          <td style={{ padding: '9px 8px', color: 'var(--muted)', fontSize: 11, whiteSpace: 'nowrap' }}>
                            {new Date(t.time ?? t.createdAt ?? t.timestamp).toLocaleString()}
                          </td>
                          <td style={{ fontWeight: 600, padding: '9px 8px' }}>{disp}</td>
                          <td style={{ padding: '9px 8px' }}>{t.side}</td>
                          <td className="mono" style={{ textAlign: 'right', padding: '9px 8px' }}>{t.price}</td>
                          <td className="mono" style={{ textAlign: 'right', padding: '9px 8px' }}>{t.qty ?? t.quantity}</td>
                          <td className="mono" style={{ textAlign: 'right', padding: '9px 8px', color: 'var(--muted)' }}>{t.fee ?? t.commission ?? '—'}</td>
                          <td style={{ textAlign: 'right', padding: '9px 8px', color: 'var(--muted)', fontSize: 11 }}>{t.role ?? t.liquidity ?? '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            <div style={{ marginTop: 8, fontSize: 10, color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
              <ExternalLink size={11} />
              Live from SoDEX {envLabel} · {address?.slice(0, 10)}…
            </div>
          </motion.div>
        </>
      )}
    </div>
  );
}
