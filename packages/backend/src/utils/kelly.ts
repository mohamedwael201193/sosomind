/**
 * Kelly Criterion Position Sizing (Part 10)
 * Calculates optimal position size based on win rate, avg win/loss, confidence.
 * Implements fractional Kelly (0.5x) to reduce drawdown in practice.
 */

export interface KellySizingInput {
  winRate: number;       // 0-1 (e.g. 0.6 = 60% win rate)
  avgWinPct: number;     // Average win as decimal (e.g. 0.08 = 8%)
  avgLossPct: number;    // Average loss as decimal (e.g. 0.04 = 4%)
  portfolioValue: number; // Total portfolio value in USD
  confidence?: number;   // Signal confidence 0-100 (scales the fraction)
  maxFraction?: number;  // Hard cap (default 0.25 = 25%)
  kellyFraction?: number; // How much of full Kelly to use (default 0.5)
}

export interface PositionSizing {
  kellyFraction: number;   // Full Kelly fraction (0-1)
  adjustedFraction: number;// Scaled by confidence + fractional Kelly
  positionUsd: number;     // Recommended position in USD
  positionPct: number;     // Recommended position as % of portfolio
  stopLossDistance: number;// Implied stop-loss distance %
  riskUsd: number;         // Dollar risk (if stop is hit)
  rationale: string;
}

export function calculateKellySizing(input: KellySizingInput): PositionSizing {
  const {
    winRate,
    avgWinPct,
    avgLossPct,
    portfolioValue,
    confidence = 75,
    maxFraction = 0.25,
    kellyFraction: kellyScale = 0.5,
  } = input;

  // Guard against edge cases
  if (winRate <= 0 || winRate >= 1 || avgLossPct <= 0 || portfolioValue <= 0) {
    return {
      kellyFraction: 0,
      adjustedFraction: 0,
      positionUsd: 0,
      positionPct: 0,
      stopLossDistance: avgLossPct,
      riskUsd: 0,
      rationale: 'Insufficient data for Kelly calculation — use default 2% risk',
    };
  }

  // Kelly formula: f* = (b*p - q) / b
  // where b = avgWin/avgLoss, p = winRate, q = 1 - winRate
  const b = avgWinPct / avgLossPct;
  const p = winRate;
  const q = 1 - winRate;
  const fullKelly = Math.max(0, (b * p - q) / b);

  // Scale down: fractional Kelly × confidence factor
  const confidenceFactor = confidence / 100;
  const adjusted = Math.min(maxFraction, fullKelly * kellyScale * confidenceFactor);

  const positionUsd = portfolioValue * adjusted;
  const positionPct = adjusted * 100;
  const riskUsd = positionUsd * avgLossPct;

  let rationale: string;
  if (fullKelly <= 0) {
    rationale = `Edge is negative (W:${(winRate * 100).toFixed(0)}%, R:R ${b.toFixed(2)}) — avoid this trade`;
  } else if (fullKelly < 0.05) {
    rationale = `Low edge (full Kelly ${(fullKelly * 100).toFixed(1)}%) — small position justified`;
  } else {
    rationale = `Kelly suggests ${(fullKelly * 100).toFixed(1)}% → scaled to ${positionPct.toFixed(1)}% (${kellyScale * 100}% Kelly × ${confidence}% confidence)`;
  }

  return {
    kellyFraction: parseFloat(fullKelly.toFixed(4)),
    adjustedFraction: parseFloat(adjusted.toFixed(4)),
    positionUsd: parseFloat(positionUsd.toFixed(2)),
    positionPct: parseFloat(positionPct.toFixed(2)),
    stopLossDistance: avgLossPct,
    riskUsd: parseFloat(riskUsd.toFixed(2)),
    rationale,
  };
}

/**
 * Estimate win rate and avg win/loss from historical signals in DB
 */
export interface TradeStats {
  winRate: number;
  avgWinPct: number;
  avgLossPct: number;
  totalTrades: number;
}

export function calcTradeStats(trades: Array<{ pnl_pct?: number | null }>): TradeStats {
  const closed = trades.filter(t => t.pnl_pct != null);
  if (closed.length === 0) {
    // Default conservative stats for new users
    return { winRate: 0.55, avgWinPct: 0.06, avgLossPct: 0.03, totalTrades: 0 };
  }
  const wins = closed.filter(t => (t.pnl_pct ?? 0) > 0);
  const losses = closed.filter(t => (t.pnl_pct ?? 0) <= 0);
  const winRate = wins.length / closed.length;
  const avgWinPct = wins.length > 0
    ? wins.reduce((s, t) => s + (t.pnl_pct ?? 0), 0) / wins.length / 100
    : 0.06;
  const avgLossPct = losses.length > 0
    ? Math.abs(losses.reduce((s, t) => s + (t.pnl_pct ?? 0), 0) / losses.length) / 100
    : 0.03;
  return { winRate, avgWinPct, avgLossPct, totalTrades: closed.length };
}
