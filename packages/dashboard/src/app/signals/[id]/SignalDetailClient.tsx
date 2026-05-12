"use client";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { fetcher } from "@/lib/api";
import { GlassCard } from "@/components/GlassCard";
import { CryptoIcon } from "@/components/CryptoIcon";
import { PageHeader } from "@/components/LoadingSkeleton";
import { cn } from "@/lib/utils";
import {
  TrendingUp, TrendingDown, Minus, ArrowLeft,
  ShieldCheck, BookOpen, ExternalLink, Clock,
} from "lucide-react";
import Link from "next/link";

// â”€â”€â”€ Citation rendering â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Inserts [n] superscript markers into reasoning text adjacent to module names.
 * Falls back to appending all markers at the end of the last sentence.
 */
function annotateReasoning(
  text: string,
  sources: Array<{ module: string; insight: string }>,
): Array<{ text: string; sup?: number }> {
  if (!sources.length) return [{ text }];

  // Build regex alternatives from module names (e.g. "binance", "etf", "macro")
  const segments: Array<{ text: string; sup?: number }> = [];
  let remaining = text;

  sources.forEach((src, idx) => {
    const keyword = src.module.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(keyword, "i");
    const match = re.exec(remaining);
    if (match) {
      segments.push({ text: remaining.slice(0, match.index + match[0].length) });
      segments.push({ text: "", sup: idx + 1 });
      remaining = remaining.slice(match.index + match[0].length);
    }
  });

  // Append any remaining text + unused citations at end
  const used = segments.filter((s) => s.sup !== undefined).map((s) => s.sup as number);
  const unused = sources.map((_, i) => i + 1).filter((n) => !used.includes(n));
  const suffix = unused.length ? " " + unused.map((n) => `[${n}]`).join("") : "";
  segments.push({ text: remaining + suffix });

  return segments;
}

function CitedReasoning({ text, sources }: { text: string; sources: Array<{ module: string; insight: string }> }) {
  const segments = annotateReasoning(text, sources);
  return (
    <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
      {segments.map((seg, i) =>
        seg.sup !== undefined ? (
          <sup
            key={i}
            className="text-[10px] font-bold ml-0.5 mr-0.5 cursor-default"
            style={{ color: "var(--accent, #3b82f6)", verticalAlign: "super" }}
            title={sources[seg.sup - 1]?.insight}
          >
            [{seg.sup}]
          </sup>
        ) : (
          <span key={i}>{seg.text}</span>
        )
      )}
    </p>
  );
}

// â”€â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function directionStyle(dir: string) {
  const d = dir.toUpperCase();
  if (d === "LONG") return { color: "var(--green)", Icon: TrendingUp };
  if (d === "SHORT") return { color: "var(--red)", Icon: TrendingDown };
  return { color: "var(--yellow)", Icon: Minus };
}

function confidenceColor(conf: number) {
  if (conf >= 75) return "var(--green)";
  if (conf >= 55) return "var(--yellow)";
  return "var(--red)";
}

function fmtDate(s: string) {
  try { return new Date(s).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }); }
  catch { return s; }
}

// â”€â”€â”€ Page â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export default function SignalDetailClient({ id }: { id: string }) {
  const { data: raw, isLoading, isError } = useQuery({
    queryKey: ["signal-detail", id],
    queryFn: () => fetcher(`/api/signals/${id}`),
    staleTime: 60_000,
  });

  const signal: any = (raw as any)?.data ?? raw ?? null;

  const sources: Array<{ module: string; insight: string }> = Array.isArray(signal?.sources)
    ? signal.sources
    : [];
  const citations: Array<{ source: string; endpoint: string; hash: string; timestamp: string; note?: string }> =
    Array.isArray(signal?.citations) ? signal.citations : [];

  const asset = (signal?.asset ?? signal?.symbol ?? "").toUpperCase();
  const dir = (signal?.direction ?? "NEUTRAL").toUpperCase();
  const conf = Number(signal?.confidence ?? 0);
  const { color: dirColor, Icon: DirIcon } = directionStyle(dir);

  return (
    <div>
      <div className="mb-4">
        <Link
          href="/signals"
          className="inline-flex items-center gap-1.5 text-sm font-medium hover:opacity-80 transition-opacity"
          style={{ color: "var(--text-muted)" }}
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Signals
        </Link>
      </div>

      <PageHeader
        title={`Signal â€” ${asset || "Loading"}`}
        subtitle="AI research signal with full provenance"
      />

      {isLoading && (
        <div className="grid gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="skeleton" style={{ height: 80, borderRadius: 14 }} />
          ))}
        </div>
      )}

      {isError && (
        <GlassCard padding="md">
          <p className="text-sm" style={{ color: "var(--red)" }}>Signal not found or could not be loaded.</p>
        </GlassCard>
      )}

      {signal && (
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="grid gap-4"
        >
          {/* â”€â”€ Header card â”€â”€ */}
          <GlassCard animate padding="md">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-3">
                <CryptoIcon symbol={asset} size={40} />
                <div>
                  <div className="text-xl font-black tracking-tight">{asset}</div>
                  {signal.created_at && (
                    <div className="flex items-center gap-1 text-[11px] mt-0.5" style={{ color: "var(--text-muted)" }}>
                      <Clock className="w-3 h-3" />
                      {fmtDate(signal.created_at)}
                    </div>
                  )}
                </div>
              </div>

              {/* Direction + confidence */}
              <div className="flex items-center gap-3">
                <div
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-black"
                  style={{ background: `${dirColor}18`, border: `1px solid ${dirColor}40`, color: dirColor }}
                >
                  <DirIcon className="w-4 h-4" />
                  {dir}
                </div>
                <div className="text-center">
                  <div
                    className="text-2xl font-black tabular-nums"
                    style={{ color: confidenceColor(conf) }}
                  >
                    {conf}%
                  </div>
                  <div className="text-[10px]" style={{ color: "var(--text-muted)" }}>Confidence</div>
                </div>
              </div>
            </div>

            {/* Entry / TP / SL */}
            {(signal.entry || signal.take_profit || signal.stop_loss) && (
              <div className="grid grid-cols-3 gap-3 mt-4 pt-4" style={{ borderTop: "1px solid var(--glass-border)" }}>
                {[
                  { label: "Entry", val: signal.entry, color: "var(--text-primary)" },
                  { label: "Take Profit", val: signal.take_profit ?? signal.takeProfit, color: "var(--green)" },
                  { label: "Stop Loss", val: signal.stop_loss ?? signal.stopLoss, color: "var(--red)" },
                ].map(({ label, val, color }) => (
                  <div key={label} className="text-center">
                    <div className="text-[11px] mb-1" style={{ color: "var(--text-muted)" }}>{label}</div>
                    <div className="text-base font-black tabular-nums" style={{ color }}>
                      {val != null ? `$${Number(val).toLocaleString(undefined, { maximumFractionDigits: 2 })}` : "â€”"}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </GlassCard>

          {/* â”€â”€ Reasoning + inline citations â”€â”€ */}
          <GlassCard animate padding="md">
            <div className="flex items-center gap-2 mb-3">
              <BookOpen className="w-4 h-4" style={{ color: "var(--accent, #3b82f6)" }} />
              <span className="text-sm font-bold">Research Reasoning</span>
            </div>

            <CitedReasoning text={signal.reasoning ?? "No reasoning available."} sources={sources} />

            {/* Confidence explanation */}
            {(signal.confidence_explanation) && (
              <div
                className="mt-3 px-3 py-2 rounded-lg text-xs"
                style={{ background: "rgba(255,255,255,0.03)", border: "1px solid var(--glass-border)", color: "var(--text-muted)" }}
              >
                <ShieldCheck className="w-3.5 h-3.5 inline mr-1.5" style={{ color: confidenceColor(conf) }} />
                {signal.confidence_explanation}
              </div>
            )}

            {/* â”€â”€ Source reference list â”€â”€ */}
            {sources.length > 0 && (
              <div className="mt-4 pt-4" style={{ borderTop: "1px solid var(--glass-border)" }}>
                <div className="text-[11px] font-bold mb-2 uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                  Sources
                </div>
                <ol className="space-y-1">
                  {sources.map((src, i) => (
                    <li key={i} className="flex items-baseline gap-2 text-xs" style={{ color: "var(--text-secondary)" }}>
                      <sup
                        className="font-black shrink-0"
                        style={{ color: "var(--accent, #3b82f6)", minWidth: 18 }}
                      >
                        [{i + 1}]
                      </sup>
                      <span>
                        <span className="font-semibold uppercase tracking-wide text-[10px]">{src.module}</span>
                        <span className="mx-1">â€”</span>
                        <span className="italic">{src.insight}</span>
                      </span>
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </GlassCard>

          {/* â”€â”€ Provenance / Citations â”€â”€ */}
          {citations.length > 0 && (
            <GlassCard animate padding="md">
              <div className="flex items-center gap-2 mb-3">
                <ExternalLink className="w-4 h-4" style={{ color: "var(--text-muted)" }} />
                <span className="text-sm font-bold">Data Provenance</span>
                <span
                  className="ml-auto text-[10px] px-2 py-0.5 rounded-full font-semibold"
                  style={{ background: "rgba(16,185,129,0.12)", color: "var(--green)", border: "1px solid rgba(16,185,129,0.25)" }}
                >
                  {citations.length} verified
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {citations.map((cit, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-2 px-3 py-2 rounded-lg text-[11px]"
                    style={{ background: "rgba(255,255,255,0.025)", border: "1px solid var(--glass-border)" }}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold truncate" style={{ color: "var(--text-primary)" }}>{cit.endpoint}</div>
                      <div className="mt-0.5 truncate" style={{ color: "var(--text-muted)" }}>
                        {cit.source} Â· {cit.note ?? ""}
                      </div>
                    </div>
                    <div
                      className="shrink-0 font-mono text-[9px] px-1.5 py-0.5 rounded"
                      style={{ background: "rgba(255,255,255,0.04)", color: "var(--text-muted)" }}
                      title="SHA-256 hash prefix"
                    >
                      #{cit.hash}
                    </div>
                  </div>
                ))}
              </div>
            </GlassCard>
          )}

          {/* â”€â”€ Outcome badge (if resolved) â”€â”€ */}
          {(signal as any).outcome && (
            <GlassCard animate padding="md">
              <div className="text-sm font-bold mb-2">Outcome</div>
              <div
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-black"
                style={{
                  background: signal.outcome === "HIT" ? "rgba(16,185,129,0.15)" : signal.outcome === "STOP" ? "rgba(239,68,68,0.15)" : "rgba(251,191,36,0.15)",
                  color: signal.outcome === "HIT" ? "var(--green)" : signal.outcome === "STOP" ? "var(--red)" : "var(--yellow)",
                  border: `1px solid ${signal.outcome === "HIT" ? "rgba(16,185,129,0.35)" : signal.outcome === "STOP" ? "rgba(239,68,68,0.35)" : "rgba(251,191,36,0.35)"}`,
                }}
              >
                {signal.outcome}
                {signal.outcome_price && (
                  <span className="font-normal text-xs">
                    @ ${Number(signal.outcome_price).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </span>
                )}
              </div>
            </GlassCard>
          )}
        </motion.div>
      )}
    </div>
  );
}