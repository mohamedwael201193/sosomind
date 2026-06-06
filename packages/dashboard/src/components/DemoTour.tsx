"use client";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { X, Target, Zap, CandlestickChart, PieChart, ChevronRight } from "lucide-react";

const STEPS = [
  {
    title: "View Track Record",
    desc: "See live HIT / STOP / DRIFT outcomes from real signals.",
    href: "/track-record",
    icon: Target,
  },
  {
    title: "Inspect a Signal",
    desc: "Open signal detail — SoSoValue citations with timestamps.",
    href: "/signals",
    icon: Zap,
  },
  {
    title: "Risk Preflight + Sign",
    desc: "Copy signal → preflight checks → MetaMask EIP-712 on SoDEX testnet.",
    href: "/trade",
    icon: CandlestickChart,
  },
  {
    title: "Verify Portfolio",
    desc: "Confirm balance change on your SoDEX testnet account.",
    href: "/portfolio",
    icon: PieChart,
  },
];

export function DemoTour() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (pathname === "/landing") return;
    const seen = localStorage.getItem("sosomind-demo-tour-v2");
    if (!seen) {
      const t = setTimeout(() => setOpen(true), 1200);
      return () => clearTimeout(t);
    }
  }, [pathname]);

  const dismiss = () => {
    localStorage.setItem("sosomind-demo-tour-v2", "1");
    setOpen(false);
  };

  if (!open || pathname === "/landing") return null;

  const current = STEPS[step];

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20 }}
        className="fixed bottom-6 right-6 z-[100] w-[min(100vw-2rem,380px)] rounded-2xl shadow-2xl overflow-hidden"
        style={{
          background: "var(--bg-elevated, #12121a)",
          border: "1px solid var(--glass-border)",
        }}
      >
        <div className="p-4 border-b flex items-center justify-between" style={{ borderColor: "var(--glass-border)" }}>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-[var(--accent)]">5-Min Judge Path</p>
            <p className="text-sm font-semibold text-[var(--text-primary)]">Step {step + 1} of {STEPS.length}</p>
          </div>
          <button type="button" onClick={dismiss} aria-label="Close tour">
            <X className="w-4 h-4 text-[var(--text-muted)]" />
          </button>
        </div>
        <div className="p-4">
          <div className="flex items-start gap-3 mb-4">
            <div className="p-2 rounded-xl" style={{ background: "var(--accent-soft)" }}>
              <current.icon className="w-5 h-5 text-[var(--accent)]" />
            </div>
            <div>
              <h3 className="font-bold text-[var(--text-primary)]">{current.title}</h3>
              <p className="text-xs text-[var(--text-muted)] mt-1 leading-relaxed">{current.desc}</p>
            </div>
          </div>
          <div className="flex gap-2">
            {step < STEPS.length - 1 ? (
              <>
                <Link
                  href={current.href}
                  onClick={() => setStep((s) => s + 1)}
                  className="flex-1 flex items-center justify-center gap-1 py-2.5 rounded-xl text-sm font-bold"
                  style={{ background: "var(--accent)", color: "#fff" }}
                >
                  Go
                  <ChevronRight className="w-4 h-4" />
                </Link>
                <button
                  type="button"
                  onClick={() => setStep((s) => s + 1)}
                  className="px-4 py-2.5 rounded-xl text-sm font-medium"
                  style={{ color: "var(--text-muted)" }}
                >
                  Skip
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={dismiss}
                className="w-full py-2.5 rounded-xl text-sm font-bold"
                style={{ background: "var(--accent)", color: "#fff" }}
              >
                Done — Start Trading
              </button>
            )}
          </div>
          <button type="button" onClick={dismiss} className="w-full mt-2 text-xs text-[var(--text-muted)] py-1">
            Don&apos;t show again
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
