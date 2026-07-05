"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { fetcher } from "@/lib/api";
import { LabsPreviewBanner } from "@/components/LabsPreviewBanner";
import { GlassCard } from "@/components/GlassCard";
import { cn } from "@/lib/utils";
import { User, Zap, Shield, BarChart2, TrendingUp, Clock, CheckCircle, ChevronRight, RefreshCw } from "lucide-react";
import { useWallet } from "@/context/WalletContext";

import { API_URL as API } from '@/lib/env';

const PERSONAS = [
  {
    id: "aggressive",
    label: "Aggressive",
    icon: Zap,
    color: "#ef4444",
    bg: "rgba(239,68,68,0.1)",
    desc: "High risk, high reward. Max leverage, concentrated positions, momentum chasing. For experienced traders.",
    traits: ["High leverage", "Concentrated bets", "Momentum focus", "Short-term"],
  },
  {
    id: "balanced",
    label: "Balanced",
    icon: BarChart2,
    color: "#3b82f6",
    bg: "rgba(59,130,246,0.1)",
    desc: "Optimal risk-adjusted returns. Diversified across assets and timeframes. Suitable for most investors.",
    traits: ["Diversified", "Risk-adjusted", "Mixed timeframes", "Trend-following"],
  },
  {
    id: "conservative",
    label: "Conservative",
    icon: Shield,
    color: "#10b981",
    bg: "rgba(16,185,129,0.1)",
    desc: "Capital preservation first. Low drawdown, stablecoins allocation, blue-chip only. For risk-averse investors.",
    traits: ["Capital protection", "Low drawdown", "Stablecoin buffer", "Blue-chip only"],
  },
  {
    id: "quant",
    label: "Quant",
    icon: TrendingUp,
    color: "#8b5cf6",
    bg: "rgba(139,92,246,0.1)",
    desc: "Data-driven systematic strategies. Statistical arbitrage, mean reversion, algorithmic signals.",
    traits: ["Data-driven", "Systematic", "Mean reversion", "Stat arb"],
  },
  {
    id: "swing",
    label: "Swing Trader",
    icon: Clock,
    color: "#f59e0b",
    bg: "rgba(245,158,11,0.1)",
    desc: "Multi-day to multi-week holds. Technical analysis + macro catalysts. Patient, disciplined entry/exit.",
    traits: ["Days to weeks", "Technical + macro", "Patient entries", "Clear exits"],
  },
] as const;

const QUIZ_QUESTIONS = [
  {
    question: "How would you react to a 30% portfolio drop?",
    options: ["Sell everything — capital matters most", "Hold and wait for recovery", "Buy more — great discount", "Rebalance systematically", "It depends on my signals"],
  },
  {
    question: "Your ideal holding period for a position?",
    options: ["Hours to days", "Days to weeks", "Weeks to months", "Months to years", "Until the model says exit"],
  },
  {
    question: "Which describes your primary edge?",
    options: ["Speed and aggressiveness", "Balanced diversification", "Avoiding losses", "Quantitative models", "Chart patterns + timing"],
  },
  {
    question: "What % of portfolio in a single conviction trade?",
    options: ["30%+ (max conviction)", "10–20%", "5–10%", "I follow a strict formula", "2–5% per position"],
  },
];

const QUIZ_MAP: Record<number, Record<number, string>> = {
  0: { 0: "conservative", 1: "balanced", 2: "aggressive", 3: "quant", 4: "quant" },
  1: { 0: "aggressive", 1: "swing", 2: "balanced", 3: "conservative", 4: "quant" },
  2: { 0: "aggressive", 1: "balanced", 2: "conservative", 3: "quant", 4: "swing" },
  3: { 0: "aggressive", 1: "swing", 2: "balanced", 3: "quant", 4: "conservative" },
};

export default function PersonaPage() {
  const qc = useQueryClient();
  const { address } = useWallet();
  const USER = address ?? "anonymous";
  const [showQuiz, setShowQuiz] = useState(false);
  const [quizStep, setQuizStep] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["persona", USER],
    queryFn: () => fetcher<any>(`/api/persona?user_id=${USER}`),
    refetchInterval: false,
  });

  // fetcher returns { persona: "..." } directly
  const personaData: any = data ?? {};
  const currentPersona: string = personaData.persona ?? personaData?.config?.persona ?? "";
  const currentConfig = PERSONAS.find((p) => p.id === currentPersona);

  const setPersona = useMutation({
    mutationFn: (persona: string) =>
      fetch(`${API}/api/persona`, { method: "POST", body: JSON.stringify({ user_id: USER, persona }), headers: { "Content-Type": "application/json" } }).then((r) => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["persona", USER] }); },
  });

  const submitQuiz = useMutation({
    mutationFn: (answers: number[]) =>
      fetch(`${API}/api/persona/quiz`, { method: "POST", body: JSON.stringify({ answers }), headers: { "Content-Type": "application/json" } }).then((r) => r.json()),
    onSuccess: (res) => {
      const suggested = res?.data?.persona ?? res?.persona;
      if (suggested) setPersona.mutate(suggested);
      setShowQuiz(false);
      setQuizStep(0);
      setAnswers([]);
      qc.invalidateQueries({ queryKey: ["persona", USER] });
    },
  });

  function handleAnswer(idx: number) {
    const newAnswers = [...answers, idx];
    setAnswers(newAnswers);
    if (quizStep + 1 >= QUIZ_QUESTIONS.length) {
      submitQuiz.mutate(newAnswers);
    } else {
      setQuizStep(quizStep + 1);
    }
  }

  return (
    <div className="space-y-5">
      <LabsPreviewBanner feature="Trader Persona" />
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: [0.16,1,0.3,1] }}>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-black text-[var(--text-primary)] mb-1 flex items-center gap-2">
              <User className="w-6 h-6 text-[var(--blue)]" /> Trading Persona
            </h1>
            <p className="text-sm text-[var(--text-muted)]">Define your risk profile — signals and recommendations adapt to your style</p>
          </div>
          {!showQuiz && (
            <button onClick={() => { setShowQuiz(true); setQuizStep(0); setAnswers([]); }}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-white text-sm font-semibold hover:opacity-90"
              style={{ background: "var(--blue)" }}>
              <Zap className="w-4 h-4" /> Take Persona Quiz
            </button>
          )}
        </div>
      </motion.div>

      {/* Current persona banner */}
      {currentConfig && !showQuiz && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
          <GlassCard animate={false} padding="md" glow="blue">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0"
                style={{ background: currentConfig.bg }}>
                <currentConfig.icon className="w-7 h-7" style={{ color: currentConfig.color }} />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs text-[var(--text-muted)]">Active Persona</span>
                  <CheckCircle className="w-4 h-4" style={{ color: currentConfig.color }} />
                </div>
                <p className="text-lg font-black" style={{ color: currentConfig.color }}>{currentConfig.label}</p>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">{currentConfig.desc}</p>
              </div>
              <div className="hidden md:flex gap-1.5 flex-wrap max-w-xs">
                {currentConfig.traits.map((t) => (
                  <span key={t} className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ background: currentConfig.bg, color: currentConfig.color }}>{t}</span>
                ))}
              </div>
            </div>
          </GlassCard>
        </motion.div>
      )}

      {/* Quiz */}
      <AnimatePresence>
        {showQuiz && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
            <GlassCard animate={false} padding="md" glow="blue">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-[var(--text-primary)]">
                  Question {quizStep + 1} of {QUIZ_QUESTIONS.length}
                </h3>
                <button onClick={() => setShowQuiz(false)} className="text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)]">Skip</button>
              </div>
              {/* Progress */}
              <div className="h-1 bg-white/5 rounded-full mb-5 overflow-hidden">
                <motion.div className="h-full rounded-full bg-[var(--blue)]"
                  animate={{ width: `${((quizStep) / QUIZ_QUESTIONS.length) * 100}%` }}
                  transition={{ duration: 0.4 }} />
              </div>
              <p className="text-base font-bold text-[var(--text-primary)] mb-4">{QUIZ_QUESTIONS[quizStep].question}</p>
              <div className="space-y-2">
                {QUIZ_QUESTIONS[quizStep].options.map((opt, i) => (
                  <button key={i} onClick={() => handleAnswer(i)}
                    className="w-full text-left px-4 py-3 rounded-xl text-sm text-[var(--text-secondary)] border border-white/8 hover:border-[var(--blue)]/40 hover:bg-[var(--blue)]/5 hover:text-[var(--text-primary)] transition-all flex items-center justify-between group">
                    {opt}
                    <ChevronRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity text-[var(--blue)]" />
                  </button>
                ))}
              </div>
            </GlassCard>
          </motion.div>
        )}
      </AnimatePresence>

      {isLoading && (
        <GlassCard padding="md">
          <div className="flex items-center justify-center gap-3 py-8 text-[var(--text-muted)]">
            <RefreshCw className="w-5 h-5 animate-spin" />
            <span className="text-sm">Loading your persona profile…</span>
          </div>
        </GlassCard>
      )}

      {/* Persona grid */}
      {!showQuiz && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {PERSONAS.map((p, i) => {
            const isActive = currentPersona === p.id;
            const Icon = p.icon;
            return (
              <motion.div key={p.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 + i * 0.05 }}>
                <GlassCard animate={false} padding="md" glow={isActive ? "blue" : "none"}>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: p.bg }}>
                      <Icon className="w-5 h-5" style={{ color: p.color }} />
                    </div>
                    <div className="flex-1">
                      <p className="font-black text-[var(--text-primary)]">{p.label}</p>
                      {isActive && <span className="text-xs font-bold" style={{ color: p.color }}>Current Profile</span>}
                    </div>
                    {isActive && <CheckCircle className="w-5 h-5 flex-shrink-0" style={{ color: p.color }} />}
                  </div>
                  <p className="text-xs text-[var(--text-muted)] mb-3 leading-relaxed">{p.desc}</p>
                  <div className="flex flex-wrap gap-1.5 mb-4">
                    {p.traits.map((t) => (
                      <span key={t} className="text-xs px-2 py-0.5 rounded-full" style={{ background: p.bg, color: p.color }}>{t}</span>
                    ))}
                  </div>
                  <button
                    onClick={() => setPersona.mutate(p.id)}
                    disabled={isActive || setPersona.isPending}
                    className="w-full py-2 rounded-xl text-sm font-bold transition hover:opacity-90 disabled:opacity-40"
                    style={{ background: isActive ? p.bg : p.color + "22", color: isActive ? p.color : p.color, border: `1px solid ${p.color}30` }}>
                    {isActive ? "Active" : setPersona.isPending ? "Saving…" : "Select Profile"}
                  </button>
                </GlassCard>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}