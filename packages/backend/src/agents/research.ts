import { sosovalue } from '../clients/sosovalue';
import { getMarketContext } from '../clients/market';
import { chatComplete, hasAI } from '../clients/ai';
import { supabase, logAgent } from '../db/supabase';
import { cachedFetch } from '../clients/redis';
import { sha256 } from '../utils/provenance';

export interface ResearchSignal {
  asset: string;
  direction: 'LONG' | 'SHORT' | 'NEUTRAL';
  confidence: number;
  confidence_explanation: string;
  reasoning: string;
  entry?: number | null;
  takeProfit?: number | null;
  stopLoss?: number | null;
  sources: Array<{ module: string; insight: string }>;
  raw: any;
}

export async function runResearchAgent(asset: string, opts: { saveToDb?: boolean; userId?: string } = {}): Promise<ResearchSignal> {
  const startedAt = Date.now();
  const symbol = asset.toUpperCase();
  const safe = async <T>(p: Promise<T>) => p.catch((e) => ({ __error: (e as Error).message }) as any);

  // Return cached result if fresh (5 min) — prevents AI provider rate-limit storms
  const RESEARCH_CACHE_TTL = 300;
  const cacheKey = `research:signal:${symbol}`;

  const [
    snapshot, economics, klines, sectors, etfList, btcTreasuries,
    cryptoStocks, hotNews, searchNews, fundraising, macro, indices, analyses,
    market,
  ] = await Promise.all([
    safe(sosovalue.getMarketSnapshot(symbol)),
    safe(sosovalue.getTokenEconomics(symbol)),
    safe(sosovalue.getKlines(symbol, { limit: 24 })),
    safe(sosovalue.getSectorSpotlight()),
    safe(sosovalue.getETFList(symbol, 'US')),
    safe(sosovalue.getBTCTreasuries()),
    safe(sosovalue.getCryptoStockList()),
    safe(sosovalue.getHotNews({ page_size: 8 })),
    safe(sosovalue.searchNews(symbol, { page_size: 6 })),
    safe(sosovalue.getFundraisingProjects({ page_size: 10 })),
    safe(sosovalue.getMacroEvents()),
    safe(sosovalue.getIndices()),
    safe(sosovalue.getAnalysisCharts()),
    safe(getMarketContext(symbol)),  // Binance + DefiLlama + CoinGecko + CryptoPanic
  ]);

  let etfFlow: any = null;
  if (Array.isArray(etfList) && etfList.length) {
    const ticker = (etfList[0] as any).ticker;
    if (ticker) etfFlow = await safe(sosovalue.getETFHistory(ticker, { limit: 7 }));
  }

  // Extract live price from Binance ticker (reliable fallback for display)
  const binanceTicker = (market as any)?.ticker;
  const livePrice = binanceTicker?.price ?? null;

  const intel = {
    snapshot, economics, klines, sectors, etfList, etfFlow, btcTreasuries,
    cryptoStocks, hotNews, searchNews, fundraising, macro, indices, analyses,
    // Free market data (Binance, DefiLlama, CoinGecko, CryptoPanic)
    market: {
      binance: binanceTicker
        ? { price: binanceTicker.price, priceChange24h: binanceTicker.priceChangePercent,
            high24h: binanceTicker.highPrice, low24h: binanceTicker.lowPrice,
            volume24h: binanceTicker.quoteVolume, trades24h: binanceTicker.count }
        : null,
      klines1h: Array.isArray((market as any)?.klines)
        ? (market as any).klines.slice(-6).map((k: any) => ({
            open: k.open, high: k.high, low: k.low, close: k.close, volume: k.volume,
          }))
        : null,
      global: (market as any)?.global ?? null,
      defiTopChains: (market as any)?.defiChains?.slice(0, 5) ?? null,
      trending: (market as any)?.trending?.slice(0, 5)?.map((t: any) => t.symbol) ?? null,
      news: (market as any)?.news?.slice(0, 5) ?? null,
    },
  };

  // Cached signal lookup — return stale result if all AI providers are on cooldown
  const cachedSignal = await cachedFetch<ResearchSignal>(
    cacheKey,
    async () => {
      // ── Multi-factor baseline signal — sosovalue snapshot + Binance ─────────
      // Uses all data fetched in parallel above for a rich, non-AI signal.
      const baseSnap = intel.snapshot && !(intel.snapshot as any).__error ? intel.snapshot as any : null;
      const binTicker = (market as any)?.ticker;

      // 24h % change: Binance = percentage (e.g. 2.5); sosovalue = fraction (e.g. -0.025 = -2.5%)
      const soso24h = baseSnap?.change_pct_24h != null ? Number(baseSnap.change_pct_24h) * 100 : null;
      const bx24h   = binTicker?.priceChangePercent != null ? Number(binTicker.priceChangePercent) : null;
      const change24h = bx24h ?? soso24h ?? 0;

      // Intraday range position: 0 = at session low, 1 = at session high
      const livePrice2  = Number(binTicker?.price ?? baseSnap?.price ?? livePrice ?? 0);
      const sessionHigh = Number(binTicker?.highPrice ?? baseSnap?.high_24h ?? livePrice2);
      const sessionLow  = Number(binTicker?.lowPrice  ?? baseSnap?.low_24h  ?? livePrice2);
      const rangePos    = sessionHigh > sessionLow && livePrice2 > 0
        ? (livePrice2 - sessionLow) / (sessionHigh - sessionLow) : 0.5;

      // Cycle context from sosovalue
      const downFromAth    = baseSnap?.down_from_ath    ? Number(String(baseSnap.down_from_ath).replace(/%/g, ''))    : null;
      const upFromCycleLow = baseSnap?.up_from_cycle_low ? Number(String(baseSnap.up_from_cycle_low).replace(/%/g, '')) : null;
      const turnoverRate   = baseSnap?.turnover_rate ? Number(baseSnap.turnover_rate) : null;

      // ETF net inflow (3-day sum — bullish if > 0, bearish if < 0)
      const etfNetInflow = (() => {
        if (!Array.isArray(intel.etfFlow) || (intel.etfFlow as any).__error) return 0;
        return (intel.etfFlow as any[]).slice(0, 3)
          .reduce((sum: number, e: any) => sum + Number(e.net_inflow ?? e.flowDaily ?? 0), 0);
      })();

      // ── Weighted score: sum of factors → direction + confidence ──────────────
      let score = 0;
      const baseFactors: Array<{ module: string; insight: string }> = [];

      // 1. 24h momentum (dominant: ±45pts)
      score += Math.max(-45, Math.min(45, change24h * 6));
      baseFactors.push({ module: bx24h != null ? 'binance' : 'sosovalue', insight: `24h Δ ${change24h >= 0 ? '+' : ''}${change24h.toFixed(2)}%` });

      // 2. Intraday range position (±15pts) — trading near highs is bullish
      const rangePts = (rangePos - 0.5) * 30;
      score += rangePts;
      if (Math.abs(rangePts) > 4)
        baseFactors.push({ module: 'market', insight: `Price at ${(rangePos * 100).toFixed(0)}% of session range ($${sessionLow}–$${sessionHigh})` });

      // 3. Cycle context (±20pts)
      if (upFromCycleLow != null && upFromCycleLow > 20) {
        score += Math.min(20, upFromCycleLow / 5);
        baseFactors.push({ module: 'sosovalue', insight: `+${upFromCycleLow.toFixed(0)}% recovery from cycle low` });
      } else if (downFromAth != null && downFromAth < -50) {
        score -= 10;
        baseFactors.push({ module: 'sosovalue', insight: `${downFromAth.toFixed(0)}% below ATH — deep drawdown` });
      }

      // 4. ETF capital flow (±15pts)
      if (Math.abs(etfNetInflow) > 10_000_000) {
        score += Math.max(-15, Math.min(15, etfNetInflow / 50_000_000));
        baseFactors.push({ module: 'sosovalue', insight: `ETF ${etfNetInflow >= 0 ? '+' : ''}$${(etfNetInflow / 1e6).toFixed(0)}M flow` });
      }

      // 5. Volume spike (±5pts)
      if (turnoverRate != null && turnoverRate > 0.04) {
        score += 5;
        baseFactors.push({ module: 'sosovalue', insight: `Elevated volume turnover ${(turnoverRate * 100).toFixed(1)}%` });
      }

      const baseDirection: 'LONG' | 'SHORT' | 'NEUTRAL' =
        score > 8 ? 'LONG' : score < -8 ? 'SHORT' : 'NEUTRAL';
      const baseConfidence = Math.round(Math.min(78, Math.max(40, 50 + Math.abs(score) * 0.75)));

      const buildConfidenceExplanation = (conf: number, dir: string, srcs: Array<{ module: string; insight: string }>) => {
        const tier = conf >= 75 ? 'High' : conf >= 60 ? 'Moderate' : conf >= 45 ? 'Low' : 'Very low';
        const srcList = [...new Set(srcs.map(s => s.module))].join(', ') || 'price data';
        return `${tier} (${conf}/100) — ${dir} signal from: ${srcList}.`;
      };

      // Build reasoning string from actual factors
      const factorSummary = baseFactors.slice(0, 3).map(f => f.insight).join('; ');
      const entryPx = livePrice2 || livePrice;

      let signal: ResearchSignal = {
        asset: symbol,
        direction: baseDirection,
        confidence: baseConfidence,
        confidence_explanation: buildConfidenceExplanation(baseConfidence, baseDirection, baseFactors),
        reasoning: `Multi-factor baseline: ${factorSummary}. Score ${score >= 0 ? '+' : ''}${score.toFixed(1)} → ${baseDirection}. AI synthesis pending.`,
        entry: entryPx,
        takeProfit: entryPx ? +(entryPx * (baseDirection === 'SHORT' ? 0.94 : 1.06)).toFixed(4) : null,
        stopLoss:   entryPx ? +(entryPx * (baseDirection === 'SHORT' ? 1.03 : 0.97)).toFixed(4) : null,
        sources: baseFactors.length > 0 ? baseFactors : [{ module: 'market', insight: `24h Δ ${change24h.toFixed(2)}%` }],
        raw: intel,
      };

      if (hasAI()) {
        // Build a clean structured prompt — readable key facts, not raw JSON
        const snap = intel.snapshot && !intel.snapshot.__error ? intel.snapshot : null;
        const binance = intel.market?.binance;
        const price = binance?.price ?? snap?.price ?? livePrice ?? 'unknown';
        const high24 = binance?.high24h ?? snap?.highPrice24h ?? '?';
        const low24  = binance?.low24h  ?? snap?.lowPrice24h  ?? '?';
        const vol24  = binance?.volume24h ? `$${(Number(binance.volume24h) / 1e6).toFixed(0)}M` : '?';

        // Recent klines — last 6 × 1h candles
        const klinesSummary = Array.isArray(intel.market?.klines1h)
          ? intel.market.klines1h
              .map((k: any) => `${Number(k.close).toFixed(2)}`)
              .join(' → ')
          : null;

        // Top news (asset-specific first)
        const newsItems: string[] = [];
        const rawSearch = Array.isArray(intel.searchNews) && !(intel.searchNews as any).__error ? intel.searchNews : [];
        const rawHot    = Array.isArray(intel.hotNews)   && !(intel.hotNews as any).__error   ? intel.hotNews   : [];
        const rawNews   = Array.isArray(intel.market?.news) ? intel.market.news : [];
        [...rawSearch.slice(0, 3), ...rawHot.slice(0, 2), ...rawNews.slice(0, 2)].forEach((n: any) => {
          const t = n?.title || n?.headline || '';
          if (t && newsItems.length < 5) newsItems.push(`- ${t}`);
        });

        // ETF flow
        const etfFlowItem = Array.isArray(intel.etfFlow) && intel.etfFlow[0] && !intel.etfFlow[0].__error
          ? `${intel.etfFlow[0].ticker}: $${(Number(intel.etfFlow[0].net_inflow ?? intel.etfFlow[0].flowDaily ?? 0) / 1e6).toFixed(0)}M daily`
          : null;

        // Macro
        const macroRaw = Array.isArray(intel.macro) && !(intel.macro as any).__error ? intel.macro : [];
        const macroNext = macroRaw[0] ? `${macroRaw[0].events?.[0] ?? macroRaw[0].event_name ?? macroRaw[0].name ?? '?'} (${macroRaw[0].date ?? ''})` : null;

        // DeFi top chains by TVL
        const defiChains = Array.isArray(intel.market?.defiTopChains)
          ? intel.market.defiTopChains.slice(0, 3)
              .map((c: any) => `${c.name}: $${(Number(c.tvl) / 1e9).toFixed(0)}B`)
              .join(', ')
          : null;

        // CoinGecko global
        const global = intel.market?.global;
        const globalSummary = global
          ? `BTC dom ${Number(global.bitcoin_dominance_percentage ?? 0).toFixed(1)}%, Total cap $${(Number(global.total_market_cap_usd ?? 0) / 1e12).toFixed(2)}T`
          : null;

        // Sectors: API returns { sector: [{name, change_pct_24h (fraction)}] }
        const rawSectorArr: any[] = Array.isArray(intel.sectors)
          ? intel.sectors
          : Array.isArray((intel.sectors as any)?.sector) ? (intel.sectors as any).sector : [];
        const sectors = rawSectorArr.length
          ? rawSectorArr.slice(0, 3).map((s: any) => `${s.name || s.sector}: ${(Number(s.change_pct_24h ?? s['24h_change_pct'] ?? 0) * 100).toFixed(1)}%`).join(' | ')
          : null;

        // Build clean prompt (always < 3000 chars)
        const lines = [
          `## ${symbol} Market Research — ${new Date().toUTCString()}`,
          `**Price**: $${price} | 24h: ${change24h >= 0 ? '+' : ''}${change24h.toFixed(2)}%`,
          `**24h Range**: $${low24} – $${high24} | Volume: ${vol24}`,
          upFromCycleLow != null ? `**Cycle recovery**: +${upFromCycleLow.toFixed(0)}% from cycle low` : null,
          downFromAth != null    ? `**ATH distance**: ${downFromAth.toFixed(0)}% below ATH` : null,
          klinesSummary ? `**Hourly close (last 6h)**: ${klinesSummary}` : null,
          globalSummary ? `**Market**: ${globalSummary}` : null,
          defiChains    ? `**DeFi TVL top chains**: ${defiChains}` : null,
          sectors       ? `**Sectors 24h**: ${sectors}` : null,
          etfFlowItem   ? `**ETF flow**: ${etfFlowItem}` : null,
          macroNext     ? `**Upcoming macro**: ${macroNext}` : null,
          newsItems.length ? `**News headlines**:\n${newsItems.join('\n')}` : null,
        ].filter(Boolean).join('\n');

        const sys = `You are SosoMind, an institutional crypto research AI. Analyze the data below and output ONE trading signal as valid JSON only (no markdown fences):
{"direction":"LONG"|"SHORT"|"NEUTRAL","confidence":0-100,"reasoning":"2-4 sentences with specific data references","entry":number|null,"takeProfit":number|null,"stopLoss":number|null,"sources":[{"module":"string","insight":"string"}]}

Rules:
- reasoning MUST reference specific numbers from the data (price level, % move, volume, news)
- entry should be current market price ± small adjustment
- takeProfit = next resistance / 5-8% above entry for LONG
- stopLoss = recent low / 3-5% below entry for LONG
- confidence > 70 only if multiple signals agree`;

        const result = await chatComplete(
          [{ role: 'system', content: sys }, { role: 'user', content: lines }],
          0.25,
        );
        if (result) {
          try {
            // Strip possible markdown code fences from response
            const cleaned = result.content.replace(/^```json?\s*/i, '').replace(/\s*```$/i, '').trim();
            const parsed = JSON.parse(cleaned || '{}');
            const parsedSources: Array<{ module: string; insight: string }> = Array.isArray(parsed.sources) ? parsed.sources : signal.sources;
            const parsedConf = Math.max(0, Math.min(100, Number(parsed.confidence) || Math.round(baseConfidence)));
            const parsedDir = (['LONG', 'SHORT', 'NEUTRAL'].includes((parsed.direction || '').toUpperCase())
              ? parsed.direction.toUpperCase()
              : baseDirection) as 'LONG' | 'SHORT' | 'NEUTRAL';
            signal = {
              asset: symbol,
              direction: parsedDir,
              confidence: parsedConf,
              confidence_explanation: buildConfidenceExplanation(parsedConf, parsedDir, parsedSources),
              reasoning: `[${result.provider}] ${String(parsed.reasoning || '')}`,
              entry: parsed.entry ?? livePrice,
              takeProfit: parsed.takeProfit ?? signal.takeProfit,
              stopLoss: parsed.stopLoss ?? signal.stopLoss,
              sources: parsedSources,
              raw: intel,
            };
          } catch {
            // JSON parse failed — keep price-based signal, update reasoning with provider info
            signal.reasoning = `[${result.provider}] Price analysis: ${change24h >= 0 ? '+' : ''}${change24h.toFixed(2)}% 24h`;
          }
        }
        // If result is null (all providers exhausted), price-based signal is used — no error shown
      }
      return signal;
    },
    RESEARCH_CACHE_TTL,
  );

  const signal = cachedSignal;

  if (opts.saveToDb !== false) {
    try {
      // Build provenance citations — every public claim must trace to a source
      const citations: Array<{ source: string; endpoint: string; hash: string; timestamp: string; note?: string }> = [];
      const ts = new Date().toISOString();
      const cite = (source: string, endpoint: string, payload: unknown, note?: string) => {
        if (!payload || (payload as any).__error) return;
        citations.push({ source, endpoint, hash: sha256(JSON.stringify(payload)).slice(0, 16), timestamp: ts, note });
      };
      cite('sosovalue', `getMarketSnapshot:${symbol}`, snapshot, 'price + 24h stats');
      cite('sosovalue', 'getSectorSpotlight', sectors, 'sector rotation');
      cite('sosovalue', 'getETFList', etfList, 'spot ETF universe');
      cite('sosovalue', 'getETFHistory', etfFlow, 'ETF net flow');
      cite('sosovalue', 'getHotNews', hotNews, 'market headlines');
      cite('sosovalue', `searchNews:${symbol}`, searchNews, 'asset-specific news');
      cite('sosovalue', 'getMacroEvents', macro, 'macro calendar');
      cite('binance', `ticker:${symbol}USDT`, (market as any)?.ticker, 'live price');
      cite('binance', `klines:${symbol}USDT:1h`, (market as any)?.klines, 'recent candles');
      cite('defillama', 'chains', (market as any)?.defiChains, 'DeFi TVL');
      cite('coingecko', 'global', (market as any)?.global, 'total market cap');

      const { data } = await supabase.from('signals').insert({
        user_id: opts.userId ?? null, asset: symbol, symbol,
        direction: signal.direction.toLowerCase(),
        confidence: Math.round(signal.confidence),
        confidence_explanation: signal.confidence_explanation,
        reasoning: signal.reasoning, entry: signal.entry,
        take_profit: signal.takeProfit, stop_loss: signal.stopLoss,
        sources: signal.sources, citations, status: 'active',
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      }).select('id').single();
      (signal as any).id = data?.id;
      (signal as any).citations = citations;
    } catch (e) {
      console.warn('signal insert failed', (e as Error).message);
    }
  }

  await logAgent({
    agent: 'research', action: `research:${symbol}`,
    duration_ms: Date.now() - startedAt,
    output: { direction: signal.direction, confidence: signal.confidence },
    user_id: opts.userId,
  });
  return signal;
}
