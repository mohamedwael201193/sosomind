"use client";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, X } from "lucide-react";
import { cn } from "@/lib/utils";

const STEPS = [
  { label: "Gathering market data", detail: "Fetching klines, orderbook & macro events" },
  { label: "Computing sector intelligence", detail: "Scoring 13 sectors via Signal 1 / 2 / 3" },
  { label: "Evaluating signal track record", detail: "Resolving HIT / STOP / DRIFT outcomes" },
  { label: "Running AI narrative", detail: "Multi-provider reasoning chain" },
  { label: "Analysis complete", detail: "Results ready" },
];

interface AgentCycleProps {
  isOpen: boolean;
  onClose: () => void;
  asset: string;
}

export function AgentCycle({ isOpen, onClose, asset }: AgentCycleProps) {
  const [step, setStep] = useState(-1);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setStep(-1);
      setDone(false);
      return;
    }
    setStep(0);
    setDone(false);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || step < 0) return;
    if (step >= STEPS.length - 1) {
      const t = setTimeout(() => setDone(true), 900);
      return () => clearTimeout(t);
    }
    const delay = step === 0 ? 800 : step === 1 ? 1200 : step === 2 ? 900 : 1100;
    const t = setTimeout(() => setStep((s) => s + 1), delay);
    return () => clearTimeout(t);
  }, [isOpen, step]);

  const progress = step < 0 ? 0 : Math.round(((step + 1) / STEPS.length) * 100);

  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-[9998] flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={done ? onClose : undefined}
          style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(6px)" }}
        >
          <motion.div
            className="relative w-full max-w-md rounded-2xl border border-[var(--glass-border)] overflow-hidden"
            style={{ background: "var(--surface)" }}
            initial={{ scale: 0.92, opacity: 0, y: 24 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.92, opacity: 0, y: 24 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Gradient header */}
            <div
              className="h-1 w-full"
              style={{ background: "var(--grad-brand)" }}
            />

            <div className="p-6">
              {/* Title row */}
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="font-black text-[var(--text-primary)] text-lg">AI Agent Cycle</h3>
                  <p className="text-xs text-[var(--text-muted)]">
                    {done ? "Analysis complete" : `Analyzing ${asset}…`}
                  </p>
                </div>
                {done && (
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={onClose}
                    className="w-8 h-8 rounded-full bg-[var(--bg-glass-hover)] flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </motion.button>
                )}
              </div>

              {/* Steps */}
              <div className="space-y-3 mb-6">
                {STEPS.map((s, i) => {
                  const isCompleted = step > i || done;
                  const isActive = step === i && !done;
                  return (
                    <motion.div
                      key={i}
                      className={cn(
                        "flex items-start gap-3 p-3 rounded-xl transition-all duration-300",
                        isActive && "bg-[rgba(59,130,246,0.08)] border border-[rgba(59,130,246,0.15)]",
                        isCompleted && "opacity-80",
                        !isActive && !isCompleted && "opacity-30"
                      )}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: isActive || isCompleted ? (isCompleted ? 0.8 : 1) : 0.3, x: 0 }}
                      transition={{ delay: i * 0.05, duration: 0.3 }}
                    >
                      {/* Icon */}
                      <div className="flex-shrink-0 mt-0.5">
                        {isCompleted ? (
                          <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ type: "spring", stiffness: 400, damping: 20 }}
                          >
                            <CheckCircle2 className="w-5 h-5 text-[var(--green)]" />
                          </motion.div>
                        ) : isActive ? (
                          <div className="w-5 h-5 rounded-full border-2 border-[var(--blue)] border-t-transparent animate-spin" />
                        ) : (
                          <div className="w-5 h-5 rounded-full border-2 border-[var(--glass-border)]" />
                        )}
                      </div>

                      {/* Text */}
                      <div className="min-w-0">
                        <p
                          className={cn(
                            "text-sm font-semibold",
                            isActive ? "text-[var(--text-primary)]" : isCompleted ? "text-[var(--text-secondary)]" : "text-[var(--text-muted)]"
                          )}
                        >
                          {s.label}
                        </p>
                        {(isActive || isCompleted) && (
                          <p className="text-xs text-[var(--text-muted)] mt-0.5">{s.detail}</p>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </div>

              {/* Progress bar */}
              <div className="h-1.5 rounded-full overflow-hidden bg-[var(--border)]">
                <motion.div
                  className="h-full rounded-full"
                  style={{ background: "var(--grad-brand)" }}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.5, ease: "easeOut" }}
                />
              </div>
              <div className="flex items-center justify-between mt-1.5">
                <span className="text-xs text-[var(--text-muted)]">
                  {done ? "Done" : `Step ${Math.min(step + 1, STEPS.length)} / ${STEPS.length}`}
                </span>
                <span className="text-xs font-bold text-[var(--text-muted)]">{progress}%</span>
              </div>

              {/* Done action */}
              <AnimatePresence>
                {done && (
                  <motion.button
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ delay: 0.2 }}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={onClose}
                    className="w-full mt-4 py-2.5 rounded-[var(--radius-md)] text-sm font-bold text-white"
                    style={{ background: "var(--grad-brand)" }}
                  >
                    View Results
                  </motion.button>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
