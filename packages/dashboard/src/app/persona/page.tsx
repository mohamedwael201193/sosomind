"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { fetcher } from "@/lib/api";
import { GlassCard } from "@/components/GlassCard";
import { User, Zap, Shield, Brain, TrendingUp, BarChart3, CheckCircle, ChevronRight } from "lucide-react";
import { useWallet } from "@/context/WalletContext";

const PERSONA_CONFIG: Record<string, { icon: React.ReactNode; color: string; title: string; desc: string }> = {
  aggressive: { icon: <Zap className="w-5 h-5" />, color: "var(--red)", title: "Aggressive", desc: "High risk, high reward. Max leverage, early entries, focus on momentum." },
  balanced: { icon: <BarChart3 className="w-5 h-5" />, color: "var(--blue)", title: "Balanced", desc: "Moderate risk. Diversified approach, standard position sizes." },
  conservative: { icon: <Shield className="w-5 h-5" />, color: "var(--green)", title: "Conservative", desc: "Capital preservation first. Small positions, tight stops, BTC/ETH focus." },
  quant: { icon: <Brain className="w-5 h-5" />, color: "var(--purple)", title: "Quant", desc: "Data-driven. Kelly sizing, multi-timeframe confluence, strict backtests." },
  swing: { icon: <TrendingUp className="w-5 h-5" />, color: "var(--orange)", title: "Swing Trader", desc: "Weekly moves, macro-aware entries, 3-7 day holds." },
};

const QUIZ_QUESTIONS = [
  { q: "How do you react to a 20% portfolio drop in one week?", options: ["Panic sell immediately", "Hold and wait", "Buy the dip aggressively", "Reduce position slightly"] },
  { q: "What is your preferred holding period?", options: ["Minutes to hours (scalping)", "Days to weeks (swing)", "Weeks to months", "I prefer set-and-forget"] },
  { q: "Which statement best describes your strategy?", options: ["I chase momentum pumps", "I follow fundamentals + macros", "I use quant models and backtesting", "I only buy blue chips (BTC/ETH)"] },
  { q: "How much of your portfolio do you risk per trade?", options: ["10%+", "3-5%", "1-2%", "<1%"] },
];

export default function PersonaPage() {
  const qc = useQueryClient();
  const { address } = useWallet();
  const USER_ID = address ?? "anonymous";
  const [quizActive, setQuizActive] = useState(false);
  const [quizStep, setQuizStep] = useState(0);
  const [quizAnswers, setQuizAnswers] = useState<number[]>([]);

  const { data, isLoading } = useQuery({
    queryKey: ["persona"],
    queryFn: () => fetcher(`/api/persona?user_id=${USER_ID}`),
  });

  const setPersona = useMutation({
    mutationFn: (persona: string) => { const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:10000"; return fetch(`${API}/api/persona`, { method: "POST", body: JSON.stringify({ user_id: USER_ID, persona }), headers: { "Content-Type": "application/json" } }).then(r => r.json()); },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["persona"] }),
  });

  const submitQuiz = useMutation({
    mutationFn: (answers: number[]) => { const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:10000"; return fetch(`${API}/api/persona/quiz`, { method: "POST", body: JSON.stringify({ user_id: USER_ID, answers }), headers: { "Content-Type": "application/json" } }).then(r => r.json()); },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["persona"] }); setQuizActive(false); setQuizAnswers([]); setQuizStep(0); },
  });

  const personaData = (data as any)?.data ?? data ?? {};
  const currentPersona: string = personaData.persona ?? personaData?.config?.persona ?? "";
  const personaCfg = PERSONA_CONFIG[currentPersona];

  const handleQuizAnswer = (idx: number) => {
    const answers = [...quizAnswers, idx];
    if (quizStep + 1 < QUIZ_QUESTIONS.length) {
      setQuizAnswers(answers);
      setQuizStep(quizStep + 1);
    } else {
      submitQuiz.mutate(answers);
    }
  };

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-black text-[var(--text-primary)] mb-1 flex items-center gap-2">
          <User className="w-6 h-6 text-[var(--purple)]" /> Trader Persona
        </h1>
        <p className="text-sm text-[var(--text-muted)]">Choose your trading style — affects signal filtering, Kelly sizing &amp; risk recommendations</p>
      </motion.div>

      {/* Current Persona */}
      {currentPersona && personaCfg && (
        <GlassCard padding="md">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: `${personaCfg.color}20`, color: personaCfg.color }}>
              {personaCfg.icon}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-base font-bold text-[var(--text-primary)]">Current: {personaCfg.title}</span>
                <CheckCircle className="w-4 h-4" style={{ color: personaCfg.color }} />
              </div>
              <p className="text-sm text-[var(--text-muted)]">{personaCfg.desc}</p>
              {personaData.config && (
                <div className="flex flex-wrap gap-3 mt-3">
                  {Object.entries(personaData.config as Record<string, any>).filter(([k]) => k !== "persona").map(([k, v]) => (
                    <div key={k} className="text-xs px-2 py-1 rounded-lg bg-[var(--surface-2)]">
                      <span className="text-[var(--text-muted)]">{k}:</span>{" "}
                      <span className="font-semibold text-[var(--text-primary)]">{typeof v === "number" ? v : String(v)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </GlassCard>
      )}

      {/* Quiz Flow */}
      {quizActive ? (
        <GlassCard padding="md">
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-[var(--text-muted)] font-semibold">QUESTION {quizStep + 1} OF {QUIZ_QUESTIONS.length}</span>
              <div className="flex gap-1">
                {QUIZ_QUESTIONS.map((_, i) => (
                  <div key={i} className="w-2 h-2 rounded-full" style={{ background: i <= quizStep ? "var(--purple)" : "var(--surface-2)" }} />
                ))}
              </div>
            </div>
            <h2 className="text-base font-bold text-[var(--text-primary)]">{QUIZ_QUESTIONS[quizStep].q}</h2>
          </div>
          <div className="space-y-2">
            {QUIZ_QUESTIONS[quizStep].options.map((opt, i) => (
              <button
                key={i}
                onClick={() => handleQuizAnswer(i)}
                disabled={submitQuiz.isPending}
                className="w-full text-left px-4 py-3 rounded-xl bg-[var(--surface-2)] hover:bg-[var(--surface)] border border-transparent hover:border-[var(--purple)] text-sm text-[var(--text-primary)] transition-all flex items-center justify-between"
              >
                {opt} <ChevronRight className="w-4 h-4 text-[var(--text-muted)]" />
              </button>
            ))}
          </div>
          <button onClick={() => { setQuizActive(false); setQuizStep(0); setQuizAnswers([]); }} className="mt-3 text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)]">Cancel quiz</button>
        </GlassCard>
      ) : (
        <>
          {/* Persona Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Object.entries(PERSONA_CONFIG).map(([key, cfg]) => {
              const isActive = currentPersona === key;
              return (
                <motion.div key={key} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                  <GlassCard padding="md" className={`cursor-pointer transition-all ${isActive ? "ring-2 ring-[var(--blue)]" : ""}`}>
                    <button
                      onClick={() => setPersona.mutate(key)}
                      disabled={setPersona.isPending}
                      className="w-full text-left"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${cfg.color}20`, color: cfg.color }}>
                          {cfg.icon}
                        </div>
                        {isActive && <CheckCircle className="w-4 h-4" style={{ color: cfg.color }} />}
                      </div>
                      <h3 className="font-bold text-[var(--text-primary)] mb-1">{cfg.title}</h3>
                      <p className="text-xs text-[var(--text-muted)] leading-relaxed">{cfg.desc}</p>
                    </button>
                  </GlassCard>
                </motion.div>
              );
            })}
          </div>

          <GlassCard padding="md">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-[var(--text-primary)]">Not sure which fits you?</h3>
                <p className="text-sm text-[var(--text-muted)] mt-0.5">Take our 4-question quiz to find your optimal trading persona</p>
              </div>
              <button
                onClick={() => setQuizActive(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--purple)] text-white text-sm font-semibold hover:opacity-90 whitespace-nowrap"
              >
                Take Quiz <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </GlassCard>
        </>
      )}
    </div>
  );
}
