"use client";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { TrendingUp, TrendingDown, Minus, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface Signal {
  id?: string;
  symbol?: string;
  asset?: string;
  direction?: "long" | "short" | "neutral";
  confidence?: number;
  reason?: string;
  timestamp?: string | number;
  [key: string]: unknown;
}

interface SignalFeedProps {
  signals: Signal[];
  maxItems?: number;
}

export function SignalFeed({ signals, maxItems = 8 }: SignalFeedProps) {
  const displaySignals = signals.slice(0, maxItems);

  if (!signals || signals.length === 0) {
    return (
      <div
        className="rounded-xl border px-4 py-8 text-center"
        style={{ borderColor: "var(--border-subtle)", background: "var(--surface-2)" }}
      >
        <p className="text-sm font-medium mb-1" style={{ color: "var(--text-primary)" }}>
          No signals yet
        </p>
        <p className="text-xs mb-4 max-w-sm mx-auto leading-relaxed" style={{ color: "var(--text-secondary)" }}>
          Agents publish here when macro and sector scans produce a tradeable setup.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Link
            to="/research"
            className="inline-flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-semibold transition-all duration-200 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-border)]"
            style={{ background: "var(--accent-soft)", color: "var(--accent)", border: "1px solid var(--accent-border)" }}
          >
            Run research <ArrowRight className="w-3 h-3" />
          </Link>
          <Link
            to="/signals"
            className="inline-flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-semibold transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-border)]"
            style={{ color: "var(--text-secondary)", border: "1px solid var(--glass-border)" }}
          >
            Browse ledger
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <AnimatePresence initial={false}>
        {displaySignals.map((signal, i) => {
          const dir = signal.direction ?? "neutral";
          const sym = signal.symbol ?? signal.asset ?? "?";
          const conf = signal.confidence ?? 0;
          return (
            <motion.div
              key={signal.id ?? `${sym}-${i}`}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ delay: i * 0.04, duration: 0.3 }}
              className="flex items-start gap-3 p-3 rounded-[var(--radius-md)] border border-[var(--glass-border)] bg-[var(--bg-glass)] hover:bg-[var(--bg-glass-hover)] transition-colors"
            >
              {/* Direction icon */}
              <div
                className={cn(
                  "w-8 h-8 rounded-[var(--radius-sm)] flex items-center justify-center flex-shrink-0 mt-0.5",
                  dir === "long" && "bg-[var(--green-soft)]",
                  dir === "short" && "bg-[var(--red-soft)]",
                  dir === "neutral" && "bg-[var(--blue-soft)]"
                )}
              >
                {dir === "long" ? (
                  <TrendingUp className="w-4 h-4 text-[var(--green)]" />
                ) : dir === "short" ? (
                  <TrendingDown className="w-4 h-4 text-[var(--red)]" />
                ) : (
                  <Minus className="w-4 h-4 text-[var(--blue)]" />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="font-bold text-sm text-[var(--text-primary)]">{sym}</span>
                  <span
                    className={cn(
                      "text-xs font-bold px-2 py-0.5 rounded-full",
                      dir === "long" && "bg-[var(--green-soft)] text-[var(--green)]",
                      dir === "short" && "bg-[var(--red-soft)] text-[var(--red)]",
                      dir === "neutral" && "bg-[var(--blue-soft)] text-[var(--blue)]"
                    )}
                  >
                    {dir.toUpperCase()}
                  </span>
                </div>
                {signal.reason && (
                  <p className="text-xs text-[var(--text-secondary)] line-clamp-2">{signal.reason}</p>
                )}
                {conf > 0 && (
                  <div className="mt-2">
                    <div className="flex justify-between text-xs text-[var(--text-muted)] mb-1">
                      <span>Confidence</span>
                      <span>{conf}%</span>
                    </div>
                    <div className="h-1 rounded-full bg-[var(--border-subtle)] overflow-hidden">
                      <motion.div
                        className={cn(
                          "h-full rounded-full",
                          dir === "long" ? "bg-[var(--green)]" : dir === "short" ? "bg-[var(--red)]" : "bg-[var(--blue)]"
                        )}
                        initial={{ width: 0 }}
                        animate={{ width: `${conf}%` }}
                        transition={{ duration: 0.6, delay: i * 0.04 }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
