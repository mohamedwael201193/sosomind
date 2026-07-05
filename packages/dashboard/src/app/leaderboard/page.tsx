"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { fetcher } from "@/lib/api";
import { LabsPreviewBanner } from "@/components/LabsPreviewBanner";
import { GlassCard } from "@/components/GlassCard";
import { cn } from "@/lib/utils";
import {
  Trophy, Users, TrendingUp, TrendingDown, Plus, XCircle,
  RefreshCw, Star, UserCheck, BarChart2,
} from "lucide-react";
import { useWallet } from "@/context/WalletContext";

import { API_URL as API } from '@/lib/env';

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) return <div className="w-8 h-8 rounded-full flex items-center justify-center bg-yellow-400/20 flex-shrink-0"><Trophy className="w-4 h-4 text-yellow-400" /></div>;
  if (rank === 2) return <div className="w-8 h-8 rounded-full flex items-center justify-center bg-slate-300/20 flex-shrink-0"><Trophy className="w-4 h-4 text-slate-300" /></div>;
  if (rank === 3) return <div className="w-8 h-8 rounded-full flex items-center justify-center bg-amber-600/20 flex-shrink-0"><Trophy className="w-4 h-4 text-amber-600" /></div>;
  return <div className="w-8 h-8 rounded-full flex items-center justify-center bg-white/5 flex-shrink-0 text-sm font-black text-[var(--text-muted)]">#{rank}</div>;
}

export default function LeaderboardPage() {
  const qc = useQueryClient();
  const { address } = useWallet();
  const USER = address ?? "anonymous";
  const [tab, setTab] = useState<"paper" | "market">("paper");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    asset: "BTC", direction: "long", size_usd: 1000, entry_price: 0, tp_price: 0, sl_price: 0,
  });

  const { data: paperData, isLoading: paperLoading } = useQuery({
    queryKey: ["paper-leaderboard"],
    queryFn: () => fetcher<any[]>("/api/paper/leaderboard?limit=20"),
    refetchInterval: 30_000,
  });

  const { data: marketData, isLoading: marketLoading } = useQuery({
    queryKey: ["market-leaderboard"],
    queryFn: () => fetcher<any[]>(`/api/marketplace/leaderboard?limit=20&viewer_id=${USER}`),
    refetchInterval: 60_000,
  });

  const { data: myTradesData } = useQuery({
    queryKey: ["paper-trades", USER],
    queryFn: () => fetcher<any[]>(`/api/paper/trades?user_id=${USER}`),
    refetchInterval: 30_000,
  });

  const paperEntries: any[] = Array.isArray(paperData) ? paperData : [];
  const marketEntries: any[] = Array.isArray(marketData) ? marketData : [];
  const myTrades: any[]     = Array.isArray(myTradesData) ? myTradesData : [];

  const openTrades = myTrades.filter((t) => t.status === "open");
  const closedTrades = myTrades.filter((t) => t.status === "closed");
  const totalPnl = closedTrades.reduce((s, t) => s + Number(t.pnl_usd ?? 0), 0);

  const createTrade = useMutation({
    mutationFn: (body: any) =>
      fetch(`${API}/api/paper/trades`, { method: "POST", body: JSON.stringify({ ...body, user_id: USER }), headers: { "Content-Type": "application/json" } }).then((r) => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["paper-trades", USER] }); qc.invalidateQueries({ queryKey: ["paper-leaderboard"] }); setShowForm(false); },
  });

  const closeTrade = useMutation({
    mutationFn: (id: string) =>
      fetch(`${API}/api/paper/trades/${id}/close`, { method: "POST" }).then((r) => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["paper-trades", USER] }); qc.invalidateQueries({ queryKey: ["paper-leaderboard"] }); },
  });

  const follow = useMutation({
    mutationFn: ({ userId, following }: { userId: string; following: boolean }) =>
      fetch(`${API}/api/marketplace/follow`, { method: "POST", body: JSON.stringify({ follower_id: USER, target_id: userId, follow: !following }), headers: { "Content-Type": "application/json" } }).then((r) => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["market-leaderboard"] }),
  });

  const INPUT = "w-full px-3 py-2 rounded-xl text-sm text-[var(--text-primary)] bg-white/5 border border-white/10 focus:outline-none focus:border-white/20 transition-colors";

  const isLoading = tab === "paper" ? paperLoading : marketLoading;

  return (
    <div className="space-y-5">
      <LabsPreviewBanner feature="Leaderboard" />
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: [0.16,1,0.3,1] }}>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-black text-[var(--text-primary)] mb-1 flex items-center gap-2">
              <Trophy className="w-6 h-6 text-yellow-400" /> Leaderboard
            </h1>
            <p className="text-sm text-[var(--text-muted)]">Paper trading rankings + signal marketplace · compete, learn, copy top traders</p>
          </div>
          <button onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-white text-sm font-semibold hover:opacity-90"
            style={{ background: "var(--blue)" }}>
            {showForm ? <XCircle className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            {showForm ? "Cancel" : "New Paper Trade"}
          </button>
        </div>
      </motion.div>

      {/* My stats */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
        className="grid grid-cols-3 gap-3">
        {[
          { label: "Open Trades",  value: openTrades.length,                  color: "#3b82f6" },
          { label: "Closed Trades", value: closedTrades.length,               color: "#8b5cf6" },
          { label: "My Total PnL", value: `${totalPnl >= 0 ? "+" : ""}$${totalPnl.toFixed(0)}`, color: totalPnl >= 0 ? "#10b981" : "#ef4444" },
        ].map((s) => (
          <GlassCard key={s.label} animate={false} padding="sm">
            <p className="text-xs text-[var(--text-muted)] mb-1">{s.label}</p>
            <p className="text-xl font-black font-mono" style={{ color: s.color }}>{s.value}</p>
          </GlassCard>
        ))}
      </motion.div>

      {/* New Trade form */}
      {showForm && (
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
          <GlassCard animate={false} padding="md">
            <h3 className="text-sm font-bold text-[var(--text-primary)] mb-4">Open Paper Trade</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
              <div>
                <label className="text-xs text-[var(--text-muted)] mb-1 block">Asset</label>
                <select value={form.asset} onChange={(e) => setForm({ ...form, asset: e.target.value })} className={INPUT}>
                  {["BTC","ETH","SOL","BNB","AVAX","LINK","MATIC"].map((a) => <option key={a}>{a}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-[var(--text-muted)] mb-1 block">Direction</label>
                <select value={form.direction} onChange={(e) => setForm({ ...form, direction: e.target.value })} className={INPUT}>
                  <option value="long">Long</option>
                  <option value="short">Short</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-[var(--text-muted)] mb-1 block">Size (USD)</label>
                <input type="number" value={form.size_usd} onChange={(e) => setForm({ ...form, size_usd: Number(e.target.value) })} className={INPUT} />
              </div>
              <div>
                <label className="text-xs text-[var(--text-muted)] mb-1 block">Entry Price</label>
                <input type="number" value={form.entry_price} onChange={(e) => setForm({ ...form, entry_price: Number(e.target.value) })} className={INPUT} />
              </div>
              <div>
                <label className="text-xs text-[var(--text-muted)] mb-1 block">Take-Profit</label>
                <input type="number" value={form.tp_price} onChange={(e) => setForm({ ...form, tp_price: Number(e.target.value) })} className={INPUT} />
              </div>
              <div>
                <label className="text-xs text-[var(--text-muted)] mb-1 block">Stop-Loss</label>
                <input type="number" value={form.sl_price} onChange={(e) => setForm({ ...form, sl_price: Number(e.target.value) })} className={INPUT} />
              </div>
            </div>
            <button onClick={() => createTrade.mutate(form)} disabled={createTrade.isPending}
              className="w-full py-2.5 rounded-xl text-white text-sm font-bold hover:opacity-90 disabled:opacity-50"
              style={{ background: "var(--blue)" }}>
              {createTrade.isPending ? "Opening…" : "Open Paper Trade"}
            </button>
          </GlassCard>
        </motion.div>
      )}

      {/* Open trades */}
      {openTrades.length > 0 && (
        <GlassCard animate={false} padding="md">
          <h3 className="text-sm font-bold text-[var(--text-primary)] mb-3">My Open Trades</h3>
          <div className="space-y-2">
            {openTrades.map((t: any) => (
              <div key={t.id} className="flex items-center justify-between text-sm py-2 border-b border-white/5 last:border-0 gap-3">
                <div className="flex items-center gap-2">
                  <span className={cn("text-xs font-bold px-2 py-0.5 rounded-full", t.direction === "long" ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400")}>
                    {t.direction?.toUpperCase()}
                  </span>
                  <span className="font-bold text-[var(--text-primary)]">{t.asset}</span>
                  <span className="text-xs text-[var(--text-muted)] font-mono">${t.size_usd?.toLocaleString()}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-[var(--text-muted)] font-mono">Entry ${Number(t.entry_price ?? 0).toFixed(2)}</span>
                  <button onClick={() => closeTrade.mutate(t.id)} disabled={closeTrade.isPending}
                    className="px-3 py-1 rounded-lg text-xs font-bold bg-red-500/10 text-red-400 hover:bg-red-500/20 transition">
                    Close
                  </button>
                </div>
              </div>
            ))}
          </div>
        </GlassCard>
      )}

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl bg-white/4 w-fit">
        {(["paper", "market"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={cn("px-4 py-2 rounded-lg text-sm font-semibold transition-all", tab === t ? "text-white" : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]")}
            style={tab === t ? { background: "var(--blue)", boxShadow: "0 0 12px rgba(59,130,246,0.3)" } : {}}>
            {t === "paper" ? "Paper Trading" : "Signal Marketplace"}
          </button>
        ))}
      </div>

      {isLoading && (
        <GlassCard padding="md">
          <div className="flex items-center justify-center gap-3 py-8 text-[var(--text-muted)]">
            <RefreshCw className="w-5 h-5 animate-spin" />
            <span className="text-sm">Loading leaderboard…</span>
          </div>
        </GlassCard>
      )}

      {/* Paper leaderboard */}
      {tab === "paper" && !paperLoading && (
        <div className="space-y-2">
          {paperEntries.length === 0 ? (
            <GlassCard padding="md">
              <div className="text-center py-8 text-[var(--text-muted)]">
                <Trophy className="w-12 h-12 mx-auto mb-3 opacity-20" />
                <p className="font-semibold mb-1">No rankings yet</p>
                <p className="text-xs">Open paper trades to appear on the leaderboard.</p>
              </div>
            </GlassCard>
          ) : paperEntries.map((e: any, i: number) => {
            const pnlColor = Number(e.total_pnl_usd ?? 0) >= 0 ? "#10b981" : "#ef4444";
            const rank = i + 1;
            return (
              <motion.div key={e.user_id ?? i} initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}>
                <GlassCard animate={false} padding="sm" glow={rank === 1 ? "green" : "none"}>
                  <div className="flex items-center gap-3">
                    <RankBadge rank={rank} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-[var(--text-primary)] truncate">{e.user_id}</p>
                      <p className="text-xs text-[var(--text-muted)]">{e.total_trades ?? 0} trades · Win rate {((e.win_rate ?? 0) * 100).toFixed(0)}%</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-base font-black font-mono" style={{ color: pnlColor }}>
                        {Number(e.total_pnl_usd ?? 0) >= 0 ? "+" : ""}${Number(e.total_pnl_usd ?? 0).toFixed(0)}
                      </p>
                      {e.rank_score != null && (
                        <p className="text-xs text-[var(--text-muted)]">Score {Number(e.rank_score).toFixed(1)}</p>
                      )}
                    </div>
                  </div>
                </GlassCard>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Market leaderboard */}
      {tab === "market" && !marketLoading && (
        <div className="space-y-2">
          {marketEntries.length === 0 ? (
            <GlassCard padding="md">
              <div className="text-center py-8 text-[var(--text-muted)]">
                <Users className="w-12 h-12 mx-auto mb-3 opacity-20" />
                <p className="font-semibold mb-1">No signal publishers yet</p>
                <p className="text-xs">Signal marketplace entries will appear here.</p>
              </div>
            </GlassCard>
          ) : marketEntries.map((e: any, i: number) => {
            const rank = i + 1;
            return (
              <motion.div key={e.userId ?? i} initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}>
                <GlassCard animate={false} padding="sm" glow={rank === 1 ? "green" : "none"}>
                  <div className="flex items-center gap-3">
                    <RankBadge rank={rank} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-[var(--text-primary)] truncate">{e.userId}</p>
                      <div className="flex items-center gap-3 text-xs text-[var(--text-muted)]">
                        <span className="flex items-center gap-1"><Users className="w-3 h-3" />{e.followers ?? 0}</span>
                        <span className="flex items-center gap-1"><BarChart2 className="w-3 h-3" />{e.total_published ?? e.totalSignals ?? 0} signals</span>
                        <span>Win {((e.win_rate_published ?? e.winRate ?? 0) * 100).toFixed(0)}%</span>
                      </div>
                    </div>
                    <button onClick={() => follow.mutate({ userId: e.userId, following: e.is_following })}
                      disabled={follow.isPending}
                      className={cn("px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 flex-shrink-0", e.is_following ? "bg-green-500/10 text-green-400 hover:bg-green-500/20" : "bg-white/5 text-[var(--text-secondary)] hover:bg-white/10")}>
                      {e.is_following ? <><UserCheck className="w-3 h-3" />Following</> : <><Star className="w-3 h-3" />Follow</>}
                    </button>
                  </div>
                </GlassCard>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}