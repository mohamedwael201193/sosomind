"use client";
import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { useWallet } from "@/context/WalletContext";
import { GlassCard } from "@/components/GlassCard";
import { fetcher } from "@/lib/api";
import {
  Wallet, Copy, Check, LogOut, Link, User, Shield,
  Clock, FileText, Download, BarChart2, RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";

export default function ProfilePage() {
  const { address, profile, disconnect, generateLinkCode } = useWallet();
  const [copied, setCopied] = useState(false);
  const [linkCode, setLinkCode] = useState<string | null>(null);
  const [generatingCode, setGeneratingCode] = useState(false);
  const [taxYear, setTaxYear] = useState(new Date().getFullYear() - 1);
  const [taxLoading, setTaxLoading] = useState(false);
  const [taxError, setTaxError] = useState<string | null>(null);

  // ── Real data from SoDEX ───────────────────────────────────────────────
  const balanceQuery = useQuery<any>({
    queryKey: ['profile', 'balance', address],
    enabled: Boolean(address),
    refetchInterval: 30_000,
    queryFn: () => fetcher(`/api/sodex/user/${address}/balances`),
  });

  const tickersQuery = useQuery<any[]>({
    queryKey: ['sodex', 'spot', 'tickers'],
    refetchInterval: 15_000,
    queryFn: () => fetcher('/api/sodex/spot/tickers'),
  });

  const orderHistoryQuery = useQuery<any[]>({
    queryKey: ['profile', 'orders', address],
    enabled: Boolean(address),
    refetchInterval: 30_000,
    queryFn: () => fetcher(`/api/sodex/user/${address}/orders/history?limit=20`),
  });

  const orders: any[] = Array.isArray(orderHistoryQuery.data) ? orderHistoryQuery.data : [];
  const filled = orders.filter(o => o.status === 'FILLED');
  const winRate = orders.length > 0 ? Math.round((filled.length / orders.length) * 100) : null;

  const priceMap = useMemo(() => {
    const map = new Map<string, number>();
    map.set('vUSDC', 1); map.set('USDC', 1);
    for (const t of tickersQuery.data ?? []) {
      const [base] = (t.symbol as string).split('_');
      const price = parseFloat(t.lastPx);
      if (base && !isNaN(price)) map.set(base, price);
    }
    return map;
  }, [tickersQuery.data]);

  const totalUsd = useMemo(() => {
    const raw: any[] = (balanceQuery.data as any)?.balances ?? [];
    return raw.reduce((sum, b) => {
      const total = parseFloat(b.total);
      const locked = parseFloat(b.locked || '0');
      const avail = Math.max(0, total - locked);
      const price = priceMap.get(b.coin) ?? 0;
      return sum + avail * price;
    }, 0);
  }, [balanceQuery.data, priceMap]);

  const usdcBal = useMemo(() => {
    const raw: any[] = (balanceQuery.data as any)?.balances ?? [];
    const b = raw.find(x => x.coin === 'vUSDC');
    return b ? Math.max(0, parseFloat(b.total) - parseFloat(b.locked || '0')) : 0;
  }, [balanceQuery.data]);

  async function copyAddress() {
    if (!address) return;
    await navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleGenerateCode() {
    setGeneratingCode(true);
    try {
      const code = await generateLinkCode();
      setLinkCode(code);
    } catch {
      // ignore
    } finally {
      setGeneratingCode(false);
    }
  }

  async function handleTaxExport(format: "json" | "csv") {
    setTaxLoading(true);
    setTaxError(null);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:10000"}/api/tax/report?user_id=${address}&year=${taxYear}${format === "csv" ? "&format=csv" : ""}`);
      if (!res.ok) throw new Error(`Server error ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `tax_report_${taxYear}.${format}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setTaxError(e instanceof Error ? e.message : "Export failed");
    } finally {
      setTaxLoading(false);
    }
  }

  if (!address) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <div className="w-16 h-16 rounded-full bg-[var(--blue-soft)] flex items-center justify-center mb-4">
          <User className="w-8 h-8 text-[var(--blue)]" />
        </div>
        <h2 className="text-xl font-bold text-[var(--text-primary)] mb-2">Not connected</h2>
        <p className="text-sm text-[var(--text-muted)]">Connect your wallet to view your profile</p>
      </div>
    );
  }

  const displayName = profile?.display_name ?? `${address.slice(0, 6)}...${address.slice(-4)}`;
  const avatarText = (profile?.display_name ?? address).slice(0, 2).toUpperCase();

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      >
        <h1 className="text-2xl font-black text-[var(--text-primary)] mb-1">Profile</h1>
        <p className="text-sm text-[var(--text-muted)]">Manage your account and integrations</p>
      </motion.div>

      {/* Avatar + Identity Card */}
      <GlassCard animate padding="lg">
        <div className="flex items-start gap-5">
          {/* Avatar */}
          <div
            className="w-16 h-16 rounded-[var(--radius-lg)] flex items-center justify-center text-xl font-black text-white flex-shrink-0"
            style={{ background: "linear-gradient(135deg, var(--blue), var(--purple))" }}
          >
            {avatarText}
          </div>

          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-bold text-[var(--text-primary)] mb-1">{displayName}</h2>

            {/* Wallet address */}
            <div className="flex items-center gap-2">
              <span className="text-sm font-mono text-[var(--text-secondary)] truncate">{address}</span>
              <button
                onClick={copyAddress}
                className="flex-shrink-0 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
              >
                {copied ? <Check className="w-4 h-4 text-[var(--green)]" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>

            {profile?.telegram_chat_id && (
              <div className="flex items-center gap-1.5 mt-2 text-xs text-[var(--green)]">
                <Link className="w-3 h-3" />
                Telegram linked
              </div>
            )}
          </div>

          <button
            onClick={disconnect}
            className="flex items-center gap-2 px-3 py-2 rounded-[var(--radius-md)] text-sm text-[var(--red)] border border-[var(--red)]/20 hover:bg-[var(--red-soft)] transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Disconnect
          </button>
        </div>
      </GlassCard>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          {
            icon: Wallet,
            label: "Portfolio Value",
            value: balanceQuery.isLoading ? "…" : totalUsd > 0 ? `$${totalUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "$0.00",
            color: "var(--green)",
          },
          {
            icon: BarChart2,
            label: "Filled Orders",
            value: orderHistoryQuery.isLoading ? "…" : winRate !== null ? `${winRate}% (${filled.length}/${orders.length})` : "—",
            color: "var(--blue)",
          },
          {
            icon: Clock,
            label: "Member Since",
            value: profile?.created_at ? new Date(profile.created_at).toLocaleDateString() : "—",
            color: "var(--purple)",
          },
        ].map((stat) => {
          const Icon = stat.icon;
          return (
            <GlassCard key={stat.label} animate padding="md">
              <div className="w-8 h-8 rounded-[var(--radius-sm)] flex items-center justify-center mb-3" style={{ background: `${stat.color}20`, color: stat.color }}>
                <Icon className="w-4 h-4" />
              </div>
              <div className="text-xl font-black text-[var(--text-primary)]">{stat.value}</div>
              <div className="text-xs text-[var(--text-muted)] mt-0.5">{stat.label}</div>
            </GlassCard>
          );
        })}
      </div>

      {/* Balance summary */}
      {address && (
        <GlassCard animate padding="md">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-[var(--text-primary)]">Wallet Balance</h3>
            <button onClick={() => { balanceQuery.refetch(); tickersQuery.refetch(); }} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
          {balanceQuery.isLoading ? (
            <div className="text-sm text-[var(--text-muted)]">Loading…</div>
          ) : (
            <div className="flex flex-wrap gap-4">
              {((balanceQuery.data as any)?.balances ?? [])
                .filter((b: any) => parseFloat(b.total) > 0)
                .map((b: any) => {
                  const name = b.coin === 'WSOSO' ? 'SOSO' : b.coin.startsWith('v') ? b.coin.slice(1) : b.coin;
                  const avail = Math.max(0, parseFloat(b.total) - parseFloat(b.locked || '0'));
                  const usd = avail * (priceMap.get(b.coin) ?? 0);
                  return (
                    <div key={b.coin} className="flex flex-col">
                      <span className="text-xs text-[var(--text-muted)]">{name}</span>
                      <span className="font-mono font-bold text-[var(--text-primary)]">
                        {avail.toLocaleString('en-US', { maximumFractionDigits: 6 })}
                      </span>
                      {usd > 0 && (
                        <span className="text-xs text-[var(--text-muted)]">
                          ${usd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      )}
                    </div>
                  );
                })}
              {((balanceQuery.data as any)?.balances ?? []).filter((b: any) => parseFloat(b.total) > 0).length === 0 && (
                <div className="text-sm text-[var(--text-muted)]">No balance — get testnet tokens from the SoDEX faucet.</div>
              )}
            </div>
          )}
        </GlassCard>
      )}

      {/* Recent Trades */}
      {address && (
        <GlassCard animate padding="md">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-[var(--text-primary)]">Recent Trades</h3>
            <button onClick={() => orderHistoryQuery.refetch()} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
          {orderHistoryQuery.isLoading ? (
            <div className="text-sm text-[var(--text-muted)]">Loading…</div>
          ) : orders.length === 0 ? (
            <div className="text-sm text-[var(--text-muted)]">No trades yet. Go to Trade to place your first order.</div>
          ) : (
            <div className="overflow-x-auto">
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr>
                    {['Time', 'Market', 'Side', 'Price', 'Qty', 'Status'].map(h => (
                      <th key={h} style={{ textAlign: h === 'Side' || h === 'Time' || h === 'Market' ? 'left' : 'right', padding: '0 8px 8px', color: 'var(--text-muted)', fontSize: 10, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {orders.map((o, i) => {
                    const sym = (o.symbol as string).replace(/_vUSDC$/, '/USDC').replace(/^v/, '');
                    return (
                      <tr key={o.orderID ?? i} style={{ borderTop: '1px solid var(--border)' }}>
                        <td style={{ padding: '8px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                          {new Date(o.createdAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td style={{ padding: '8px', fontWeight: 700 }}>{sym}</td>
                        <td style={{ padding: '8px' }}>
                          <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4, background: o.side === 'BUY' ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)', color: o.side === 'BUY' ? '#10b981' : '#ef4444' }}>
                            {o.side}
                          </span>
                        </td>
                        <td style={{ padding: '8px', textAlign: 'right', fontFamily: 'monospace' }}>{o.price}</td>
                        <td style={{ padding: '8px', textAlign: 'right', fontFamily: 'monospace', color: 'var(--text-muted)' }}>{o.origQty}</td>
                        <td style={{ padding: '8px', textAlign: 'right' }}>
                          <span style={{
                            fontSize: 10, fontWeight: 600, padding: '2px 6px', borderRadius: 4,
                            background: o.status === 'FILLED' ? 'rgba(16,185,129,0.15)' : o.status === 'CANCELED' ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.15)',
                            color: o.status === 'FILLED' ? '#10b981' : o.status === 'CANCELED' ? '#ef4444' : '#f59e0b',
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
        </GlassCard>
      )}

      {/* Telegram Link */}
      <GlassCard animate padding="md">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-[var(--radius-md)] bg-[var(--blue-soft)] flex items-center justify-center flex-shrink-0">
            <Shield className="w-5 h-5 text-[var(--blue)]" />
          </div>
          <div className="flex-1">
            <h3 className="font-bold text-[var(--text-primary)] mb-1">Telegram Notifications</h3>
            <p className="text-sm text-[var(--text-secondary)] mb-4">
              Link your Telegram account to receive real-time signal alerts and portfolio updates.
            </p>

            <AnimatePresence>
              {linkCode ? (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="p-4 rounded-[var(--radius-md)] bg-[var(--blue-soft)] border border-[rgba(59,130,246,0.3)]"
                >
                  <p className="text-sm text-[var(--blue)] mb-2">Send this code to <strong>@SosoMindBot</strong>:</p>
                  <div className="flex items-center gap-2">
                    <code className="text-lg font-mono font-bold text-[var(--text-primary)] tracking-widest">{linkCode}</code>
                    <button
                      onClick={() => { navigator.clipboard.writeText(linkCode); }}
                      className="text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                  </div>
                  <p className="text-xs text-[var(--text-muted)] mt-2">This code expires in 10 minutes.</p>
                </motion.div>
              ) : (
                <button
                  onClick={handleGenerateCode}
                  disabled={generatingCode || !!profile?.telegram_chat_id}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-[var(--radius-md)] text-sm font-bold transition-all",
                    profile?.telegram_chat_id
                      ? "bg-[var(--green-soft)] text-[var(--green)] cursor-default"
                      : "text-white disabled:opacity-60"
                  )}
                  style={!profile?.telegram_chat_id ? { background: "var(--grad-brand)" } : {}}
                >
                  {profile?.telegram_chat_id ? (
                    <><Check className="w-4 h-4" /> Telegram Linked</>
                  ) : (
                    <><Link className="w-4 h-4" /> {generatingCode ? "Generating..." : "Generate Link Code"}</>
                  )}
                </button>
              )}
            </AnimatePresence>
          </div>
        </div>
      </GlassCard>

      {/* Tax Report */}
      <GlassCard animate padding="md">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-[var(--radius-md)] bg-[var(--orange)]20 flex items-center justify-center flex-shrink-0">
            <FileText className="w-5 h-5 text-[var(--orange)]" />
          </div>
          <div className="flex-1">
            <h3 className="font-bold text-[var(--text-primary)] mb-1">Tax Report</h3>
            <p className="text-sm text-[var(--text-secondary)] mb-4">
              Export your capital gains report for any tax year. Short-term and long-term gains included.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <select
                value={taxYear}
                onChange={e => setTaxYear(Number(e.target.value))}
                className="px-3 py-2 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text-primary)] text-sm focus:outline-none"
              >
                {[2025, 2024, 2023, 2022].map(y => <option key={y}>{y}</option>)}
              </select>
              <button
                onClick={() => handleTaxExport("csv")}
                disabled={taxLoading}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--green)] text-white text-sm font-semibold hover:opacity-90 disabled:opacity-50"
              >
                <Download className="w-4 h-4" /> {taxLoading ? "Exporting…" : "Export CSV"}
              </button>
              <button
                onClick={() => handleTaxExport("json")}
                disabled={taxLoading}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--surface-2)] text-[var(--text-primary)] text-sm font-semibold hover:opacity-80 disabled:opacity-50 border border-[var(--border)]"
              >
                <Download className="w-4 h-4" /> Export JSON
              </button>
            </div>
            {taxError && <div className="mt-2 text-xs text-[var(--red)]">{taxError}</div>}
          </div>
        </div>
      </GlassCard>
    </div>
  );
}
