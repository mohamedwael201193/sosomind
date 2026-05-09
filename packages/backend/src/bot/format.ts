import type { ResearchSignal } from '../agents/research';

const fmtNum = (n: any, digits = 2): string => {
  const v = Number(n);
  if (!isFinite(v)) return '—';
  if (v >= 1) return v.toLocaleString('en-US', { maximumFractionDigits: digits });
  return v.toFixed(digits);
};

const pct = (n: any): string => {
  const v = Number(n);
  if (!isFinite(v)) return '—';
  const sign = v >= 0 ? '+' : '';
  return `${sign}${v.toFixed(2)}%`;
};

export function formatResearchReport(s: ResearchSignal): string {
  const r = s.raw || {};
  const snap = r.snapshot && !r.snapshot.__error ? r.snapshot : null;
  const binance = r.market?.binance ?? null;

  // Price: SoSoValue first, Binance fallback
  const livePrice = snap?.price ?? binance?.price ?? s.entry ?? null;
  const priceStr = livePrice ? `$${fmtNum(livePrice)}` : '—';
  // 24h change: SoSoValue → Binance
  const rawChange = snap?.change_pct_24h
    ? snap.change_pct_24h * 100
    : snap?.priceChangePercent24h
    ? Number(snap.priceChangePercent24h)
    : binance?.priceChange24h
    ? Number(binance.priceChange24h)
    : null;
  const changeStr = rawChange !== null ? pct(rawChange) : '';

  const etfFlow = Array.isArray(r.etfFlow) ? r.etfFlow.slice(0, 1)[0] : null;
  const treasury = Array.isArray(r.btcTreasuries) ? r.btcTreasuries[0] : null;
  const stock = Array.isArray(r.cryptoStocks) ? r.cryptoStocks.slice(0, 2) : null;
  // News: search news first (asset-specific), then hot news
  const news = (Array.isArray(r.searchNews) && r.searchNews[0] && !r.searchNews[0].__error)
    ? r.searchNews[0]
    : (Array.isArray(r.hotNews) && r.hotNews[0] && !r.hotNews[0].__error)
    ? r.hotNews[0]
    : (Array.isArray(r.market?.news) && r.market.news[0]) ? r.market.news[0] : null;
  // Macro: SoSoValue field is event_name (not name)
  const macroArr = Array.isArray(r.macro) && !r.macro.__error ? r.macro : [];
  const macro = macroArr[0] ?? null;
  const macroName = macro ? (macro.event_name ?? macro.name ?? macro.event ?? macro.title ?? null) : null;
  const macroDate = macro ? (macro.date ?? macro.event_date ?? macro.time ?? '') : '';
  const macroImportance = macro ? (macro.importance ?? macro.level ?? '') : '';

  // CoinGecko global
  const global = r.market?.global ?? null;
  const btcDom = global?.bitcoin_dominance_percentage ? `${Number(global.bitcoin_dominance_percentage).toFixed(1)}%` : null;
  const totalMcap = global?.total_market_cap_usd ? `$${(Number(global.total_market_cap_usd) / 1e12).toFixed(2)}T` : null;

  // Binance 24h stats
  const vol24h = binance?.volume24h ? `$${(Number(binance.volume24h) / 1e9).toFixed(1)}B` : null;
  const high24h = binance?.high24h ? `$${fmtNum(binance.high24h)}` : null;
  const low24h = binance?.low24h ? `$${fmtNum(binance.low24h)}` : null;

  const dirEmoji = s.direction === 'LONG' ? '🟢' : s.direction === 'SHORT' ? '🔴' : '⚪';

  const lines: string[] = [];
  lines.push(`🧠 <b>SosoMind Research Report: ${s.asset}</b>`);
  lines.push('');

  // Price block
  lines.push(`💰 <b>Price:</b> ${priceStr}${changeStr ? ` (${changeStr})` : ''}`);
  if (high24h && low24h) lines.push(`📉 <b>24h Range:</b> ${low24h} – ${high24h}${vol24h ? ` | Vol: ${vol24h}` : ''}`);

  // Market context
  if (btcDom || totalMcap) {
    lines.push(`🌐 <b>Market:</b>${btcDom ? ` BTC Dom ${btcDom}` : ''}${totalMcap ? ` | Total Cap ${totalMcap}` : ''}`);
  }
  if (Array.isArray(r.market?.trending) && r.market.trending.length) {
    lines.push(`🔥 <b>Trending:</b> ${r.market.trending.slice(0, 5).join(', ')}`);
  }

  // Fundamental data
  if (etfFlow) {
    const netInflow = etfFlow.net_inflow ?? etfFlow.flowDaily;
    lines.push(`📈 <b>ETF Flow:</b> ${etfFlow.ticker || ''} ${netInflow != null ? `$${(Number(netInflow) / 1e6).toFixed(0)}M today` : '—'}`);
  }
  if (treasury) {
    lines.push(`🏢 <b>BTC Treasury:</b> ${treasury.company || ''} holds ${fmtNum(treasury.totalBtc, 0)} BTC`);
  }
  if (stock && stock.length) {
    lines.push(`🏭 <b>Crypto Stocks:</b> ${stock.map((st: any) => `${st.ticker || ''} ${pct(st.change24h ?? st.price_change_pct_24h)}`).join(' | ')}`);
  }
  if (Array.isArray(r.market?.defiTopChains) && r.market.defiTopChains.length) {
    const chains = r.market.defiTopChains.slice(0, 3).map((c: any) => `${c.name}: $${(Number(c.tvl) / 1e9).toFixed(1)}B`).join(' | ');
    lines.push(`⛓️ <b>DeFi TVL:</b> ${chains}`);
  }

  // News
  if (news) {
    const title = (news.title || news.headline || '').slice(0, 110);
    if (title) lines.push(`📰 <b>News:</b> ${title}`);
  }

  // Macro
  if (macroName) {
    lines.push(`📅 <b>Macro:</b> ${macroName}${macroDate ? ` (${macroDate})` : ''}${macroImportance ? ` — ${macroImportance}` : ''}`);
  }

  // Fundraising
  if (Array.isArray(r.fundraising) && r.fundraising[0] && !r.fundraising[0].__error) {
    const f = r.fundraising[0];
    lines.push(`💼 <b>Funding:</b> ${f.name || ''} raised ${f.amount || f.total_amount || '—'}`);
  }

  lines.push('');
  lines.push(`${dirEmoji} <b>Signal:</b> ${s.direction} ${s.asset} | <b>Confidence:</b> ${s.confidence}%`);
  if (s.entry || s.takeProfit || s.stopLoss) {
    lines.push(`🎯 <b>Entry:</b> ${s.entry ? `$${fmtNum(s.entry)}` : '—'} | <b>TP:</b> ${s.takeProfit ? `$${fmtNum(s.takeProfit)}` : '—'} | <b>SL:</b> ${s.stopLoss ? `$${fmtNum(s.stopLoss)}` : '—'}`);
  }
  if (s.reasoning) {
    lines.push('');
    lines.push(`<i>${s.reasoning.slice(0, 220)}</i>`);
  }
  return lines.join('\n');
}

export function formatBriefing(intel: { hot: any; sectors: any; etfs: any[]; macros: any[] }): string {
  const lines: string[] = ['📡 <b>SosoMind Daily Briefing</b>', ''];

  // Sectors: API returns { sector: [{name, change_pct_24h}], spotlight: [...] } (fraction, × 100 for %)
  const sectorArr: any[] = Array.isArray(intel.sectors)
    ? intel.sectors
    : Array.isArray((intel.sectors as any)?.sector) ? (intel.sectors as any).sector : [];
  if (sectorArr.length) {
    lines.push('🔥 <b>Top Sectors</b>');
    sectorArr.slice(0, 3).forEach((s: any) => {
      const name = s.name ?? s.sectorName ?? '?';
      const chg = Number(s.change_pct_24h ?? s['24h_change_pct'] ?? s.change24h ?? 0) * 100;
      lines.push(`• ${name}: ${pct(chg)}`);
    });
    lines.push('');
  }

  // ETF: snapshot has net_inflow (USD), divide by 1e6 for millions
  if (intel.etfs?.length) {
    lines.push('💵 <b>ETF Snapshot</b>');
    intel.etfs.slice(0, 3).forEach((e: any) => {
      const flow = e.net_inflow ?? e.flowDaily;
      lines.push(`• ${e.ticker}: ${flow != null ? `$${(Number(flow) / 1e6).toFixed(0)}M` : '—'}`);
    });
    lines.push('');
  }

  // Macro: API returns [{ date, events: string[] }] — events is an array of names
  if (intel.macros?.length) {
    lines.push('📅 <b>Macro Watch</b>');
    intel.macros.slice(0, 3).forEach((m: any) => {
      const name = m.events?.[0] ?? m.event_name ?? m.name ?? 'Unknown Event';
      lines.push(`• ${name} (${m.date || ''})`);
    });
    lines.push('');
  }

  // News: API may return { list: [...] } or [...]
  const hotArr: any[] = Array.isArray(intel.hot) ? intel.hot : ((intel.hot as any)?.list ?? []);
  if (hotArr.length) {
    lines.push('📰 <b>Top News</b>');
    hotArr.slice(0, 3).forEach((n: any) => lines.push(`• ${(n.title || n.headline || '').slice(0, 100)}`));
  }
  return lines.join('\n');
}
