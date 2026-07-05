"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Brain, CheckCircle2, Database, LineChart, Newspaper, Shield, Sparkles, Target } from "lucide-react";
import { GlassCard } from "@/components/GlassCard";
import { cn } from "@/lib/utils";

const ANALYSIS_STEPS = [
  { id: "market", label: "Market data", icon: LineChart },
  { id: "news", label: "News & macro", icon: Newspaper },
  { id: "sectors", label: "SSI sectors", icon: Database },
  { id: "ai", label: "AI synthesis", icon: Brain },
];

export interface AnalysisResult {
  asset?: string;
  direction?: string;
  confidence?: number;
  confidence_explanation?: string;
  reasoning?: string;
  reason?: string;
  entry?: number | null;
  takeProfit?: number | null;
  take_profit?: number | null;
  stopLoss?: number | null;
  stop_loss?: number | null;
  tp?: number | null;
  sl?: number | null;
  sources?: Array<{ module?: string; insight?: string }>;
  citations?: Array<{ source?: string; endpoint?: string; note?: string }>;
  id?: string;
}

interface AiAnalysisPanelProps {
  asset: string;
  analyzing: boolean;
  analysisStep: number;
  result: AnalysisResult | null;
  error: string | null;
  onClose?: () => void;
}

function dirColor(dir: string) {
  const d = dir.toLowerCase();
  if (d.includes("long") || d === "buy") return "var(--green)";
  if (d.includes("short") || d === "sell") return "var(--red)";
  return "var(--accent)";
}

export function AiAnalysisPanel({
  asset,
  analyzing,
  analysisStep,
  result,
  error,
  onClose,
}: AiAnalysisPanelProps) {
  const direction = String(result?.direction ?? "neutral");
  const confidence = Number(result?.confidence ?? 0);
  const reasoning = String(result?.reasoning ?? result?.reason ?? "");
  const entry = result?.entry ?? null;
  const tp = result?.takeProfit ?? result?.take_profit ?? result?.tp ?? null;
  const sl = result?.stopLoss ?? result?.stop_loss ?? result?.sl ?? null;
  const sources = Array.isArray(result?.sources) ? result!.sources! : [];
  const citations = Array.isArray(result?.citations) ? result!.citations! : [];

  if (!analyzing && !result && !error) return null;

  return (
    <AnimatePresence>
      {(analyzing || result || error) && (
        <motion.div
          initial={{ opacity: 0, y: 16, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -12, scale: 0.98 }}
          transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
        >
          {error ? (
            <GlassCard glow="red" padding="md">
              <p className="text-sm text-[var(--red)]">{error}</p>
            </GlassCard>
          ) : analyzing ? (
            <GlassCard padding="lg" glow="orange">
              <div className="flex items-center gap-3 mb-6">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 2.4, repeat: Infinity, ease: "linear" }}
                  className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ background: "var(--accent-soft)", border: "1px solid var(--accent-border)" }}
                >
                  <Sparkles className="w-5 h-5" style={{ color: "var(--accent)" }} />
                </motion.div>
                <div>
                  <h3 className="font-bold text-[var(--text-primary)]" style={{ fontFamily: "var(--font-display)" }}>
                    Analyzing {asset}
                  </h3>
                  <p className="text-xs text-[var(--text-muted)] mt-0.5">Pulling live SoSoValue, market, and AI data</p>
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {ANALYSIS_STEPS.map((step, i) => {
                  const done = i < analysisStep;
                  const active = i === analysisStep;
                  const Icon = step.icon;
                  return (
                    <motion.div
                      key={step.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.08, duration: 0.4 }}
                      className={cn(
                        "relative p-3 rounded-[var(--radius-md)] border transition-colors",
                        active && "border-[var(--accent-border)]",
                        done && !active && "border-[rgba(34,197,94,0.35)]",
                        !done && !active && "border-[var(--glass-border)]"
                      )}
                      style={{
                        background: active ? "var(--accent-soft)" : done ? "rgba(34,197,94,0.08)" : "var(--bg-glass)",
                      }}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        {done ? (
                          <CheckCircle2 className="w-4 h-4" style={{ color: "var(--green)" }} />
                        ) : (
                          <Icon className="w-4 h-4" style={{ color: active ? "var(--accent)" : "var(--text-muted)" }} />
                        )}
                        <span className="text-[11px] font-semibold text-[var(--text-secondary)]">{step.label}</span>
                      </div>
                      {active && (
                        <motion.div
                          className="h-0.5 rounded-full mt-2 origin-left"
                          style={{ background: "var(--accent)" }}
                          initial={{ scaleX: 0 }}
                          animate={{ scaleX: 1 }}
                          transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
                        />
                      )}
                    </motion.div>
                  );
                })}
              </div>
            </GlassCard>
          ) : result ? (
            <GlassCard padding="lg" glow="orange">
              <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--accent)] mb-2">
                    Live analysis
                  </p>
                  <h3 className="text-xl font-black text-[var(--text-primary)]" style={{ fontFamily: "var(--font-display)", letterSpacing: "-0.03em" }}>
                    {asset} · {direction.toUpperCase()}
                  </h3>
                  {result.confidence_explanation && (
                    <p className="text-xs text-[var(--text-muted)] mt-1 max-w-xl">{result.confidence_explanation}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className="px-3 py-1.5 rounded-full text-xs font-bold"
                    style={{
                      color: dirColor(direction),
                      background: `color-mix(in srgb, ${dirColor(direction)} 12%, transparent)`,
                      border: `1px solid color-mix(in srgb, ${dirColor(direction)} 35%, transparent)`,
                    }}
                  >
                    {direction.toUpperCase()}
                  </span>
                  {onClose && (
                    <button
                      type="button"
                      onClick={onClose}
                      className="text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] px-2 py-1"
                    >
                      Dismiss
                    </button>
                  )}
                </div>
              </div>

              {confidence > 0 && (
                <div className="mb-6">
                  <div className="flex justify-between text-xs text-[var(--text-muted)] mb-1.5">
                    <span className="flex items-center gap-1"><Shield className="w-3 h-3" /> Confidence</span>
                    <span className="font-mono font-bold">{confidence}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-[var(--border-subtle)] overflow-hidden">
                    <motion.div
                      className="h-full rounded-full"
                      style={{ background: dirColor(direction) }}
                      initial={{ scaleX: 0, transformOrigin: "left" }}
                      animate={{ scaleX: confidence / 100 }}
                      transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
                    />
                  </div>
                </div>
              )}

              {(entry != null || tp != null || sl != null) && (
                <div className="grid grid-cols-3 gap-3 mb-6">
                  {entry != null && (
                    <div className="text-center p-3 rounded-[var(--radius-md)] bg-[var(--bg-glass)] border border-[var(--glass-border)]">
                      <div className="text-[10px] uppercase tracking-wide text-[var(--text-muted)] mb-1">Entry</div>
                      <div className="text-sm font-bold font-mono text-[var(--text-primary)]">${Number(entry).toLocaleString(undefined, { maximumFractionDigits: 4 })}</div>
                    </div>
                  )}
                  {tp != null && (
                    <div className="text-center p-3 rounded-[var(--radius-md)] bg-[var(--green-soft)] border border-[rgba(34,197,94,0.2)]">
                      <div className="text-[10px] uppercase tracking-wide text-[var(--green)] mb-1">Take profit</div>
                      <div className="text-sm font-bold font-mono text-[var(--green)]">${Number(tp).toLocaleString(undefined, { maximumFractionDigits: 4 })}</div>
                    </div>
                  )}
                  {sl != null && (
                    <div className="text-center p-3 rounded-[var(--radius-md)] bg-[var(--red-soft)] border border-[rgba(239,68,68,0.2)]">
                      <div className="text-[10px] uppercase tracking-wide text-[var(--red)] mb-1">Stop loss</div>
                      <div className="text-sm font-bold font-mono text-[var(--red)]">${Number(sl).toLocaleString(undefined, { maximumFractionDigits: 4 })}</div>
                    </div>
                  )}
                </div>
              )}

              {reasoning && (
                <motion.p
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15 }}
                  className="text-sm leading-relaxed text-[var(--text-secondary)] mb-6 max-w-3xl"
                >
                  {reasoning}
                </motion.p>
              )}

              {(sources.length > 0 || citations.length > 0) && (
                <div className="space-y-3 pt-4 border-t border-[var(--glass-border)]">
                  <div className="flex items-center gap-2 text-xs font-bold text-[var(--text-muted)] uppercase tracking-wide">
                    <Target className="w-3.5 h-3.5" /> Evidence
                  </div>
                  <div className="grid gap-2 md:grid-cols-2">
                    {sources.map((s, i) => (
                      <motion.div
                        key={`src-${i}`}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.1 + i * 0.05 }}
                        className="p-3 rounded-[var(--radius-sm)] bg-[var(--bg-glass)] border border-[var(--glass-border)]"
                      >
                        <div className="text-[10px] font-mono text-[var(--accent)] mb-1">{s.module ?? "source"}</div>
                        <div className="text-xs text-[var(--text-secondary)]">{s.insight ?? ""}</div>
                      </motion.div>
                    ))}
                    {citations.slice(0, 4).map((c, i) => (
                      <motion.div
                        key={`cite-${i}`}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.15 + i * 0.05 }}
                        className="p-3 rounded-[var(--radius-sm)] bg-[var(--bg-glass)] border border-[var(--glass-border)]"
                      >
                        <div className="text-[10px] font-mono text-[var(--text-muted)] mb-1">{c.source ?? "citation"} · {c.endpoint ?? ""}</div>
                        {c.note && <div className="text-xs text-[var(--text-secondary)]">{c.note}</div>}
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}
            </GlassCard>
          ) : null}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
