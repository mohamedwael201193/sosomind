/**
 * Funding Rate Contrarian Signals (Part 15)
 * Analyzes SoDEX perps funding rates to generate contrarian signals.
 * High positive funding → overcrowded longs → bearish contrarian.
 * High negative funding → overcrowded shorts → bullish contrarian.
 */

import { sodex } from '../clients/sodex';
import { supabase } from '../db/supabase';

export interface FundingSignal {
  asset: string;
  funding_rate: number;       // Current 8h funding rate
  annualized_rate: number;    // Annualized (×3×365)
  signal: 'strong_buy' | 'buy' | 'neutral' | 'sell' | 'strong_sell';
  strength: number;           // 0-100
  reasoning: string;
  perps_symbol?: string;
  created_at?: string;
}

const ASSETS = ['BTC', 'ETH', 'SOL', 'BNB', 'AVAX'];
const SYMBOL_MAP: Record<string, string> = {
  BTC: 'vBTC-vUSDC-PERP',
  ETH: 'vETH-vUSDC-PERP',
  SOL: 'vSOL-vUSDC-PERP',
  BNB: 'vBNB-vUSDC-PERP',
  AVAX: 'vAVAX-vUSDC-PERP',
};

function getFundingSignal(
  asset: string,
  fundingRate: number,
  perpsSymbol: string
): FundingSignal {
  const annualized = fundingRate * 3 * 365 * 100; // Convert to %
  const absAnnualized = Math.abs(annualized);

  let signal: FundingSignal['signal'];
  let strength: number;
  let reasoning: string;

  if (fundingRate > 0.001) { // Positive funding > 0.1% per 8h = longs paying
    if (fundingRate > 0.003) { // >0.3% = extremely crowded longs
      signal = 'strong_sell';
      strength = Math.min(90, 60 + absAnnualized / 2);
      reasoning = `Funding rate ${(fundingRate * 100).toFixed(3)}% (${annualized.toFixed(0)}% annualized) — EXTREME long crowding. Contrarian: high probability of long squeeze. Shorts recommended.`;
    } else {
      signal = 'sell';
      strength = Math.min(75, 40 + absAnnualized);
      reasoning = `Funding rate ${(fundingRate * 100).toFixed(3)}% (${annualized.toFixed(0)}% annualized) — elevated longs, longs paying shorts. Contrarian signal: reduce long exposure.`;
    }
  } else if (fundingRate < -0.001) { // Negative funding = shorts paying
    if (fundingRate < -0.003) {
      signal = 'strong_buy';
      strength = Math.min(90, 60 + absAnnualized / 2);
      reasoning = `Funding rate ${(fundingRate * 100).toFixed(3)}% (${annualized.toFixed(0)}% annualized) — EXTREME short crowding. Contrarian: high probability of short squeeze. Longs recommended.`;
    } else {
      signal = 'buy';
      strength = Math.min(75, 40 + absAnnualized);
      reasoning = `Funding rate ${(fundingRate * 100).toFixed(3)}% (${annualized.toFixed(0)}% annualized) — elevated shorts, shorts paying longs. Contrarian signal: good long setup.`;
    }
  } else {
    signal = 'neutral';
    strength = 30;
    reasoning = `Funding rate ${(fundingRate * 100).toFixed(3)}% — neutral, balanced longs/shorts. No strong contrarian edge.`;
  }

  return {
    asset,
    funding_rate: parseFloat(fundingRate.toFixed(6)),
    annualized_rate: parseFloat(annualized.toFixed(2)),
    signal,
    strength: Math.round(strength),
    reasoning,
    perps_symbol: perpsSymbol,
  };
}

export async function runFundingRateScan(): Promise<FundingSignal[]> {
  const results: FundingSignal[] = [];

  for (const asset of ASSETS) {
    const symbol = SYMBOL_MAP[asset];
    if (!symbol) continue;
    try {
      const data: any = await sodex.getPerpsFundingRate(symbol);
      // SoDEX returns mark price data with funding rate embedded
      const rate = Number(
        data?.fundingRate ?? data?.funding_rate ?? data?.nextFundingRate ?? data?.currentFundingRate ?? 0
      );
      if (rate === 0) continue;
      const fs = getFundingSignal(asset, rate, symbol);
      results.push(fs);

      // Persist to DB
      try {
        await supabase.from('funding_signals').upsert({
          asset,
          funding_rate: fs.funding_rate,
          annualized_rate: fs.annualized_rate,
          signal: fs.signal,
          strength: fs.strength,
          reasoning: fs.reasoning,
        }, { onConflict: 'asset' });
      } catch { /* ignore */ }
    } catch { /* ignore */ }
  }

  // If no live data, try getting from mark prices bulk
  if (results.length === 0) {
    try {
      const markPrices: any = await sodex.getPerpsMarkPrices();
      const list = Array.isArray(markPrices) ? markPrices : markPrices?.data ?? [];
      for (const item of list) {
        const name: string = String(item.symbol ?? item.name ?? '');
        const asset = ASSETS.find(a => name.includes(a));
        if (!asset) continue;
        const rate = Number(item.fundingRate ?? item.funding_rate ?? 0);
        if (rate === 0) continue;
        const fs = getFundingSignal(asset, rate, name);
        results.push(fs);
      }
    } catch { /* ignore */ }
  }

  return results;
}

export async function getFundingSignals(limit = 10): Promise<FundingSignal[]> {
  const { data } = await supabase
    .from('funding_signals')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  return (data ?? []) as FundingSignal[];
}

export function formatFundingAlert(fs: FundingSignal): string {
  const emoji = {
    strong_buy: '🟢🟢',
    buy: '🟢',
    neutral: '⚪',
    sell: '🔴',
    strong_sell: '🔴🔴',
  }[fs.signal];
  return (
    `${emoji} <b>Funding Rate Signal — ${fs.asset}</b>\n` +
    `📊 Rate: <code>${(fs.funding_rate * 100).toFixed(3)}%</code> per 8h (<code>${fs.annualized_rate.toFixed(0)}%</code> annualized)\n` +
    `⚡ Signal: <b>${fs.signal.replace(/_/g, ' ').toUpperCase()}</b> | Strength: ${fs.strength}/100\n\n` +
    `💡 ${fs.reasoning}`
  );
}
