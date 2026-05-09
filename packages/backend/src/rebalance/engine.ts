/**
 * AI Portfolio Rebalancer (Part 6)
 * Recommends optimal portfolio allocation based on sector momentum,
 * macro regime, and user's persona risk profile.
 */

import { sosovalue } from '../clients/sosovalue';
import { getUserPersona, PERSONAS, PersonaType } from '../agents/persona';

export interface AllocationItem {
  asset: string;
  sector: string;
  current_pct: number;
  recommended_pct: number;
  change_pct: number;
  momentum_score: number;
  reasoning: string;
}

export interface RebalanceRecommendation {
  user_id?: string;
  persona: PersonaType;
  current_portfolio_value: number;
  risk_score: number;         // 0-100, higher = more risk
  macro_regime: 'risk_on' | 'risk_off' | 'neutral';
  allocations: AllocationItem[];
  cash_pct: number;
  recommended_cash_pct: number;
  rebalance_actions: string[];
  generated_at: string;
}

// Default sector assets to consider
const SECTOR_ASSETS = [
  { asset: 'BTC', sector: 'Store of Value' },
  { asset: 'ETH', sector: 'Smart Contracts' },
  { asset: 'SOL', sector: 'Smart Contracts' },
  { asset: 'AVAX', sector: 'Smart Contracts' },
  { asset: 'ARB', sector: 'Layer 2' },
  { asset: 'OP', sector: 'Layer 2' },
  { asset: 'UNI', sector: 'DeFi' },
  { asset: 'AAVE', sector: 'DeFi' },
  { asset: 'LINK', sector: 'Oracle' },
  { asset: 'BNB', sector: 'Exchange' },
];

// Persona-based allocation templates
const PERSONA_ALLOCATIONS: Record<PersonaType, Record<string, number>> = {
  aggressive: { 'Store of Value': 20, 'Smart Contracts': 35, 'Layer 2': 20, 'DeFi': 15, 'Oracle': 5, 'Exchange': 5 },
  balanced: { 'Store of Value': 35, 'Smart Contracts': 30, 'Layer 2': 15, 'DeFi': 10, 'Oracle': 5, 'Exchange': 5 },
  conservative: { 'Store of Value': 55, 'Smart Contracts': 25, 'Layer 2': 8, 'DeFi': 5, 'Oracle': 4, 'Exchange': 3 },
  quant: { 'Store of Value': 30, 'Smart Contracts': 32, 'Layer 2': 18, 'DeFi': 12, 'Oracle': 5, 'Exchange': 3 },
  swing: { 'Store of Value': 25, 'Smart Contracts': 35, 'Layer 2': 20, 'DeFi': 12, 'Oracle': 5, 'Exchange': 3 },
};

async function getSectorMomentum(): Promise<Map<string, number>> {
  const momentumMap = new Map<string, number>();
  try {
    const sectors: any = await sosovalue.getCryptoSectorIndex('all');
    const list = Array.isArray(sectors) ? sectors : sectors?.list ?? [];
    for (const s of list) {
      const name = String(s.name ?? s.sector ?? '');
      const change = Number(s.change_pct_24h ?? s.change24h ?? s.change ?? 0);
      momentumMap.set(name, change);
    }
  } catch { /* ignore */ }
  return momentumMap;
}

async function getMacroRegime(): Promise<'risk_on' | 'risk_off' | 'neutral'> {
  try {
    const macro: any = await sosovalue.getMacroEvents();
    const list = Array.isArray(macro) ? macro : macro?.list ?? [];
    let score = 0;
    for (const evt of list) {
      const name = String(evt.name ?? '').toLowerCase();
      const actual = Number(evt.actual ?? 0);
      const forecast = Number(evt.forecast ?? 0);
      // Good macro = beat forecast → risk_on
      if (actual < forecast && (name.includes('cpi') || name.includes('inflation'))) score += 2;
      if (actual > forecast && name.includes('employment')) score += 1;
      if (actual < forecast && name.includes('gdp')) score -= 1;
    }
    if (score >= 2) return 'risk_on';
    if (score <= -2) return 'risk_off';
    return 'neutral';
  } catch {
    return 'neutral';
  }
}

export async function generateRebalanceRecommendation(
  userId?: string,
  currentHoldings?: Record<string, number>, // asset → USD value
  portfolioValue = 10000
): Promise<RebalanceRecommendation> {
  const persona: PersonaType = userId ? await getUserPersona(userId) : 'balanced';
  const personaCfg = PERSONAS[persona];
  const sectorMomentum = await getSectorMomentum();
  const macroRegime = await getMacroRegime();

  const baseAlloc = PERSONA_ALLOCATIONS[persona];

  // Adjust based on macro regime
  let btcBoost = 0;
  let altBoost = 0;
  if (macroRegime === 'risk_on') { btcBoost = 5; altBoost = 5; }
  else if (macroRegime === 'risk_off') { btcBoost = 10; altBoost = -10; }

  const allocations: AllocationItem[] = [];
  const totalSectorPct = Object.values(baseAlloc).reduce((s, v) => s + v, 0);

  for (const { asset, sector } of SECTOR_ASSETS) {
    let sectorPct = baseAlloc[sector] ?? 5;
    const momentum = sectorMomentum.get(sector) ?? 0;

    // Adjust based on sector momentum (±5% max)
    const momentumAdj = Math.max(-5, Math.min(5, momentum * 0.5));

    // BTC/ETH specific macro adjustments
    let macroAdj = 0;
    if (asset === 'BTC') macroAdj = btcBoost;
    else if (['ARB', 'OP', 'UNI', 'AAVE'].includes(asset)) macroAdj = altBoost * 0.3;

    let recommendedPct = Math.max(0, (sectorPct / totalSectorPct) * 90 + momentumAdj + macroAdj);
    recommendedPct = Math.min(personaCfg.maxRiskPct * 3, recommendedPct); // cap per asset

    const currentUsd = currentHoldings?.[asset] ?? 0;
    const currentPct = portfolioValue > 0 ? (currentUsd / portfolioValue) * 100 : 0;

    let reasoning = `${sector} sector`;
    if (momentum > 2) reasoning += ` (momentum: +${momentum.toFixed(1)}% ↑)`;
    else if (momentum < -2) reasoning += ` (momentum: ${momentum.toFixed(1)}% ↓)`;
    if (macroAdj > 0) reasoning += ` + macro boost`;
    else if (macroAdj < 0) reasoning += ` - macro headwind`;

    allocations.push({
      asset,
      sector,
      current_pct: parseFloat(currentPct.toFixed(1)),
      recommended_pct: parseFloat(recommendedPct.toFixed(1)),
      change_pct: parseFloat((recommendedPct - currentPct).toFixed(1)),
      momentum_score: parseFloat(momentum.toFixed(1)),
      reasoning,
    });
  }

  // Normalize to sum to 90% (keep 10% cash as buffer)
  const totalRec = allocations.reduce((s, a) => s + a.recommended_pct, 0);
  const targetTotal = persona === 'conservative' ? 75 : persona === 'aggressive' ? 90 : 85;
  for (const a of allocations) {
    a.recommended_pct = parseFloat((a.recommended_pct / totalRec * targetTotal).toFixed(1));
    a.change_pct = parseFloat((a.recommended_pct - a.current_pct).toFixed(1));
  }

  const cashPct = 100 - allocations.reduce((s, a) => s + a.current_pct, 0);
  const recommendedCashPct = 100 - targetTotal;

  const rebalanceActions = allocations
    .filter(a => Math.abs(a.change_pct) >= 2)
    .sort((a, b) => Math.abs(b.change_pct) - Math.abs(a.change_pct))
    .slice(0, 5)
    .map(a => a.change_pct > 0
      ? `BUY ${a.asset}: increase by ${a.change_pct.toFixed(1)}% ($${(portfolioValue * a.change_pct / 100).toFixed(0)})`
      : `SELL ${a.asset}: reduce by ${Math.abs(a.change_pct).toFixed(1)}% ($${(portfolioValue * Math.abs(a.change_pct) / 100).toFixed(0)})`
    );

  const riskScore = persona === 'aggressive' ? 80
    : persona === 'balanced' ? 55
    : persona === 'conservative' ? 25
    : persona === 'quant' ? 60
    : 50;

  return {
    user_id: userId,
    persona,
    current_portfolio_value: portfolioValue,
    risk_score: riskScore,
    macro_regime: macroRegime,
    allocations,
    cash_pct: parseFloat(Math.max(0, cashPct).toFixed(1)),
    recommended_cash_pct: recommendedCashPct,
    rebalance_actions: rebalanceActions,
    generated_at: new Date().toISOString(),
  };
}
