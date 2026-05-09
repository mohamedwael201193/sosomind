// Portfolio stress test simulator.
// Given current open positions, simulate impact of asset price changes.

import { supabase } from '../db/supabase';
import { sosovalue } from '../clients/sosovalue';

export interface StressScenario {
  name: string;
  // Map of base asset symbol → fractional change, e.g. { BTC: -0.20, ETH: -0.15 }
  assetChanges: Record<string, number>;
}

export interface PositionImpact {
  market: string;
  asset: string;
  side: string;
  size: number;
  entry: number;
  currentMark: number;
  scenarioMark: number;
  pnlBefore: number;
  pnlAfter: number;
  pnlDelta: number;
}

export interface StressResult {
  scenario: StressScenario;
  totalValueBefore: number;
  totalValueAfter: number;
  drawdownPct: number;
  positions: PositionImpact[];
  liquidations: string[];   // markets that would liquidate
  worstLoser?: PositionImpact;
}

const PRESET_SCENARIOS: StressScenario[] = [
  { name: 'BTC -20%', assetChanges: { BTC: -0.20 } },
  { name: 'ETH -25%', assetChanges: { ETH: -0.25 } },
  { name: 'Crypto crash -30%', assetChanges: { BTC: -0.30, ETH: -0.30, SOL: -0.40 } },
  { name: 'Alt season +50%', assetChanges: { SOL: 0.50, AVAX: 0.40, LINK: 0.30, ARB: 0.45 } },
  { name: 'Flash crash -10%', assetChanges: { BTC: -0.10, ETH: -0.10, SOL: -0.15 } },
];

export function listPresetScenarios(): StressScenario[] { return PRESET_SCENARIOS; }

export async function runStressTest(scenario: StressScenario): Promise<StressResult> {
  const { data: positions, error } = await supabase
    .from('positions')
    .select('*')
    .eq('status', 'open');
  if (error) throw new Error(error.message);

  const allPositions = positions || [];
  const symbols = Array.from(new Set(allPositions.map((p: any) => extractAsset(p.market))));

  // Fetch current marks
  const markMap = new Map<string, number>();
  await Promise.all(symbols.map(async (sym) => {
    try {
      const snap: any = await sosovalue.getMarketSnapshot(sym);
      const p = Number(snap?.price ?? 0);
      if (Number.isFinite(p) && p > 0) markMap.set(sym, p);
    } catch { /* leave undefined */ }
  }));

  let totalBefore = 0;
  let totalAfter = 0;
  const liquidations: string[] = [];
  const impacts: PositionImpact[] = [];

  for (const p of allPositions) {
    const asset = extractAsset(p.market);
    const size = Number(p.size);
    const entry = Number(p.entry_price);
    const mark = markMap.get(asset) ?? entry;
    const sideMul = p.side === 'short' ? -1 : 1;
    const change = scenario.assetChanges[asset] ?? 0;
    const scenarioMark = mark * (1 + change);

    const pnlBefore = (mark - entry) * size * sideMul;
    const pnlAfter = (scenarioMark - entry) * size * sideMul;
    const valueAfter = scenarioMark * size;

    totalBefore += mark * size;
    totalAfter += valueAfter;

    // Naive liquidation: if loss > 90% of position value
    if (pnlAfter < -(entry * size * 0.9)) liquidations.push(p.market);

    impacts.push({
      market: p.market,
      asset,
      side: p.side,
      size,
      entry,
      currentMark: mark,
      scenarioMark,
      pnlBefore,
      pnlAfter,
      pnlDelta: pnlAfter - pnlBefore,
    });
  }

  const worstLoser = impacts.slice().sort((a, b) => a.pnlDelta - b.pnlDelta)[0];
  const drawdownPct = totalBefore > 0 ? ((totalBefore - totalAfter) / totalBefore) * 100 : 0;

  return {
    scenario,
    totalValueBefore: totalBefore,
    totalValueAfter: totalAfter,
    drawdownPct,
    positions: impacts,
    liquidations,
    worstLoser,
  };
}

function extractAsset(market: string): string {
  if (!market) return '';
  // "vBTC_vUSDC" → "BTC", "BTC-USDC" → "BTC"
  const base = market.split(/[_\-]/)[0];
  return base.replace(/^v/i, '').toUpperCase();
}
