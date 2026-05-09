import { sosovalue } from '../clients/sosovalue';

export interface SectorScore {
  sector: string;
  name: string;
  momentum: number;
  fundraisingScore: number;
  priceScore: number;
  newsScore: number;
  trend: '↑' | '↓' | '→';
  topCoins: string[];
  change_pct_24h: number;
}

// SSI index ticker → human-readable sector name
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

export async function getSectorMomentum(): Promise<SectorScore[]> {
  const safe = async <T>(p: Promise<T>): Promise<T | null> => p.catch(() => null);

  // Primary: try SSI index snapshots (most reliable)
  const ssiResults = await Promise.allSettled(
    SSI_TICKERS.map((ticker) => sosovalue.getIndexMarketSnapshot(ticker)),
  );

  const ssiScores: SectorScore[] = [];
  for (let i = 0; i < SSI_TICKERS.length; i++) {
    const ticker = SSI_TICKERS[i];
    const result = ssiResults[i];
    const name = SSI_SECTOR_MAP[ticker];
    if (result.status === 'fulfilled' && result.value) {
      const snap = result.value as any;
      const chg = Number(
        snap.price_change_percent_24h ?? snap.change_pct_24h ??
        snap.change_24h ?? snap.priceChangePct24h ?? 0,
      );
      const price = Number(snap.price ?? snap.close ?? snap.last_price ?? 0);
      const priceScore = Math.min(100, Math.max(0, 50 + chg * 5));
      const momentum = priceScore * 0.7 + 50 * 0.3;
      const trend: '↑' | '↓' | '→' = chg > 1 ? '↑' : chg < -1 ? '↓' : '→';
      ssiScores.push({
        sector: name,
        name,
        momentum: Math.round(momentum),
        fundraisingScore: 0,
        priceScore: Math.round(priceScore),
        newsScore: 50,
        trend,
        topCoins: [],
        change_pct_24h: chg,
      });
    } else {
      // Include with zero change so the sector still appears
      ssiScores.push({
        sector: name,
        name,
        momentum: 50,
        fundraisingScore: 0,
        priceScore: 50,
        newsScore: 50,
        trend: '→',
        topCoins: [],
        change_pct_24h: 0,
      });
    }
  }

  // Secondary: merge data from sector spotlight if available
  const [spotlight, fundraising] = await Promise.all([
    safe(sosovalue.getSectorSpotlight()),
    safe(sosovalue.getFundraisingProjects({ page_size: 50 })),
  ]);

  const spotlightList = Array.isArray(spotlight) ? spotlight : (spotlight as any)?.list ?? [];
  for (const item of spotlightList) {
    const sector = String(item.sector_name ?? item.sector ?? item.name ?? '');
    const match = ssiScores.find((s) => s.name.toLowerCase() === sector.toLowerCase());
    if (match) {
      const chg = Number(item.price_change_percent_24h ?? item.change_pct ?? 0);
      if (chg !== 0) {
        match.change_pct_24h = chg;
        match.priceScore = Math.min(100, Math.max(0, 50 + chg * 5));
        match.momentum = Math.round(match.priceScore * 0.7 + match.fundraisingScore * 0.3);
        match.trend = chg > 1 ? '↑' : chg < -1 ? '↓' : '→';
      }
      const coins = Array.isArray(item.currencies ?? item.coins ?? item.tokens)
        ? (item.currencies ?? item.coins ?? item.tokens).slice(0, 3).map((c: any) => c.symbol ?? c.name ?? '')
        : [];
      if (coins.length && !match.topCoins.length) match.topCoins = coins;
    }
  }

  const fundList = Array.isArray(fundraising?.list ?? fundraising) ? (fundraising?.list ?? fundraising) : [];
  for (const item of fundList) {
    const sector = String(item.sector ?? item.category ?? '');
    const match = ssiScores.find((s) => s.name.toLowerCase() === sector.toLowerCase());
    if (match) {
      match.fundraisingScore = Math.min(100, match.fundraisingScore + 10);
      match.momentum = Math.round(match.priceScore * 0.7 + match.fundraisingScore * 0.3);
    }
  }

  return ssiScores.sort((a, b) => b.change_pct_24h - a.change_pct_24h);
}
