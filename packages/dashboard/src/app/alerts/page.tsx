"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { fetcher } from "@/lib/api";
import { LabsPreviewBanner } from "@/components/LabsPreviewBanner";
import { GlassCard } from "@/components/GlassCard";
import { cn } from "@/lib/utils";
import { Bell, BellOff, Plus, Trash2, RefreshCw, TrendingUp, TrendingDown, CheckCircle, XCircle } from "lucide-react";
import { useWallet } from "@/context/WalletContext";
import { CryptoIcon } from "@/components/CryptoIcon";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:10000";

const ALERT_ASSETS = ["BTC", "ETH", "SOL", "BNB", "AVAX", "LINK", "ARB", "OP", "MATIC"];
const TYPE_CONFIG: Record<string, { label: string; color: string; icon: typeof TrendingUp }> = {
  price_above: { label: "Price Above", color: "#10b981", icon: TrendingUp },
  price_below: { label: "Price Below", color: "#ef4444", icon: TrendingDown },
};

type AlertFilter = "all" | "active" | "triggered";

export default function AlertsPage() {
  const qc = useQueryClient();
  const { address } = useWallet();
  const USER = address ?? "anonymous";
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState<AlertFilter>("all");
  const [form, setForm] = useState({
    type: "price_above",
    asset: "BTC",
    condition: "gt",
    threshold: 0,
    message: "",
    user_id: USER,
  });

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["alerts"],
    queryFn: () => fetcher<any[]>("/api/alerts"),
    refetchInterval: 30_000,
  });

  // fetcher already unwraps { data: [...] }
  const allAlerts: any[] = Array.isArray(data) ? data : [];
  const filtered = allAlerts.filter((a) => {
    if (filter === "active") return a.is_active && !a.triggered_at;
    if (filter === "triggered") return !!a.triggered_at;
    return true;
  });
  const activeCount = allAlerts.filter((a) => a.is_active && !a.triggered_at).length;
  const triggeredCount = allAlerts.filter((a) => !!a.triggered_at).length;

  const createAlert = useMutation({
    mutationFn: (body: any) =>
      fetch(`${API}/api/alerts`, { method: "POST", body: JSON.stringify({ ...body, user_id: USER }), headers: { "Content-Type": "application/json" } }).then((r) => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["alerts"] }); setShowForm(false); },
  });

  const deleteAlert = useMutation({
    mutationFn: (id: string) =>
      fetch(`${API}/api/alerts/${id}`, { method: "DELETE" }).then((r) => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["alerts"] }),
  });

  const INPUT = "w-full px-3 py-2 rounded-xl text-sm text-[var(--text-primary)] bg-white/5 border border-white/10 focus:outline-none focus:border-white/20 transition-colors";

  return (
    <div className="space-y-5">
      <LabsPreviewBanner feature="Price Alerts" />
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: [0.16,1,0.3,1] }}>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-black text-[var(--text-primary)] mb-1 flex items-center gap-2">
              <Bell className="w-6 h-6 text-[var(--yellow)]" /> Price Alerts
            </h1>
            <p className="text-sm text-[var(--text-muted)]">Real-time price threshold notifications · BTC, ETH, SOL and more</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => refetch()} disabled={isFetching} className="p-2 rounded-xl bg-white/5 text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-white/8 transition disabled:opacity-50">
              <RefreshCw className={cn("w-4 h-4", isFetching && "animate-spin")} />
            </button>
            <button onClick={() => setShowForm(!showForm)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-white text-sm font-semibold hover:opacity-90"
              style={{ background: "var(--yellow)" }}>
              {showForm ? <XCircle className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
              {showForm ? "Cancel" : "New Alert"}
            </button>
          </div>
        </div>
      </motion.div>

      {/* Stats */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
        className="grid grid-cols-3 gap-3">
        {[
          { label: "Total Alerts",   value: allAlerts.length, color: "#f59e0b" },
          { label: "Active",         value: activeCount,       color: "#10b981" },
          { label: "Triggered",      value: triggeredCount,    color: "#8b5cf6" },
        ].map((s) => (
          <GlassCard key={s.label} animate={false} padding="sm">
            <p className="text-xs text-[var(--text-muted)] mb-1">{s.label}</p>
            <p className="text-2xl font-black font-mono" style={{ color: s.color }}>{s.value}</p>
          </GlassCard>
        ))}
      </motion.div>

      {/* Create form */}
      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
            <GlassCard animate={false} padding="md" glow="none">
              <h3 className="text-sm font-bold text-[var(--text-primary)] mb-4">New Price Alert</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                <div>
                  <label className="text-xs text-[var(--text-muted)] mb-1 block">Asset</label>
                  <select value={form.asset} onChange={(e) => setForm({ ...form, asset: e.target.value })} className={INPUT}>
                    {ALERT_ASSETS.map((a) => <option key={a}>{a}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-[var(--text-muted)] mb-1 block">Type</label>
                  <select value={form.type} onChange={(e) => {
                    const cond = e.target.value === "price_above" ? "gt" : "lt";
                    setForm({ ...form, type: e.target.value, condition: cond });
                  }} className={INPUT}>
                    <option value="price_above">Price Above</option>
                    <option value="price_below">Price Below</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-[var(--text-muted)] mb-1 block">Price Threshold ($)</label>
                  <input type="number" value={form.threshold} onChange={(e) => setForm({ ...form, threshold: Number(e.target.value) })} className={INPUT} placeholder="e.g. 100000" />
                </div>
                <div>
                  <label className="text-xs text-[var(--text-muted)] mb-1 block">Note (optional)</label>
                  <input value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} className={INPUT} placeholder="Reminder note…" />
                </div>
              </div>
              <button onClick={() => createAlert.mutate(form)} disabled={!form.threshold || createAlert.isPending}
                className="w-full py-2.5 rounded-xl text-white text-sm font-bold hover:opacity-90 disabled:opacity-50 transition"
                style={{ background: "var(--yellow)" }}>
                {createAlert.isPending ? "Creating…" : `Create Alert — ${form.asset} ${form.type === "price_above" ? "above" : "below"} $${Number(form.threshold).toLocaleString()}`}
              </button>
            </GlassCard>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Filter tabs */}
      <div className="flex gap-1 p-1 rounded-xl bg-white/4 w-fit">
        {(["all", "active", "triggered"] as AlertFilter[]).map((f) => (
          <button key={f} onClick={() => setFilter(f)}
            className={cn("px-4 py-1.5 rounded-lg text-sm font-semibold capitalize transition-all", filter === f ? "text-white" : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]")}
            style={filter === f ? { background: "var(--yellow)", boxShadow: "0 0 12px rgba(245,158,11,0.3)", color: "#000" } : {}}>
            {f === "all" ? `All (${allAlerts.length})` : f === "active" ? `Active (${activeCount})` : `Triggered (${triggeredCount})`}
          </button>
        ))}
      </div>

      {isLoading && (
        <GlassCard padding="md">
          <div className="flex items-center justify-center gap-3 py-8 text-[var(--text-muted)]">
            <RefreshCw className="w-5 h-5 animate-spin" />
            <span className="text-sm">Loading alerts…</span>
          </div>
        </GlassCard>
      )}

      {!isLoading && filtered.length === 0 && (
        <GlassCard padding="md">
          <div className="text-center py-10 text-[var(--text-muted)]">
            <BellOff className="w-12 h-12 mx-auto mb-3 opacity-20" />
            <p className="font-semibold text-[var(--text-secondary)] mb-2">
              {filter === "all" ? "No alerts yet" : `No ${filter} alerts`}
            </p>
            <p className="text-xs mb-4">
              {filter === "all" ? "Create price alerts to get notified when BTC, ETH or other assets hit your targets." : `No ${filter} alerts at the moment.`}
            </p>
            {filter === "all" && (
              <button onClick={() => setShowForm(true)} className="px-4 py-2 rounded-xl text-black text-sm font-bold" style={{ background: "var(--yellow)" }}>
                Create First Alert
              </button>
            )}
          </div>
        </GlassCard>
      )}

      {/* Alert cards */}
      <div className="space-y-2">
        {filtered.map((a: any, i: number) => {
          const tc = TYPE_CONFIG[a.type] ?? TYPE_CONFIG.price_above;
          const Icon = tc.icon;
          const isTriggered = !!a.triggered_at;
          return (
            <motion.div key={a.id ?? i} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}>
              <GlassCard animate={false} padding="sm" glow={isTriggered ? "green" : "none"}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: tc.color + "15" }}>
                    <Icon className="w-5 h-5" style={{ color: tc.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <span className="font-bold text-sm text-[var(--text-primary)] flex items-center gap-1.5">
                        <CryptoIcon symbol={a.asset ?? ""} size={18} />
                        {a.asset ?? "Asset"}
                      </span>
                      <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ background: tc.color + "15", color: tc.color }}>{tc.label}</span>
                      <span className="text-sm font-black font-mono" style={{ color: tc.color }}>
                        ${Number(a.threshold ?? 0).toLocaleString()}
                      </span>
                      {isTriggered
                        ? <span className="flex items-center gap-1 text-xs font-bold text-purple-400"><CheckCircle className="w-3 h-3" />Triggered</span>
                        : <span className="flex items-center gap-1 text-xs font-bold text-green-400"><Bell className="w-3 h-3" />Watching</span>}
                    </div>
                    {a.message && <p className="text-xs text-[var(--text-muted)] truncate">{a.message}</p>}
                    {isTriggered && a.triggered_at && (
                      <p className="text-xs text-[var(--text-muted)] opacity-60 mt-0.5">Triggered {new Date(a.triggered_at).toLocaleDateString()} {new Date(a.triggered_at).toLocaleTimeString()}</p>
                    )}
                  </div>
                  <button onClick={() => deleteAlert.mutate(a.id)} disabled={deleteAlert.isPending}
                    className="p-2 rounded-lg flex-shrink-0 hover:bg-red-500/10 text-[var(--text-muted)] hover:text-red-400 transition">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </GlassCard>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}