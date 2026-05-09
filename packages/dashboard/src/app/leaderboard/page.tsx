"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { fetcher } from "@/lib/api";
import { GlassCard } from "@/components/GlassCard";
import { Trophy, TrendingUp, TrendingDown, Award, Users } from "lucide-react";

const ASSETS = ["BTC", "ETH", "SOL", "AVAX", "BNB"];

export default function LeaderboardPage() {
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<"paper" | "marketplace">("paper");
  const [selectedAsset, setSelectedAsset] = useState("BTC");
  const [paperSide, setPaperSide] = useState<"buy" | "sell">("buy");
  const [paperAmount, setPaperAmount] = useState(100);

  const { data: paperData, isLoading: paperLoading } = useQuery({
    queryKey: ["paper-leaderboard"],
    queryFn: () => fetcher("/api/paper/leaderboard?limit=20"),
    refetchInterval: 30000,
  });

  const { data: marketData, isLoading: marketLoading } = useQuery({
    queryKey: ["marketplace-leaderboard"],
    queryFn: () => fetcher("/api/marketplace/leaderboard?limit=20"),
    refetchInterval: 30000,
  });

  const createPaperTrade = useMutation({
    mutationFn: (body: any) => { const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:10000"; return fetch(`${API}/api/paper/trades`, { method: "POST", body: JSON.stringify(body), headers: { "Content-Type": "application/json" } }).then(r => r.json()); },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["paper-leaderboard"] }),
  });

  const paperEntries: any[] = Array.isArray((paperData as any)?.data) ? (paperData as any).data : [];
  const marketEntries: any[] = Array.isArray((marketData as any)?.data) ? (marketData as any).data : [];

  const medals = ["🥇", "🥈", "🥉"];

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-black text-[var(--text-primary)] mb-1 flex items-center gap-2">
          <Trophy className="w-6 h-6 text-[var(--orange)]" /> Leaderboard
        </h1>
        <p className="text-sm text-[var(--text-muted)]">Paper trading rankings &amp; signal marketplace</p>
      </motion.div>

      {/* Paper Trade Creator */}
      <GlassCard padding="md">
        <h2 className="text-base font-bold text-[var(--text-primary)] mb-4">📄 New Paper Trade</h2>
        <div className="flex flex-wrap gap-3">
          <select
            value={selectedAsset}
            onChange={e => setSelectedAsset(e.target.value)}
            className="px-3 py-2 rounded-xl bg-[var(--surface-2)] text-[var(--text-primary)] text-sm border border-[var(--border)] focus:outline-none"
          >
            {ASSETS.map(a => <option key={a}>{a}</option>)}
          </select>
          <select
            value={paperSide}
            onChange={e => setPaperSide(e.target.value as "buy" | "sell")}
            className="px-3 py-2 rounded-xl bg-[var(--surface-2)] text-[var(--text-primary)] text-sm border border-[var(--border)] focus:outline-none"
          >
            <option value="buy">📈 LONG</option>
            <option value="sell">📉 SHORT</option>
          </select>
          <select
            value={paperAmount}
            onChange={e => setPaperAmount(Number(e.target.value))}
            className="px-3 py-2 rounded-xl bg-[var(--surface-2)] text-[var(--text-primary)] text-sm border border-[var(--border)] focus:outline-none"
          >
            {[100, 250, 500, 1000].map(v => <option key={v} value={v}>${v}</option>)}
          </select>
          <button
            onClick={() => createPaperTrade.mutate({ user_id: "demo_user", symbol: selectedAsset, side: paperSide, amount_usd: paperAmount })}
            disabled={createPaperTrade.isPending}
            className="px-4 py-2 rounded-xl bg-[var(--blue)] text-white text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {createPaperTrade.isPending ? "Creating…" : "Open Trade"}
          </button>
        </div>
        {createPaperTrade.isSuccess && (
          <div className="mt-2 text-xs text-[var(--green)] font-semibold">✅ Paper trade created!</div>
        )}
      </GlassCard>

      {/* Tabs */}
      <div className="flex gap-2 bg-[var(--surface-2)] p-1 rounded-xl w-fit">
        {([["paper", "📄 Paper Trading"], ["marketplace", "📡 Signal Marketplace"]] as const).map(([tab, label]) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${activeTab === tab ? "bg-[var(--surface)] text-[var(--text-primary)] shadow" : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"}`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Paper Trading Leaderboard */}
      {activeTab === "paper" && (
        <div className="space-y-3">
          {paperLoading && <div className="text-center py-8 text-[var(--text-muted)]">Loading leaderboard…</div>}
          {!paperLoading && paperEntries.length === 0 && (
            <GlassCard padding="md">
              <div className="text-center py-8 text-[var(--text-muted)]">
                <Trophy className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="font-semibold">No paper traders yet!</p>
                <p className="text-xs mt-1">Be the first to open a paper trade above</p>
              </div>
            </GlassCard>
          )}
          {paperEntries.map((e: any, i: number) => (
            <motion.div key={e.user_id ?? i} initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}>
              <GlassCard padding="md">
                <div className="flex items-center gap-4">
                  <div className="text-2xl w-8 text-center">{medals[i] ?? `${i + 1}`}</div>
                  <div className="flex-1">
                    <div className="font-bold text-[var(--text-primary)] text-sm">
                      {String(e.user_id ?? "").slice(0, 12)}…
                    </div>
                    <div className="text-xs text-[var(--text-muted)] mt-0.5">
                      {e.total_trades} trades · {(Number(e.win_rate) * 100).toFixed(0)}% win rate
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`text-lg font-black ${Number(e.total_pnl_usd) >= 0 ? "text-[var(--green)]" : "text-[var(--red)]"}`}>
                      {Number(e.total_pnl_usd) >= 0 ? "+" : ""}${Number(e.total_pnl_usd).toFixed(2)}
                    </div>
                    <div className="text-xs text-[var(--text-muted)]">Score: {Number(e.rank_score).toFixed(1)}</div>
                  </div>
                </div>
              </GlassCard>
            </motion.div>
          ))}
        </div>
      )}

      {/* Marketplace Leaderboard */}
      {activeTab === "marketplace" && (
        <div className="space-y-3">
          {marketLoading && <div className="text-center py-8 text-[var(--text-muted)]">Loading marketplace…</div>}
          {!marketLoading && marketEntries.length === 0 && (
            <GlassCard padding="md">
              <div className="text-center py-8 text-[var(--text-muted)]">
                <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="font-semibold">No signal creators yet</p>
              </div>
            </GlassCard>
          )}
          {marketEntries.map((e: any, i: number) => (
            <motion.div key={e.userId ?? i} initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}>
              <GlassCard padding="md">
                <div className="flex items-center gap-4">
                  <div className="text-2xl w-8 text-center">{medals[i] ?? `${i + 1}`}</div>
                  <div className="flex-1">
                    <div className="font-bold text-[var(--text-primary)] text-sm flex items-center gap-2">
                      {String(e.userId ?? "").slice(0, 12)}…
                      {e.is_following && <span className="text-xs px-1.5 py-0.5 rounded-full bg-[var(--blue)]20 text-[var(--blue)]">Following</span>}
                    </div>
                    <div className="text-xs text-[var(--text-muted)] mt-0.5">
                      {e.followers ?? 0} followers · {e.total_published ?? 0} signals · {((e.win_rate_published ?? 0) * 100).toFixed(0)}% WR
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold text-[var(--text-primary)]">{(Number(e.winRate) * 100).toFixed(0)}% WR</div>
                    <div className="text-xs text-[var(--text-muted)]">{e.totalSignals} signals</div>
                  </div>
                </div>
              </GlassCard>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
