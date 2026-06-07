"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { fetcher } from "@/lib/api";
import { LabsPreviewBanner } from "@/components/LabsPreviewBanner";
import { GlassCard } from "@/components/GlassCard";
import { cn } from "@/lib/utils";
import {
  BookOpen, Plus, Trash2, Play, CheckCircle, XCircle,
  TrendingUp, TrendingDown, Zap, RefreshCw, ChevronDown, ChevronUp,
} from "lucide-react";
import { useWallet } from "@/context/WalletContext";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:10000";
const PRESET_EVENTS = ["CPI", "FOMC", "NFP", "ETF_INFLOW", "ETF_OUTFLOW", "GDP", "PCE", "PPI"];

const EVENT_COLOR: Record<string, string> = {
  CPI: "#ef4444", FOMC: "#8b5cf6", NFP: "#3b82f6", ETF_INFLOW: "#10b981",
  ETF_OUTFLOW: "#f97316", GDP: "#06b6d4", PCE: "#ec4899", PPI: "#f59e0b",
};

export default function PlaybookPage() {
  const qc = useQueryClient();
  const { address } = useWallet();
  const USER = address ?? "anonymous";
  const [showForm, setShowForm] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [form, setForm] = useState({
    user_id: USER,
    name: "",
    trigger_event: "CPI",
    trigger_condition: "above" as const,
    trigger_value: 3.5,
    action_asset: "BTC",
    action_direction: "long" as const,
    action_size_pct: 5,
    action_sl_pct: 3,
    action_tp_pct: 10,
    active: true,
    auto_execute: false,
  });

  const { data, isLoading } = useQuery({
    queryKey: ["playbook", USER],
    queryFn: () => fetcher<any[]>(`/api/playbook?user_id=${USER}`),
    refetchInterval: 60_000,
  });

  const { data: checkData, refetch: runCheck, isFetching: isChecking } = useQuery({
    queryKey: ["playbook-check", USER],
    queryFn: () => fetcher<any[]>(`/api/playbook/check?user_id=${USER}`),
    enabled: false,
  });

  // fetcher already unwraps
  const strategies: any[] = Array.isArray(data) ? data : [];
  const checkResults: any[] = Array.isArray(checkData) ? checkData : [];
  const activeCount = strategies.filter((s) => s.active).length;
  const triggeredCount = checkResults.filter((r) => r.triggered).length;

  const create = useMutation({
    mutationFn: (body: any) =>
      fetch(`${API}/api/playbook`, { method: "POST", body: JSON.stringify({ ...body, user_id: USER }), headers: { "Content-Type": "application/json" } }).then((r) => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["playbook", USER] }); setShowForm(false); },
  });

  const remove = useMutation({
    mutationFn: (id: string) =>
      fetch(`${API}/api/playbook/${id}`, { method: "DELETE" }).then((r) => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["playbook", USER] }),
  });

  const INPUT = "w-full px-3 py-2 rounded-xl text-sm text-[var(--text-primary)] bg-white/5 border border-white/10 focus:outline-none focus:border-white/20 transition-colors";

  return (
    <div className="space-y-5">
      <LabsPreviewBanner feature="Macro Playbook" />
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: [0.16,1,0.3,1] }}>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-black text-[var(--text-primary)] mb-1 flex items-center gap-2">
              <BookOpen className="w-6 h-6 text-[var(--orange)]" /> Macro Playbook
            </h1>
            <p className="text-sm text-[var(--text-muted)]">Automated strategies triggered by macro events — CPI, FOMC, NFP, ETF flows</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => runCheck()} disabled={isChecking}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-white text-sm font-semibold hover:opacity-90 disabled:opacity-50"
              style={{ background: "var(--orange)" }}>
              <Play className={cn("w-4 h-4", isChecking && "animate-spin")} /> Check Triggers
            </button>
            <button onClick={() => setShowForm(!showForm)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-white text-sm font-semibold hover:opacity-90"
              style={{ background: "var(--blue)" }}>
              {showForm ? <XCircle className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
              {showForm ? "Cancel" : "New Strategy"}
            </button>
          </div>
        </div>
      </motion.div>

      {/* Stats */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
        className="grid grid-cols-3 gap-3">
        {[
          { label: "Total Strategies", value: strategies.length, color: "#8b5cf6" },
          { label: "Active",            value: activeCount,        color: "#10b981" },
          { label: "Triggered Now",     value: triggeredCount,     color: "#f59e0b" },
        ].map((s) => (
          <GlassCard key={s.label} animate={false} padding="sm">
            <p className="text-xs text-[var(--text-muted)] mb-1">{s.label}</p>
            <p className="text-2xl font-black font-mono" style={{ color: s.color }}>{s.value}</p>
          </GlassCard>
        ))}
      </motion.div>

      {/* Trigger results */}
      <AnimatePresence>
        {checkResults.length > 0 && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>
            <GlassCard animate={false} padding="md" glow={triggeredCount > 0 ? "green" : "none"}>
              <h3 className="text-sm font-bold text-[var(--text-primary)] mb-3 flex items-center gap-2">
                <Zap className="w-4 h-4 text-[var(--orange)]" /> Trigger Check Results
              </h3>
              <div className="space-y-2">
                {checkResults.map((r: any, i: number) => (
                  <div key={i} className="flex items-center justify-between text-sm py-2 border-b border-white/5 last:border-0">
                    <span className="font-semibold text-[var(--text-primary)]">{r.name ?? r.strategy_name}</span>
                    <div className="flex items-center gap-2">
                      {r.triggered
                        ? <><CheckCircle className="w-4 h-4 text-[var(--green)]" /><span className="text-xs font-bold text-[var(--green)]">TRIGGERED</span></>
                        : <><XCircle className="w-4 h-4 text-[var(--text-muted)]" /><span className="text-xs text-[var(--text-muted)]">Not triggered</span></>}
                      {r.current_value != null && (
                        <span className="text-xs text-[var(--text-muted)] font-mono">({r.current_value})</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </GlassCard>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Create form */}
      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
            <GlassCard animate={false} padding="md">
              <h3 className="text-sm font-bold text-[var(--text-primary)] mb-4">New Strategy</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="text-xs text-[var(--text-muted)] mb-1 block">Strategy Name</label>
                  <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. CPI Spike Long BTC" className={INPUT} />
                </div>
                <div>
                  <label className="text-xs text-[var(--text-muted)] mb-1 block">Trigger Event</label>
                  <select value={form.trigger_event} onChange={(e) => setForm({ ...form, trigger_event: e.target.value })} className={INPUT}>
                    {PRESET_EVENTS.map((e) => <option key={e}>{e}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-[var(--text-muted)] mb-1 block">Condition</label>
                  <select value={form.trigger_condition} onChange={(e) => setForm({ ...form, trigger_condition: e.target.value as any })} className={INPUT}>
                    <option value="above">above</option>
                    <option value="below">below</option>
                    <option value="increases">increases</option>
                    <option value="decreases">decreases</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-[var(--text-muted)] mb-1 block">Trigger Value</label>
                  <input type="number" value={form.trigger_value} onChange={(e) => setForm({ ...form, trigger_value: Number(e.target.value) })} className={INPUT} />
                </div>
                <div>
                  <label className="text-xs text-[var(--text-muted)] mb-1 block">Asset</label>
                  <select value={form.action_asset} onChange={(e) => setForm({ ...form, action_asset: e.target.value })} className={INPUT}>
                    {["BTC","ETH","SOL","BNB","AVAX"].map((a) => <option key={a}>{a}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-[var(--text-muted)] mb-1 block">Direction</label>
                  <select value={form.action_direction} onChange={(e) => setForm({ ...form, action_direction: e.target.value as any })} className={INPUT}>
                    <option value="long">Long</option>
                    <option value="short">Short</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-[var(--text-muted)] mb-1 block">Size % of Portfolio</label>
                  <input type="number" value={form.action_size_pct} onChange={(e) => setForm({ ...form, action_size_pct: Number(e.target.value) })} className={INPUT} />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-[var(--text-muted)] mb-1 block">Stop-Loss %</label>
                    <input type="number" value={form.action_sl_pct} onChange={(e) => setForm({ ...form, action_sl_pct: Number(e.target.value) })} className={INPUT} />
                  </div>
                  <div>
                    <label className="text-xs text-[var(--text-muted)] mb-1 block">Take-Profit %</label>
                    <input type="number" value={form.action_tp_pct} onChange={(e) => setForm({ ...form, action_tp_pct: Number(e.target.value) })} className={INPUT} />
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-4 mb-4">
                <label className="flex items-center gap-2 text-sm text-[var(--text-secondary)] cursor-pointer">
                  <input type="checkbox" checked={form.auto_execute} onChange={(e) => setForm({ ...form, auto_execute: e.target.checked })} className="accent-[var(--blue)]" />
                  Auto-execute on trigger
                </label>
                <label className="flex items-center gap-2 text-sm text-[var(--text-secondary)] cursor-pointer">
                  <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} className="accent-[var(--green)]" />
                  Active
                </label>
              </div>
              <button onClick={() => create.mutate(form)} disabled={!form.name || create.isPending}
                className="w-full py-2.5 rounded-xl text-white text-sm font-bold hover:opacity-90 disabled:opacity-50 transition"
                style={{ background: "var(--blue)" }}>
                {create.isPending ? "Creating…" : "Create Strategy"}
              </button>
            </GlassCard>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Loading */}
      {isLoading && (
        <GlassCard padding="md">
          <div className="flex items-center justify-center gap-3 py-8 text-[var(--text-muted)]">
            <RefreshCw className="w-5 h-5 animate-spin" />
            <span className="text-sm">Loading playbook strategies…</span>
          </div>
        </GlassCard>
      )}

      {/* Empty */}
      {!isLoading && strategies.length === 0 && (
        <GlassCard padding="md">
          <div className="text-center py-10 text-[var(--text-muted)]">
            <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-20" />
            <p className="font-semibold text-[var(--text-secondary)] mb-2">No strategies yet</p>
            <p className="text-xs mb-4">Create rules like "If CPI above 3.5 → Long BTC 5%". Strategies fire when macro events trigger your conditions.</p>
            <button onClick={() => setShowForm(true)} className="px-4 py-2 rounded-xl text-white text-sm font-bold" style={{ background: "var(--orange)" }}>
              Create First Strategy
            </button>
          </div>
        </GlassCard>
      )}

      {/* Strategy cards */}
      <div className="space-y-3">
        {strategies.map((s: any, i: number) => {
          const eColor = EVENT_COLOR[s.trigger_event] ?? "#64748b";
          const isExpanded = expandedId === s.id;
          const isLong = s.action_direction === "long";
          return (
            <motion.div key={s.id ?? i} initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}>
              <GlassCard animate={false} padding="md">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 text-xs font-black"
                      style={{ background: eColor + "18", color: eColor }}>
                      {s.trigger_event?.slice(0, 3)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="font-bold text-[var(--text-primary)] text-sm">{s.name}</span>
                        <span className="text-xs px-2 py-0.5 rounded-full font-bold" style={{ background: eColor + "18", color: eColor }}>
                          {s.trigger_event}
                        </span>
                        {s.active
                          ? <span className="text-xs px-2 py-0.5 rounded-full font-bold bg-green-500/10 text-green-400">Active</span>
                          : <span className="text-xs px-2 py-0.5 rounded-full font-bold bg-slate-500/10 text-slate-400">Inactive</span>}
                        {s.auto_execute && <span className="text-xs px-2 py-0.5 rounded-full font-bold bg-orange-500/10 text-orange-400">Auto</span>}
                      </div>
                      <div className="text-xs text-[var(--text-muted)]">
                        If {s.trigger_event} {s.trigger_condition} {s.trigger_value} →{" "}
                        <span className={isLong ? "text-green-400 font-semibold" : "text-red-400 font-semibold"}>
                          {isLong ? "Long" : "Short"} {s.action_asset}
                        </span>{" "}
                        {s.action_size_pct}% · SL {s.action_sl_pct}% · TP {s.action_tp_pct}%
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button onClick={() => setExpandedId(isExpanded ? null : s.id)} className="p-2 rounded-lg hover:bg-white/5 text-[var(--text-muted)] transition">
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                    <button onClick={() => remove.mutate(s.id)} disabled={remove.isPending} className="p-2 rounded-lg hover:bg-red-500/10 text-[var(--text-muted)] hover:text-red-400 transition">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                {isExpanded && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="mt-3 pt-3 border-t border-white/5">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                      {[
                        { label: "Direction", value: s.action_direction?.toUpperCase(), color: isLong ? "#10b981" : "#ef4444" },
                        { label: "Size", value: `${s.action_size_pct}%`, color: "#3b82f6" },
                        { label: "Stop-Loss", value: `${s.action_sl_pct}%`, color: "#ef4444" },
                        { label: "Take-Profit", value: `${s.action_tp_pct}%`, color: "#10b981" },
                      ].map((d) => (
                        <div key={d.label} className="rounded-xl p-2.5" style={{ background: "rgba(255,255,255,0.04)" }}>
                          <p className="text-[var(--text-muted)] mb-0.5">{d.label}</p>
                          <p className="font-black font-mono" style={{ color: d.color }}>{d.value}</p>
                        </div>
                      ))}
                    </div>
                    {s.created_at && (
                      <p className="text-xs text-[var(--text-muted)] mt-2 opacity-60">Created {new Date(s.created_at).toLocaleDateString()}</p>
                    )}
                  </motion.div>
                )}
              </GlassCard>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}