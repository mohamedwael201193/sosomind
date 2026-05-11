/**
 * Sector Intelligence Engine
 * Computes a multi-signal score for each of the 13 SSI sectors.
 *
 * Three signals (weighted):
 *  Signal 1 (30%) — Fundraising activity: count of recent raises matching the sector
 *  Signal 2 (35%) — On-chain institutional momentum: BTC treasury purchases + crypto stock flows
 *  Signal 3 (35%) — ETF flow health: net flow z-score with macro proximity penalty
 *
 * Final score = s1×0.30 + s2×0.35 + s3×0.35  (0–100)
 * Verdict: STRONG_BUY ≥75 | BUY ≥55 | NEUTRAL ≥35 | SELL <35
 */
import { sosovalue } from '../clients/sosovalue';
import { chatComplete, ChatMessage } from '../clients/ai';
import { cachedFetch } from '../clients/redis';

export type IntelVerdict = 'STRONG_BUY' | 'BUY' | 'NEUTRAL' | 'SELL';

export interface SectorIntelResult {
  sector: string;
  ticker: string;
  score: number;        // 0–100 composite
  s1: number;           // Signal 1: fundraising activity (0–100)
  s2: number;           // Signal 2: institutional momentum (0–100)
  s3: number;           // Signal 3: ETF flow health (0–100)
  verdict: IntelVerdict;
  topAssets: string[];
  aiNarrative: string;
  cachedAt: string;
  source: 'live' | 'fallback';
}

const SSI_SECTOR_MAP: Record<string, string> = {
  ssiDeFi: 'DeFi',
  ssiAI: 'AI',
  ssiLayer1: 'Layer 1',
  ssiLayer2: 'Layer 2',
  ssiRWA: 'RWA',
  ssiNFT: 'NFT',
  ssiMeme: 'Meme',
  ssiGameFi: 'Gaming',
  ssiMAG7: 'Mag7 Stocks',
  ssiPayFi: 'PayFi',
  ssiCeFi: 'CeFi',
  ssiSocialFi: 'SocialFi',
  ssiDePIN: 'DePIN',
};

const SSI_TICKERS = Object.keys(SSI_SECTOR_MAP);

// Keywords used to match fundraising projects to sectors
const SECTOR_KEYWORDS: Record<string, string[]> = {
  DeFi: ['defi', 'dex', 'swap', 'lending', 'yield', 'liquidity', 'amm'],
  AI: ['ai', 'artificial intelligence', 'machine learning', 'llm', 'inference', 'compute'],
  'Layer 1': ['layer 1', 'l1', 'blockchain', 'consensus', 'validator'],
  'Layer 2': ['layer 2', 'l2', 'rollup', 'scaling', 'optimism', 'arbitrum', 'zk'],
  RWA: ['rwa', 'real world', 'tokenized', 'asset backed', 'treasury', 'bond'],
  NFT: ['nft', 'non-fungible', 'digital art', 'collectible', 'metaverse marketplace'],
  Meme: ['meme', 'community token', 'dog', 'frog', 'viral'],
  Gaming: ['gaming', 'game', 'play to earn', 'p2e', 'guild', 'nft game'],
  'Mag7 Stocks': ['mag7', 'tech stock', 'equity', 'nasdaq'],
  PayFi: ['payfi', 'payment', 'remittance', 'stablecoin payment', 'fintech'],
  CeFi: ['cefi', 'centralized', 'exchange', 'cex', 'custody', 'prime broker'],
  SocialFi: ['socialfi', 'social', 'creator', 'fan token', 'community'],
  DePIN: ['depin', 'physical infrastructure', 'iot', 'network provider', 'bandwidth'],
};

async function safe<T>(p: Promise<T>): Promise<T | null> {
  try { return await p; } catch { return null; }
}

function clamp(v: number, lo = 0, hi = 100) {
  return Math.min(hi, Math.max(lo, v));
}

function verdictFor(score: number): IntelVerdict {
  if (score >= 75) return 'STRONG_BUY';
  if (score >= 55) return 'BUY';
  if (score >= 35) return 'NEUTRAL';
  return 'SELL';
}

/** Signal 1 — Fundraising activity score (0–100) */
async function computeS1(sectorName: string, allProjects: any[]): Promise<number> {
  const keywords = SECTOR_KEYWORDS[sectorName] ?? [sectorName.toLowerCase()];
  const matches = allProjects.filter((p: any) => {
    const text = `${p.project_name ?? ''} ${p.description ?? ''} ${p.category ?? ''}`.toLowerCase();
    return keywords.some((kw) => text.includes(kw));
  });
  // Normalise: 0 matches → 0, 10+ matches → 100
  return clamp(matches.length * 10);
}

/** Signal 2 — Institutional momentum (0–100) */
async function computeS2(
  btcTreasuries: any[] | null,
  stockList: any[] | null,
): Promise<number> {
  // BTC treasury component: recent purchase count (last 30 days proxy = any entry in list)
  const btcScore = btcTreasuries ? clamp(Math.min(btcTreasuries.length * 2, 60)) : 30;

  // Crypto stock 7-day price performance component
  let stockScore = 50;
  if (stockList && stockList.length > 0) {
    const perfs: number[] = stockList
      .map((s: any) => Number(s.price_change_percent_7d ?? s.change_7d ?? 0))
      .filter((n) => !isNaN(n));
    if (perfs.length > 0) {
      const avg = perfs.reduce((a, b) => a + b, 0) / perfs.length;
      stockScore = clamp(50 + avg * 3); // ±1% moves ±3 points
    }
  }

  return clamp(btcScore * 0.4 + stockScore * 0.6);
}

/** Signal 3 — ETF flow health (0–100) */
async function computeS3(
  etfList: any[] | null,
  macroEvents: any[] | null,
): Promise<number> {
  // ETF net flow component
  let flowScore = 50;
  if (etfList && etfList.length > 0) {
    const flows: number[] = etfList
      .map((e: any) => Number(e.net_flow ?? e.net_inflow ?? e.flow_usd ?? 0))
      .filter((n) => !isNaN(n));
    if (flows.length > 0) {
      const mean = flows.reduce((a, b) => a + b, 0) / flows.length;
      const variance = flows.reduce((a, b) => a + (b - mean) ** 2, 0) / flows.length;
      const stdDev = Math.sqrt(variance) || 1;
      // z-score of most recent flow
      const lastFlow = flows[flows.length - 1] ?? 0;
      const zScore = (lastFlow - mean) / stdDev;
      flowScore = clamp(50 + zScore * 15); // ±1 std ±15 pts
    }
  }

  // Macro proximity penalty: upcoming high-impact event within 7 days
  let penalty = 0;
  if (macroEvents && macroEvents.length > 0) {
    const now = Date.now();
    const sevenDays = 7 * 24 * 3600 * 1000;
    const upcoming = macroEvents.filter((e: any) => {
      const ts = new Date(e.event_time ?? e.date ?? 0).getTime();
      return ts > now && ts - now < sevenDays && String(e.importance ?? '').toLowerCase() === 'high';
    });
    penalty = Math.min(20, upcoming.length * 7); // up to -20 pts for macro risk
  }

  return clamp(flowScore - penalty);
}

/** Build a short AI narrative for a sector (2 sentences). Returns empty string on failure. */
async function buildNarrative(
  sectorName: string,
  score: number,
  verdict: IntelVerdict,
  s1: number,
  s2: number,
  s3: number,
): Promise<string> {
  const messages: ChatMessage[] = [
    {
      role: 'system',
      content: 'You are a terse crypto sector analyst. Respond ONLY with valid JSON: {"narrative":"..."}',
    },
    {
      role: 'user',
      content: `Sector: ${sectorName}. Composite score: ${score}/100. Verdict: ${verdict}. Fundraising signal: ${s1}. Institutional signal: ${s2}. ETF flow signal: ${s3}. Write a 2-sentence investment thesis for this sector right now. Be specific and data-driven. No fluff.`,
    },
  ];

  try {
    const resp = await chatComplete(messages, 0.3);
    if (!resp) return '';
    const parsed = JSON.parse(resp.content);
    return (parsed.narrative as string) ?? '';
  } catch {
    return '';
  }
}

/** Compute intelligence score for a single sector ticker (5-min Redis cache). */
export async function computeSectorScore(ticker: string): Promise<SectorIntelResult> {
  return cachedFetch<SectorIntelResult>(
    `intel:sector:${ticker}`,
    async () => {
      const sectorName = SSI_SECTOR_MAP[ticker];
      if (!sectorName) throw new Error(`Unknown ticker: ${ticker}`);

      const [fundraisingRaw, btcTreasuries, stockList, etfListRaw, macroEvents] = await Promise.all([
        safe(sosovalue.getFundraisingProjects({ page_size: 100 })),
        safe(sosovalue.getBTCTreasuries()),
        safe(sosovalue.getCryptoStockList()),
        safe(sosovalue.getETFList('BTC')),
        safe(sosovalue.getMacroEvents()),
      ]);

      // Normalise fundraising response
      const allProjects: any[] = Array.isArray(fundraisingRaw)
        ? fundraisingRaw
        : (fundraisingRaw as any)?.list ?? (fundraisingRaw as any)?.data ?? [];

      // Normalise ETF list
      const etfList: any[] = Array.isArray(etfListRaw)
        ? etfListRaw
        : (etfListRaw as any)?.list ?? (etfListRaw as any)?.data ?? [];

      const [s1, s2, s3] = await Promise.all([
        computeS1(sectorName, allProjects),
        computeS2(btcTreasuries, stockList),
        computeS3(etfList, macroEvents),
      ]);

      const score = Math.round(s1 * 0.30 + s2 * 0.35 + s3 * 0.35);
      const verdict = verdictFor(score);

      // Extract top assets from ETF constituents if available
      let topAssets: string[] = [];
      if (etfList.length > 0) {
        topAssets = etfList
          .slice(0, 3)
          .map((e: any) => String(e.symbol ?? e.ticker ?? e.asset ?? ''))
          .filter(Boolean);
      }

      const aiNarrative = await buildNarrative(sectorName, score, verdict, s1, s2, s3);

      return {
        sector: sectorName,
        ticker,
        score,
        s1: Math.round(s1),
        s2: Math.round(s2),
        s3: Math.round(s3),
        verdict,
        topAssets,
        aiNarrative,
        cachedAt: new Date().toISOString(),
        source: 'live',
      };
    },
    300, // 5-minute cache
  );
}

/** Run intelligence scoring for all 13 SSI tickers. */
export async function runAllSectorIntel(): Promise<SectorIntelResult[]> {
  const results = await Promise.allSettled(SSI_TICKERS.map((t) => computeSectorScore(t)));
  return results
    .map((r, i) => {
      if (r.status === 'fulfilled') return r.value;
      const ticker = SSI_TICKERS[i];
      const sectorName = SSI_SECTOR_MAP[ticker];
      return {
        sector: sectorName,
        ticker,
        score: 50,
        s1: 50,
        s2: 50,
        s3: 50,
        verdict: 'NEUTRAL' as IntelVerdict,
        topAssets: [],
        aiNarrative: '',
        cachedAt: new Date().toISOString(),
        source: 'fallback' as const,
      };
    });
}
