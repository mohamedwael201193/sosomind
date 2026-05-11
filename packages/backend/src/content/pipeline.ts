import { sosovalue } from '../clients/sosovalue';
import { chatComplete } from '../clients/ai';
import { createContentPost } from '../db/supabase';
import { CitationCollector, type Citation } from '../utils/provenance';

export interface MarketBrief {
  title: string;
  body: string;
  hashtags: string[];
  chartSymbol?: string;
  citations?: Citation[];
}

export async function generateMarketBrief(): Promise<MarketBrief> {
  const cc = new CitationCollector();
  const safe = async <T>(p: Promise<T>): Promise<T | null> => p.catch(() => null);
  const citeSafe = async <T>(source: string, endpoint: string, params: any, fn: () => Promise<T>): Promise<T | null> => {
    try { return await cc.cite(source, endpoint, params, fn); } catch { return null; }
  };

  const [sectors, hotNews, etfList, macros] = await Promise.all([
    citeSafe('sosovalue', '/sectorSpotlight', null, () => sosovalue.getSectorSpotlight()),
    citeSafe('sosovalue', '/news/hot', { page_size: 5 }, () => sosovalue.getHotNews({ page_size: 5 })),
    citeSafe('sosovalue', '/etf/list', { sym: 'BTC', region: 'US' }, () => sosovalue.getETFList('BTC', 'US')),
    citeSafe('sosovalue', '/macro/events', null, () => sosovalue.getMacroEvents()),
  ]);

  const btcSnap: any = await citeSafe('sosovalue', '/market/snapshot', { sym: 'BTC' }, () => sosovalue.getMarketSnapshot('BTC'));
  const ethSnap: any = await citeSafe('sosovalue', '/market/snapshot', { sym: 'ETH' }, () => sosovalue.getMarketSnapshot('ETH'));

  const context = {
    btcPrice: btcSnap?.price ?? btcSnap?.last_price,
    btcChange: btcSnap?.priceChangePercent24h,
    ethPrice: ethSnap?.price ?? ethSnap?.last_price,
    ethChange: ethSnap?.priceChangePercent24h,
    sectors: Array.isArray(sectors) ? sectors.slice(0, 3) : [],
    news: Array.isArray(hotNews?.list ?? hotNews) ? (hotNews?.list ?? hotNews)?.slice(0, 5).map((n: any) => n.title || n.headline) : [],
    etfs: Array.isArray(etfList) ? etfList.slice(0, 3).map((e: any) => e.ticker) : [],
    macros: Array.isArray(macros) ? macros.slice(0, 3).map((m: any) => m.events?.[0] ?? m.event_name ?? m.name) : [],
  };

  const now = new Date();
  const dateStr = now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  let body = `<b>SosoMind Market Briefing — ${dateStr}</b>\n\n`;

  if (context.btcPrice) {
    body += `<b>BTC</b>: $${Number(context.btcPrice).toLocaleString()} (${Number(context.btcChange ?? 0).toFixed(2)}%)\n`;
  }
  if (context.ethPrice) {
    body += `<b>ETH</b>: $${Number(context.ethPrice).toLocaleString()} (${Number(context.ethChange ?? 0).toFixed(2)}%)\n`;
  }
  body += '\n';

  // AI synthesis — chatComplete returns null when all providers exhausted, handled gracefully
  const aiResult = await chatComplete([
    { role: 'system', content: 'You are a professional crypto market analyst writing a 200-word institutional morning brief. Be concise, data-driven, and actionable. Use HTML formatting with <b> for headers.' },
    { role: 'user', content: `Write a morning market brief based on: ${JSON.stringify(context)}. Include: market overview, top sectors, key news, macro watch, and one actionable insight.` },
  ], 0.7);
  const content = aiResult?.content ?? 'Market brief temporarily unavailable. Check individual asset signals for live data.';

  body += content;
  body += '\n\n<i>Powered by SosoMind — The Agentic Finance OS</i>';

  const hashtags = ['#Crypto', '#Bitcoin', '#DeFi', '#Markets', '#SosoMind'];

  return { title: `SosoMind Market Brief — ${dateStr}`, body, hashtags, chartSymbol: 'BTC', citations: cc.toArray() };
}

export async function publishToChannel(channelId: string, brief: MarketBrief, bot: any): Promise<void> {
  const msg = brief.body + '\n\n' + brief.hashtags.join(' ');
  await bot.api.sendMessage(channelId, msg.slice(0, 4096), { parse_mode: 'HTML' });

  await createContentPost({
    title: brief.title,
    body: brief.body,
    summary: brief.body.slice(0, 200).replace(/<[^>]+>/g, ''),
    sector: null,
    symbols: ['BTC', 'ETH'],
    sentiment: 'neutral',
    confidence: null,
    channel: channelId,
    published: true,
    engagement: null,
    citations: brief.citations ?? [],
  } as any);
}

export async function runDailyBriefing(bot: any): Promise<void> {
  try {
    const brief = await generateMarketBrief();
    const channelId = process.env.TELEGRAM_CHANNEL_ID;
    if (channelId) {
      await publishToChannel(channelId, brief, bot);
    }
  } catch (e) {
    console.error('daily briefing failed', (e as Error).message);
  }
}
