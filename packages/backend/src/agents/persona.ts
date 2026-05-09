/**
 * AI Trader Persona System (Part 14)
 * 5 trading personas: Aggressive, Balanced, Conservative, Quant, Swing
 * Each persona filters/adjusts signals, position sizing, and bot tone.
 */

import { supabase } from '../db/supabase';

export type PersonaType = 'aggressive' | 'balanced' | 'conservative' | 'quant' | 'swing';

export interface PersonaConfig {
  name: PersonaType;
  displayName: string;
  emoji: string;
  description: string;
  minConfidence: number;     // Minimum signal confidence to act on
  maxRiskPct: number;        // Max position size as % of portfolio
  kellyScale: number;        // How much of Kelly to use (0-1)
  preferredTimeframes: string[];
  preferLong: boolean;
  allowShorts: boolean;
  minRR: number;             // Minimum risk:reward ratio
  tone: string;              // Bot message tone
}

export const PERSONAS: Record<PersonaType, PersonaConfig> = {
  aggressive: {
    name: 'aggressive',
    displayName: 'Aggressive Trader',
    emoji: '🔥',
    description: 'High risk, high reward. Acts on high-confidence signals with larger positions.',
    minConfidence: 65,
    maxRiskPct: 20,
    kellyScale: 0.8,
    preferredTimeframes: ['15m', '1h', '4h'],
    preferLong: false,
    allowShorts: true,
    minRR: 1.5,
    tone: 'bold and decisive',
  },
  balanced: {
    name: 'balanced',
    displayName: 'Balanced Trader',
    emoji: '⚖️',
    description: 'Steady growth with risk management. Follows high-quality signals.',
    minConfidence: 70,
    maxRiskPct: 10,
    kellyScale: 0.5,
    preferredTimeframes: ['1h', '4h', '1d'],
    preferLong: true,
    allowShorts: true,
    minRR: 2.0,
    tone: 'analytical and measured',
  },
  conservative: {
    name: 'conservative',
    displayName: 'Conservative Trader',
    emoji: '🛡️',
    description: 'Capital preservation first. Only very high confidence signals. Small positions.',
    minConfidence: 80,
    maxRiskPct: 5,
    kellyScale: 0.25,
    preferredTimeframes: ['4h', '1d'],
    preferLong: true,
    allowShorts: false,
    minRR: 3.0,
    tone: 'cautious and careful',
  },
  quant: {
    name: 'quant',
    displayName: 'Quant Trader',
    emoji: '🤖',
    description: 'Data-driven, systematic. Uses Kelly sizing and multi-timeframe confluence.',
    minConfidence: 72,
    maxRiskPct: 12,
    kellyScale: 0.6,
    preferredTimeframes: ['1h', '4h'],
    preferLong: false,
    allowShorts: true,
    minRR: 2.0,
    tone: 'precise and data-driven',
  },
  swing: {
    name: 'swing',
    displayName: 'Swing Trader',
    emoji: '📈',
    description: 'Captures medium-term moves. Holds positions for days/weeks.',
    minConfidence: 68,
    maxRiskPct: 8,
    kellyScale: 0.4,
    preferredTimeframes: ['4h', '1d'],
    preferLong: true,
    allowShorts: true,
    minRR: 2.5,
    tone: 'patient and trend-focused',
  },
};

export interface Signal {
  direction?: string;
  confidence?: number;
  timeframe?: string;
  risk_reward?: number;
  asset?: string;
}

/**
 * Filter a signal through persona settings.
 * Returns true if signal passes the persona's criteria.
 */
export function filterSignalByPersona(signal: Signal, persona: PersonaType): boolean {
  const cfg = PERSONAS[persona];
  if (!cfg) return true;

  const confidence = signal.confidence ?? 75;
  const direction = (signal.direction ?? 'LONG').toUpperCase();
  const rr = signal.risk_reward ?? 2;

  if (confidence < cfg.minConfidence) return false;
  if (direction === 'SHORT' && !cfg.allowShorts) return false;
  if (rr < cfg.minRR) return false;

  // Timeframe filter (if signal has a timeframe, it should match preferred)
  if (signal.timeframe && cfg.preferredTimeframes.length > 0) {
    const tf = signal.timeframe.toLowerCase().replace(' ', '');
    const preferred = cfg.preferredTimeframes.map(t => t.toLowerCase());
    if (!preferred.includes(tf)) return false;
  }

  return true;
}

/**
 * Get persona message prefix for bot responses
 */
export function getPersonaPrefix(persona: PersonaType): string {
  const cfg = PERSONAS[persona];
  if (!cfg) return '';
  return `${cfg.emoji} <b>[${cfg.displayName}]</b>`;
}

/**
 * Get user's persona from database
 */
export async function getUserPersona(userId: string): Promise<PersonaType> {
  try {
    const { data } = await supabase
      .from('user_profiles')
      .select('persona')
      .eq('wallet_address', userId)
      .single();
    const persona = data?.persona as PersonaType;
    if (persona && PERSONAS[persona]) return persona;
  } catch { /* ignore */ }
  return 'balanced';
}

/**
 * Set user's persona in database
 */
export async function setUserPersona(userId: string, persona: PersonaType): Promise<void> {
  const cfg = PERSONAS[persona];
  if (!cfg) throw new Error(`Invalid persona: ${persona}`);
  await supabase.from('user_profiles').upsert(
    { wallet_address: userId, persona, persona_config: cfg, onboarded: true, last_seen_at: new Date().toISOString() },
    { onConflict: 'wallet_address' }
  );
}

/**
 * Get persona quiz questions for onboarding
 */
export function getPersonaQuiz(): Array<{ question: string; options: string[] }> {
  return [
    {
      question: "What's your primary trading goal?",
      options: ['Maximum gains quickly', 'Steady portfolio growth', 'Preserve capital above all', 'Follow systematic rules', 'Capture big market swings'],
    },
    {
      question: 'How do you feel about losses?',
      options: ['Losses are part of big wins', 'I manage them carefully', 'I avoid losses at all costs', 'I use stop-losses always', 'I hold through dips for swing'],
    },
    {
      question: 'How long do you typically hold a trade?',
      options: ['Minutes to hours', 'Hours to days', 'Days to weeks', 'Based on signals/data', 'Days to weeks (swing)'],
    },
  ];
}

/**
 * Infer persona from quiz answers (index of selected option for each question)
 */
export function inferPersonaFromQuiz(answers: number[]): PersonaType {
  const scores: Record<PersonaType, number> = {
    aggressive: 0, balanced: 0, conservative: 0, quant: 0, swing: 0,
  };
  const personaOrder: PersonaType[] = ['aggressive', 'balanced', 'conservative', 'quant', 'swing'];
  for (const ans of answers) {
    const idx = Math.min(ans, personaOrder.length - 1);
    scores[personaOrder[idx]] = (scores[personaOrder[idx]] ?? 0) + 1;
  }
  return (Object.entries(scores).sort((a, b) => b[1] - a[1])[0][0]) as PersonaType;
}
