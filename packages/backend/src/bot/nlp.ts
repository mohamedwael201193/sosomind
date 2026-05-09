// Lightweight rule-based intent parser for Telegram bot.
// Recognises trade, query and research intents from free-form text.
// No AI dependency — fast, deterministic, easy to test.

export type TradeAction = 'buy' | 'sell' | 'long' | 'short' | 'close' | 'tp' | 'sl';
export type OrderUrgency = 'now' | 'on_breakout' | 'on_dip' | 'on_pump';

export interface TradeIntent {
  action: TradeAction;
  asset: string;
  amount?: number;
  usdAmount?: number;
  price?: number;
  stopLoss?: number;
  takeProfit?: number;
  leverage?: number;
  orderType: 'market' | 'limit' | 'stop' | 'ioc';
  urgency?: OrderUrgency;
  condition?: string;
}

export type Intent =
  | { kind: 'trade'; action: TradeAction; asset: string; amount?: number; usdAmount?: number; price?: number; stopLoss?: number; takeProfit?: number; leverage?: number; orderType: 'market' | 'limit' | 'stop' | 'ioc'; urgency?: OrderUrgency; condition?: string }
  | { kind: 'close'; asset: string }
  | { kind: 'sl'; asset: string; stopLoss: number }
  | { kind: 'query'; topic: 'best_trade' | 'worst_trade' | 'pnl' | 'positions' | 'sectors' | 'macro' | 'price' | 'whale' | 'arb' | 'funding' | 'leaderboard'; asset?: string; timeframe?: string }
  | { kind: 'research'; asset: string; focus?: 'news' | 'macro' | 'sectors' | 'general' | 'confluence' | 'sentiment' }
  | { kind: 'voice_brief' }
  | { kind: 'persona'; value?: string }
  | { kind: 'paper_trade'; action: 'buy' | 'sell'; asset: string; amount?: number; usdAmount?: number }
  | { kind: 'rebalance' }
  | { kind: 'unknown'; text: string };

const KNOWN_ASSETS = [
  'BTC', 'ETH', 'SOL', 'AVAX', 'LINK', 'DOGE', 'ARB', 'OP', 'SUI',
  'BNB', 'XRP', 'ADA', 'TRX', 'TON', 'MATIC', 'DOT', 'NEAR', 'INJ',
  'APT', 'SEI', 'TIA', 'PEPE', 'SHIB', 'LTC',
];

const ALIAS: Record<string, string> = {
  BITCOIN: 'BTC', ETHEREUM: 'ETH', SOLANA: 'SOL', BINANCECOIN: 'BNB', RIPPLE: 'XRP',
  CARDANO: 'ADA', POLYGON: 'MATIC', POLKADOT: 'DOT', AVALANCHE: 'AVAX', ARBITRUM: 'ARB', OPTIMISM: 'OP',
};

function findAsset(tokens: string[]): string | undefined {
  for (const raw of tokens) {
    const t = raw.replace(/[^A-Z0-9]/gi, '').toUpperCase();
    if (!t) continue;
    if (KNOWN_ASSETS.includes(t)) return t;
    if (ALIAS[t]) return ALIAS[t];
  }
  return undefined;
}

function parseNumber(s: string): number | undefined {
  const m = s.replace(/,/g, '').match(/-?\d+(\.\d+)?/);
  return m ? Number(m[0]) : undefined;
}

function extractUsd(text: string): number | undefined {
  const m = text.match(/\$(\d+(?:[.,]\d+)?)\s*(k|m)?/i) || text.match(/(\d+(?:[.,]\d+)?)\s*(usd|usdc|usdt|dollars?)/i);
  if (!m) return undefined;
  let n = Number(m[1].replace(/,/g, ''));
  const suffix = (m[2] || '').toLowerCase();
  if (suffix === 'k') n *= 1_000;
  else if (suffix === 'm') n *= 1_000_000;
  return n;
}

function extractAt(text: string): number | undefined {
  // "at 98000", "at $98k", "@ 98000"
  const m = text.match(/(?:\bat\b|@)\s*\$?(\d+(?:[.,]\d+)?\s*[km]?)/i);
  if (!m) return undefined;
  return parseSizeWithSuffix(m[1]);
}

function parseSizeWithSuffix(raw: string): number | undefined {
  const m = raw.replace(/,/g, '').match(/(\d+(?:\.\d+)?)\s*([km])?/i);
  if (!m) return undefined;
  let n = Number(m[1]);
  const suf = (m[2] || '').toLowerCase();
  if (suf === 'k') n *= 1_000;
  else if (suf === 'm') n *= 1_000_000;
  return n;
}

function extractStop(text: string): number | undefined {
  const m = text.match(/(?:stop(?:\s*loss)?|sl)\s*(?:at|@|of)?\s*\$?(\d+(?:[.,]\d+)?\s*[km]?)/i);
  return m ? parseSizeWithSuffix(m[1]) : undefined;
}

function extractTakeProfit(text: string): number | undefined {
  const m = text.match(/(?:take\s*profit|tp|target)\s*(?:at|@|of)?\s*\$?(\d+(?:[.,]\d+)?\s*[km]?)/i);
  return m ? parseSizeWithSuffix(m[1]) : undefined;
}

export function parseTradeIntent(text: string): Intent {
  if (!text || typeof text !== 'string') return { kind: 'unknown', text: String(text ?? '') };
  const lower = text.toLowerCase().trim();
  const tokens = text.split(/\s+/);

  // Voice briefing
  if (/\b(voice|audio|speak|read)\b.*\b(brief|briefing|summary|update)\b/i.test(text) ||
      /\b(brief|briefing).*\b(voice|audio|aloud)\b/i.test(text)) {
    return { kind: 'voice_brief' };
  }

  const asset = findAsset(tokens);

  // Trade verbs
  const isBuy = /\b(buy|long|enter\s+long|go\s+long)\b/i.test(text);
  const isSell = /\b(sell|short|enter\s+short|go\s+short|dump|exit\s+long)\b/i.test(text);
  const isClose = /\b(close|exit|cover)\b\s+(my\s+)?(position|trade|all)/i.test(text);

  if (isClose && asset) {
    return { kind: 'close', asset };
  }

  if ((isBuy || isSell) && asset) {
    const action: TradeAction = isBuy ? (lower.includes('long') ? 'long' : 'buy') : (lower.includes('short') ? 'short' : 'sell');
    const usd = extractUsd(text);
    const stopLoss = extractStop(text);
    const takeProfit = extractTakeProfit(text);
    const limitPrice = extractAt(text);
    const leverage = extractLeverage(text);
    // Determine urgency
    let urgency: OrderUrgency | undefined;
    if (/\b(now|immediately|market)\b/i.test(text)) urgency = 'now';
    else if (/\b(breakout|breaks)\b/i.test(text)) urgency = 'on_breakout';
    else if (/\b(dip|drops?|falls?)\b/i.test(text)) urgency = 'on_dip';
    else if (/\b(pump|rises?|rallies?)\b/i.test(text)) urgency = 'on_pump';
    // Conditional patterns
    let condition: string | undefined;
    const condMatch = lower.match(/if\s+(?:it|btc|price)\s+(?:breaks?|dips?|drops?)\s+(?:above|below|under|over)\s+\$?(\d+)/);
    if (condMatch) condition = `price < ${condMatch[1]}`;
    // Quantity: first number that isn't part of usd / at / stop / tp
    let amount: number | undefined;
    const sizeMatch = text.match(/(?:^|\s)(\d+(?:\.\d+)?)\s+([a-z]{2,8})/i);
    if (sizeMatch && sizeMatch[2].toUpperCase() === asset) {
      amount = Number(sizeMatch[1]);
    } else if (!usd) {
      // "buy 0.5 BTC" generic — just first number
      amount = parseNumber(text);
    }
    const orderType = condition ? 'stop' : limitPrice ? 'limit' : 'market';
    return {
      kind: 'trade',
      action,
      asset,
      amount,
      usdAmount: usd,
      price: limitPrice,
      stopLoss,
      takeProfit,
      leverage,
      orderType,
      urgency,
      condition,
    };
  }

  // Query intents
  if (/\b(best|top)\s+(trade|signal|performer)/i.test(text)) {
    return { kind: 'query', topic: 'best_trade', asset, timeframe: extractTimeframe(text) };
  }
  if (/\b(worst|losing)\s+trade/i.test(text)) {
    return { kind: 'query', topic: 'worst_trade', timeframe: extractTimeframe(text) };
  }
  if (/\b(pnl|profit|p\&l|p&l|how (am|are) (i|we) doing)/i.test(text)) {
    return { kind: 'query', topic: 'pnl', timeframe: extractTimeframe(text) };
  }
  if (/\b(positions?|holdings?|portfolio|exposure)\b/i.test(text)) {
    return { kind: 'query', topic: 'positions' };
  }
  if (/\bsector(s|\s+rotation)?\b/i.test(text)) {
    return { kind: 'query', topic: 'sectors' };
  }
  if (/\b(macro|regime|outlook|risk[\- ]on|risk[\- ]off|fed|fomc|cpi)\b/i.test(text) && !asset) {
    return { kind: 'query', topic: 'macro' };
  }
  if (asset && /\b(price|quote|chart|how much)\b/i.test(text)) {
    return { kind: 'query', topic: 'price', asset };
  }

  // New unique feature queries
  if (/\b(whale|smart\s*money|treasury|treasuries|etf\s*flow)\b/i.test(text)) {
    return { kind: 'query', topic: 'whale' };
  }
  if (/\b(arb|arbitrage|spread|cross[\- ]exchange)\b/i.test(text)) {
    return { kind: 'query', topic: 'arb' };
  }
  if (/\b(funding\s*rate|funding|perp\s*rate)\b/i.test(text)) {
    return { kind: 'query', topic: 'funding', asset };
  }
  if (/\b(leaderboard|top\s*trader|rank(ing)?|who.?s\s*best)\b/i.test(text)) {
    return { kind: 'query', topic: 'leaderboard' };
  }

  // Persona
  const personaMatch = lower.match(/\b(?:set|change|i\s+am|be|use)\s+(aggressive|balanced|conservative|quant|swing)\b/);
  if (personaMatch || /\b(my\s+persona|trading\s+style|risk\s+profile)\b/i.test(text)) {
    return { kind: 'persona', value: personaMatch?.[1] };
  }

  // Paper trade
  if (/\bpaper\s*(trade|buy|sell|long|short)\b/i.test(text) && asset) {
    const ptBuy = /\b(buy|long)\b/i.test(text);
    return { kind: 'paper_trade', action: ptBuy ? 'buy' : 'sell', asset, usdAmount: extractUsd(text), amount: undefined };
  }

  // Rebalance
  if (/\b(rebalance|rebalancing|optimal\s*allocation|portfolio\s*suggestion)\b/i.test(text)) {
    return { kind: 'rebalance' };
  }

  // SL command
  const setSl = lower.match(/(?:set\s+)?(?:stop\s+loss|sl)\s+(?:for\s+)?(\w+)\s+(?:at|@)\s+\$?(\d+)/);
  if (setSl) {
    return { kind: 'sl', asset: setSl[1].toUpperCase(), stopLoss: parseInt(setSl[2]) };
  }

  // Research intents
  if (asset) {
    let focus: 'news' | 'macro' | 'sectors' | 'general' | 'confluence' | 'sentiment' = 'general';
    if (/\bnews\b/i.test(text)) focus = 'news';
    else if (/\bmacro\b/i.test(text)) focus = 'macro';
    else if (/\bsector\b/i.test(text)) focus = 'sectors';
    else if (/\b(confluence|multi.?timeframe|all\s*timeframes?)\b/i.test(text)) focus = 'confluence';
    else if (/\b(sentiment|social|twitter|tweet|community)\b/i.test(text)) focus = 'sentiment';

    if (/\b(research|analy[sz]e|why|what.*think|outlook|opinion|should i (buy|sell)|forecast)\b/i.test(text)) {
      return { kind: 'research', asset, focus };
    }
    // Bare "BTC" or "ETH?" → quick research
    if (lower === asset.toLowerCase() || /^[a-z]{2,5}\?$/i.test(lower)) {
      return { kind: 'research', asset, focus };
    }
  }

  return { kind: 'unknown', text };
}

function extractTimeframe(text: string): string | undefined {
  const m = text.match(/\b(today|yesterday|this\s+week|last\s+week|this\s+month|last\s+month|24h|7d|30d|90d)\b/i);
  return m ? m[1].toLowerCase().replace(/\s+/g, '') : undefined;
}

// Extract leverage from text: "2x leverage", "3x", "5× leverage"
function extractLeverage(text: string): number | undefined {
  const m = text.match(/(\d+)\s*[x×]\s*(?:leverage)?/i) || text.match(/leverage\s+(\d+)/i);
  return m ? Math.min(20, parseInt(m[1])) : undefined; // cap at 20x
}
