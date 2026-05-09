/**
 * Social Sentiment Engine (Part 11)
 * Uses CryptoPanic news API + keyword analysis for sentiment scoring.
 * Falls back to title/content keyword analysis when no API key.
 */

import axios from 'axios';

export interface SentimentResult {
  asset: string;
  score: number;           // -100 to 100 (negative = bearish, positive = bullish)
  normalized: number;      // 0 to 100 (50 = neutral)
  label: 'very_bearish' | 'bearish' | 'neutral' | 'bullish' | 'very_bullish';
  volume: number;          // number of news articles analyzed
  positive_count: number;
  negative_count: number;
  neutral_count: number;
  top_headlines: string[];
  trending: boolean;
  updated_at: string;
}

const CRYPTOPANIC_BASE = 'https://cryptopanic.com/api/developer/v2';
const BEARISH_KEYWORDS = [
  'crash', 'dump', 'plunge', 'fall', 'bear', 'bearish', 'decline', 'drop',
  'sell', 'selling', 'selloff', 'outflow', 'hack', 'ban', 'banned', 'fraud',
  'scam', 'liquidation', 'liquidated', 'fear', 'panic', 'concern', 'warning',
  'risk', 'vulnerability', 'exploit', 'rug', 'collapse', 'crisis', 'debt',
];
const BULLISH_KEYWORDS = [
  'rally', 'surge', 'pump', 'rise', 'bull', 'bullish', 'gain', 'climb',
  'buy', 'buying', 'inflow', 'adoption', 'partnership', 'launch', 'upgrade',
  'approve', 'approved', 'etf', 'institutional', 'investment', 'milestone',
  'record', 'all-time', 'ath', 'breakout', 'accumulate', 'integration', 'growth',
];

function scoreHeadline(title: string): number {
  const lower = title.toLowerCase();
  let score = 0;
  for (const kw of BEARISH_KEYWORDS) {
    if (lower.includes(kw)) score -= 1;
  }
  for (const kw of BULLISH_KEYWORDS) {
    if (lower.includes(kw)) score += 1;
  }
  return score;
}

export async function getSentiment(asset: string): Promise<SentimentResult> {
  const coin = asset.toLowerCase().replace(/^v/, '');
  let headlines: { title: string; votes?: Record<string, number> }[] = [];

  // Try CryptoPanic API (free tier, no auth needed for basic)
  const apiKey = process.env.CRYPTOPANIC_API_KEY ?? '';
  const url = apiKey
    ? `${CRYPTOPANIC_BASE}/posts/?auth_token=${apiKey}&currencies=${coin}&public=true`
    : `${CRYPTOPANIC_BASE}/posts/?currencies=${coin}&public=true`;

  try {
    const res = await axios.get(url, { timeout: 6000 });
    const results = res.data?.results ?? [];
    headlines = results.map((r: any) => ({
      title: String(r.title ?? ''),
      votes: r.votes ?? {},
    }));
  } catch {
    // Fallback: use SoSoValue news search
    try {
      const { sosovalue } = await import('../clients/sosovalue');
      const news: any = await sosovalue.searchNews(coin);
      const list = Array.isArray(news) ? news : news?.list ?? [];
      headlines = list.slice(0, 20).map((n: any) => ({
        title: String(n.title ?? n.headline ?? ''),
        votes: {},
      }));
    } catch { /* ignore */ }
  }

  if (headlines.length === 0) {
    return {
      asset: asset.toUpperCase(),
      score: 0,
      normalized: 50,
      label: 'neutral',
      volume: 0,
      positive_count: 0,
      negative_count: 0,
      neutral_count: 0,
      top_headlines: [],
      trending: false,
      updated_at: new Date().toISOString(),
    };
  }

  let positiveCount = 0;
  let negativeCount = 0;
  let neutralCount = 0;
  let totalScore = 0;
  const topHeadlines: string[] = [];

  for (const item of headlines.slice(0, 30)) {
    let itemScore = scoreHeadline(item.title);

    // Weight by CryptoPanic votes if available
    if (item.votes && typeof item.votes === 'object') {
      const bullish = Number(item.votes.positive ?? 0);
      const bearish = Number(item.votes.negative ?? 0);
      if (bullish + bearish > 0) {
        itemScore += (bullish - bearish) * 0.3;
      }
    }

    if (itemScore > 0) positiveCount++;
    else if (itemScore < 0) negativeCount++;
    else neutralCount++;

    totalScore += itemScore;
    if (topHeadlines.length < 5) topHeadlines.push(item.title);
  }

  const avgScore = totalScore / headlines.length;
  const clampedScore = Math.max(-100, Math.min(100, avgScore * 25));
  const normalized = Math.round(50 + clampedScore / 2);

  let label: SentimentResult['label'];
  if (clampedScore >= 40) label = 'very_bullish';
  else if (clampedScore >= 15) label = 'bullish';
  else if (clampedScore <= -40) label = 'very_bearish';
  else if (clampedScore <= -15) label = 'bearish';
  else label = 'neutral';

  const trending = headlines.length >= 10 && Math.abs(clampedScore) >= 20;

  return {
    asset: asset.toUpperCase(),
    score: parseFloat(clampedScore.toFixed(1)),
    normalized,
    label,
    volume: headlines.length,
    positive_count: positiveCount,
    negative_count: negativeCount,
    neutral_count: neutralCount,
    top_headlines: topHeadlines,
    trending,
    updated_at: new Date().toISOString(),
  };
}
