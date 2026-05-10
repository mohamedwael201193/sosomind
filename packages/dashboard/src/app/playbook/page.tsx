"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { fetcher } from "@/lib/api";
import { GlassCard } from "@/components/GlassCard";
import { BookOpen, Plus, Trash2, Play, CheckCircle, AlertTriangle, Edit3 } from "lucide-react";
import { useWallet } from "@/context/WalletContext";

const PRESET_EVENTS = ["CPI", "FOMC", "NFP", "ETF_INFLOW", "ETF_OUTFLOW", "GDP"];

export default function PlaybookPage() {
  const qc = useQueryClient();
  const { address } = useWallet();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    user_id: address ?? "anonymous",
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
    queryKey: ["playbook"],
    queryFn: () => fetcher(`/api/playbook?user_id=${address ?? 'anonymous'}`),
    refetchInterval: 60000,
  });

  const { data: checkData, refetch: runCheck, isFetching: isChecking } = useQuery({
    queryKey: ["playbook-check"],
    queryFn: () => fetcher(`/api/playbook/check?user_id=${address ?? 'anonymous'}`),
    enabled: false,
  });

  const createStrategy = useMutation({
    mutationFn: (body: any) => { const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:10000"; return fetch(`${API}/api/playbook`, { method: "POST", body: JSON.stringify(body), headers: { "Content-Type": "application/json" } }).then(r => r.json()); },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["playbook"] }); setShowForm(false); },
  });

  const deleteStrategy = useMutation({
    mutationFn: (id: string) => { const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:10000"; return fetch(`${API}/api/playbook/${id}`, { method: "DELETE" }).then(r => r.json()); },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["playbook"] }),
  });

  const strategies: any[] = Array.isArray((data as any)?.data) ? (data as any).data : [];
  const checkResults: any[] = Array.isArray((checkData as any)?.data) ? (checkData as any).data : [];

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-black text-[var(--text-primary)] mb-1 flex items-center gap-2">
              <BookOpen className="w-6 h-6 text-[var(--orange)]" /> Macro Playbook
            </h1>
            <p className="text-sm text-[var(--text-muted)]">Automated strategies triggered by macro events</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => runCheck()}
              disabled={isChecking}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--orange)] text-white text-sm font-semibold hover:opacity-90 disabled:opacity-50"
            >
              <Play className={`w-4 h-4 ${isChecking ? "animate-spin" : ""}`} /> Check Triggers
            </button>
            <button
              onClick={() => setShowForm(!showForm)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--blue)] text-white text-sm font-semibold hover:opacity-90"
            >
              <Plus className="w-4 h-4" /> New Strategy
            </button>
          </div>
        </div>
      </motion.div>

      {/* Trigger Check Results */}
      {checkResults.length > 0 && (
        <GlassCard padding="md">
          <h2 className="text-sm font-bold text-[var(--text-primary)] mb-3">🔔 Trigger Check Results</h2>
          {checkResults.map((r: any, i: number) => (
            <div key={i} className="flex items-start gap-2 text-sm py-2 border-b border-[var(--border)] last:border-0">
              {r.triggered ? <CheckCircle className="w-4 h-4 text-[var(--green)] mt-0.5" /> : <AlertTriangle className="w-4 h-4 text-[var(--text-muted)] mt-0.5" />}
              <div>
                <span className="font-semibold text-[var(--text-primary)]">{r.strategy?.name}</span>
                {" — "}{r.triggered ? <span className="text-[var(--green)]">TRIGGERED</span> : <span className="text-[var(--text-muted)]">Not triggered</span>}
                {r.reason && <span className="text-xs text-[var(--text-muted)] ml-2">({r.reason})</span>}
              </div>
            </div>
          ))}
        </GlassCard>
      )}

      {/* New Strategy Form */}
      {showForm && (
        <GlassCard padding="md">
          <h2 className="text-base font-bold text-[var(--text-primary)] mb-4">New Macro Strategy</h2>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="text-xs text-[var(--text-muted)] font-semibold">Strategy Name</label>
              <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. CPI Hot → Short BTC"
                className="w-full mt-1 px-3 py-2 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text-primary)] text-sm focus:outline-none focus:border-[var(--blue)]" />
            </div>
            <div>
              <label className="text-xs text-[var(--text-muted)] font-semibold">Trigger Event</label>
              <select value={form.trigger_event} onChange={e => setForm({ ...form, trigger_event: e.target.value })}
                className="w-full mt-1 px-3 py-2 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text-primary)] text-sm focus:outline-none">
                {PRESET_EVENTS.map(ev => <option key={ev}>{ev}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-[var(--text-muted)] font-semibold">Condition</label>
              <select value={form.trigger_condition} onChange={e => setForm({ ...form, trigger_condition: e.target.value as any })}
                className="w-full mt-1 px-3 py-2 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text-primary)] text-sm focus:outline-none">
                <option value="above">Above</option>
                <option value="below">Below</option>
                <option value="increases">Increases</option>
                <option value="decreases">Decreases</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-[var(--text-muted)] font-semibold">Value</label>
              <input type="number" value={form.trigger_value} onChange={e => setForm({ ...form, trigger_value: Number(e.target.value) })}
                className="w-full mt-1 px-3 py-2 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text-primary)] text-sm focus:outline-none" />
            </div>
            <div>
              <label className="text-xs text-[var(--text-muted)] font-semibold">Action Asset</label>
              <input value={form.action_asset} onChange={e => setForm({ ...form, action_asset: e.target.value.toUpperCase() })}
                placeholder="BTC"
                className="w-full mt-1 px-3 py-2 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text-primary)] text-sm focus:outline-none" />
            </div>
            <div>
              <label className="text-xs text-[var(--text-muted)] font-semibold">Direction</label>
              <select value={form.action_direction} onChange={e => setForm({ ...form, action_direction: e.target.value as any })}
                className="w-full mt-1 px-3 py-2 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text-primary)] text-sm focus:outline-none">
                <option value="long">Long</option>
                <option value="short">Short</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-[var(--text-muted)] font-semibold">Size %</label>
              <input type="number" value={form.action_size_pct} onChange={e => setForm({ ...form, action_size_pct: Number(e.target.value) })}
                className="w-full mt-1 px-3 py-2 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text-primary)] text-sm focus:outline-none" />
            </div>
            <div className="flex items-center gap-2 pt-4">
              <label className="text-xs text-[var(--text-muted)] font-semibold">Auto Execute</label>
              <input type="checkbox" checked={form.auto_execute} onChange={e => setForm({ ...form, auto_execute: e.target.checked })}
                className="w-4 h-4" />
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button
              onClick={() => createStrategy.mutate(form)}
              disabled={createStrategy.isPending || !form.name}
              className="px-4 py-2 rounded-xl bg-[var(--green)] text-white text-sm font-semibold hover:opacity-90 disabled:opacity-50"
            >
              {createStrategy.isPending ? "Saving…" : "Save Strategy"}
            </button>
            <button onClick={() => setShowForm(false)} className="px-4 py-2 rounded-xl bg-[var(--surface-2)] text-[var(--text-muted)] text-sm hover:opacity-80">Cancel</button>
          </div>
        </GlassCard>
      )}

      {isLoading && <div className="text-center py-8 text-[var(--text-muted)]">Loading strategies…</div>}
      {!isLoading && strategies.length === 0 && (
        <GlassCard padding="md">
          <div className="text-center py-8 text-[var(--text-muted)]">
            <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="font-semibold">No strategies yet</p>
            <p className="text-xs mt-1">Create your first macro-triggered strategy above</p>
          </div>
        </GlassCard>
      )}

      <div className="grid grid-cols-1 gap-4">
        {strategies.map((s: any, i: number) => (
          <motion.div key={s.id ?? i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
            <GlassCard padding="md">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <span className="font-bold text-[var(--text-primary)]">{s.name}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${s.active ? "bg-[var(--green)]20 text-[var(--green)]" : "bg-[var(--surface-2)] text-[var(--text-muted)]"}`}>
                      {s.active ? "Active" : "Paused"}
                    </span>
                    {s.auto_execute && <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--orange)]20 text-[var(--orange)] font-semibold">Auto Execute</span>}
                  </div>
                  <div className="text-sm text-[var(--text-muted)]">
                    If <strong>{s.trigger_event}</strong> {s.trigger_condition} <strong>{s.trigger_value}</strong>
                    {" → "} {s.action_direction?.toUpperCase()} <strong>{s.action_asset}</strong> ({s.action_size_pct}%)
                  </div>
                  {(s.backtest_win_rate != null) && (
                    <div className="text-xs text-[var(--text-muted)] mt-1">
                      Backtest: {(s.backtest_win_rate * 100).toFixed(0)}% WR · Avg PnL: {s.backtest_avg_pnl_pct?.toFixed(2)}%
                    </div>
                  )}
                </div>
                <button
                  onClick={() => deleteStrategy.mutate(s.id)}
                  className="p-2 rounded-lg hover:bg-[var(--red)]20 text-[var(--text-muted)] hover:text-[var(--red)] transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </GlassCard>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
