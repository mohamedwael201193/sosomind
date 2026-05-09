/**
 * Multi-Timeframe Confluence Engine (Part 8)
 * Analyzes 6 timeframes in parallel to determine overall trend direction.
 * Confluence score 0-100: higher = stronger agreement across timeframes.
 */

import { getBinanceKlines } from '../clients/market';

export interface TimeframeAnalysis {
  timeframe: string;
  direction: 'LONG' | 'SHORT' | 'NEUTRAL';
  strength: number;     // 0-100
  ema20: number;
  ema50: number;
  rsi: number;
  trend_score: number;  // -3 to +3
}

export interface ConfluenceSignal {
  asset: string;
  overall_direction: 'STRONG_LONG' | 'LONG' | 'NEUTRAL' | 'SHORT' | 'STRONG_SHORT';
  confluence_score: number;  // 0-100
  timeframes: TimeframeAnalysis[];
  timeframes_agreeing: number;
  total_timeframes: number;
  recommendation: string;
  created_at: string;
}

const TIMEFRAMES = ['5m', '15m', '1h', '4h', '1d', '3d'];

function ema(values: number[], period: number): number[] {
  if (values.length === 0) return [];
  const k = 2 / (period + 1);
  const result: number[] = [values[0]];
  for (let i = 1; i < values.length; i++) {
    result.push(values[i] * k + result[i - 1] * (1 - k));
  }
  return result;
}

function rsi(closes: number[], period = 14): number {
  if (closes.length < period + 1) return 50;
  let gains = 0;
  let losses = 0;
  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff > 0) gains += diff;
    else losses += Math.abs(diff);
  }
  const avgGain = gains / period;
  const avgLoss = losses / period;
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

async function analyzeTimeframe(asset: string, tf: string): Promise<TimeframeAnalysis | null> {
  try {
    const klines = await getBinanceKlines(asset, tf, 60);
    if (!klines || klines.length < 20) return null;

    const closes = klines.map(k => typeof k.close === 'number' ? k.close : parseFloat(String(k.close)));
    const ema20 = ema(closes, 20);
    const ema50 = ema(closes, 50);
    const currentClose = closes[closes.length - 1];
    const currentEma20 = ema20[ema20.length - 1];
    const currentEma50 = ema50[ema50.length - 1] ?? currentEma20;
    const currentRsi = rsi(closes);

    let trendScore = 0;
    // Price vs EMA20
    if (currentClose > currentEma20) trendScore += 1;
    else trendScore -= 1;
    // EMA20 vs EMA50
    if (currentEma20 > currentEma50) trendScore += 1;
    else trendScore -= 1;
    // RSI signal
    if (currentRsi > 55) trendScore += 1;
    else if (currentRsi < 45) trendScore -= 1;

    const direction: TimeframeAnalysis['direction'] =
      trendScore >= 2 ? 'LONG' : trendScore <= -2 ? 'SHORT' : 'NEUTRAL';
    const strength = Math.min(100, Math.abs(trendScore) * 30 + 10);

    return {
      timeframe: tf,
      direction,
      strength,
      ema20: parseFloat(currentEma20.toFixed(4)),
      ema50: parseFloat(currentEma50.toFixed(4)),
      rsi: parseFloat(currentRsi.toFixed(1)),
      trend_score: trendScore,
    };
  } catch {
    return null;
  }
}

export async function runConfluenceAnalysis(asset: string): Promise<ConfluenceSignal> {
  const analyses = await Promise.all(TIMEFRAMES.map(tf => analyzeTimeframe(asset, tf)));
  const valid = analyses.filter(Boolean) as TimeframeAnalysis[];

  if (valid.length === 0) {
    return {
      asset,
      overall_direction: 'NEUTRAL',
      confluence_score: 0,
      timeframes: [],
      timeframes_agreeing: 0,
      total_timeframes: TIMEFRAMES.length,
      recommendation: 'Insufficient data for confluence analysis',
      created_at: new Date().toISOString(),
    };
  }

  const longs = valid.filter(t => t.direction === 'LONG').length;
  const shorts = valid.filter(t => t.direction === 'SHORT').length;
  const neutrals = valid.filter(t => t.direction === 'NEUTRAL').length;

  const totalScore = valid.reduce((s, t) => s + t.trend_score, 0);
  const avgScore = totalScore / valid.length;

  let overall: ConfluenceSignal['overall_direction'];
  let timeframesAgreeing: number;

  if (avgScore >= 2) { overall = 'STRONG_LONG'; timeframesAgreeing = longs; }
  else if (avgScore >= 1) { overall = 'LONG'; timeframesAgreeing = longs; }
  else if (avgScore <= -2) { overall = 'STRONG_SHORT'; timeframesAgreeing = shorts; }
  else if (avgScore <= -1) { overall = 'SHORT'; timeframesAgreeing = shorts; }
  else { overall = 'NEUTRAL'; timeframesAgreeing = neutrals; }

  const confluenceScore = Math.min(100, Math.round(
    (Math.max(longs, shorts) / valid.length) * 100 + Math.abs(avgScore) * 10
  ));

  let recommendation: string;
  if (overall === 'STRONG_LONG') recommendation = `All ${longs}/${valid.length} timeframes bullish — high conviction LONG. Enter with larger position.`;
  else if (overall === 'LONG') recommendation = `${longs}/${valid.length} timeframes bullish — moderate LONG. Standard position size.`;
  else if (overall === 'STRONG_SHORT') recommendation = `All ${shorts}/${valid.length} timeframes bearish — high conviction SHORT. Caution advised.`;
  else if (overall === 'SHORT') recommendation = `${shorts}/${valid.length} timeframes bearish — moderate SHORT. Reduce position size.`;
  else recommendation = `Mixed signals (${longs}L/${shorts}S/${neutrals}N) — wait for clearer setup or reduce size significantly.`;

  return {
    asset,
    overall_direction: overall,
    confluence_score: confluenceScore,
    timeframes: valid,
    timeframes_agreeing: timeframesAgreeing,
    total_timeframes: valid.length,
    recommendation,
    created_at: new Date().toISOString(),
  };
}
