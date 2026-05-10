import { Bot, InlineKeyboard, InputFile, Keyboard, Context } from 'grammy';
import { runResearchAgent } from '../agents/research';
import { runExecutionAgent } from '../agents/execution';
import { sosovalue } from '../clients/sosovalue';
import { supabase } from '../db/supabase';
import { upsertSubscriber, getSignals, getUserPreference, setUserPreference, getOrCreateTelegramWallet } from '../db/supabase';
import { formatResearchReport, formatBriefing } from './format';
import { parseTradeIntent } from './nlp';
import { generateVoiceBrief, briefingScript, hasVoice } from '../agents/voice';
import { getWhaleAlerts, runWhaleScan } from '../agents/whales';
import { scanArbitrage } from '../arbitrage/scanner';
import { getFundingSignals, runFundingRateScan } from '../agents/funding';
import { getPaperLeaderboard, createPaperTrade } from '../simulation/paperTrading';
import { getUserPersona, setUserPersona, getPersonaQuiz, inferPersonaFromQuiz, PERSONAS } from '../agents/persona';
import { generateRebalanceRecommendation } from '../rebalance/engine';
import { getStrategies, PRESET_STRATEGIES } from '../strategies/playbook';
import { formatMevWarning } from '../utils/mev';

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
// Admin chat IDs — used only for privileged commands, not to block regular users
const ADMIN_IDS = (process.env.TELEGRAM_ALLOWED_CHAT_IDS || process.env.TELEGRAM_ALLOWED_CHAT_ID || '')
  .split(',').map((s) => s.trim()).filter(Boolean);

// ─── Persistent bottom menu keyboard ────────────────────────────────────────
const MAIN_KB = new Keyboard()
  .text('🔬 Research').text('⚡ Signal').text('💼 Portfolio').row()
  .text('📊 Briefing').text('🔔 Alerts').text('⚙️ Settings').row()
  .text('📓 Journal').text('🤝 Subscribe').text('ℹ️ Help').row()
  .text('🐋 Whales').text('🔄 Arb').text('📡 Funding').row()
  .text('🏆 Leaderboard').text('🎯 Persona').text('📄 Tax')
  .resized()
  .persistent();

// ─── Inline asset picker ─────────────────────────────────────────────────────
function assetMenu(prefix: string) {
  return new InlineKeyboard()
    .text('₿ BTC', `${prefix}:BTC`).text('Ξ ETH', `${prefix}:ETH`).text('◎ SOL', `${prefix}:SOL`).row()
    .text('🔴 AVAX', `${prefix}:AVAX`).text('🔗 LINK', `${prefix}:LINK`).text('🐶 DOGE', `${prefix}:DOGE`).row()
    .text('🟣 ARB', `${prefix}:ARB`).text('🔵 OP', `${prefix}:OP`).text('⚡ SUI', `${prefix}:SUI`).row()
    .text('⬅️ Back', 'menu:main');
}

function mainMenuMsg() {
  return (
    `<b>🧠 SosoMind</b> — AI Crypto Intelligence (15 Unique Features)\n` +
    `<i>⛓️ Powered by SoSoValue + SoDEX · DeFi-native · AI-driven</i>\n\n` +
    `<b>📊 Market Intelligence:</b>\n` +
    `🔬 <b>Research</b> — Deep AI analysis (13+ sources)\n` +
    `⚡ <b>Signal</b> — Live price + AI signal\n` +
    `📊 <b>Briefing</b> — ETF/Macro/Sectors daily brief\n` +
    `🐋 <b>Whales</b> — Smart money: ETF flows, treasuries, VC\n` +
    `🔄 <b>Arb</b> — Cross-exchange arbitrage scanner\n` +
    `📡 <b>Funding</b> — Perps funding rate contrarian signals\n\n` +
    `<b>💼 Portfolio &amp; Trading:</b>\n` +
    `💼 <b>Portfolio</b> — Positions, trades &amp; PnL\n` +
    `🏆 <b>Leaderboard</b> — Top paper traders\n` +
    `📚 <b>Playbook</b> — Macro event trading strategies\n` +
    `⚖️ <b>Rebalance</b> — AI portfolio rebalancer\n\n` +
    `<b>🧠 AI Features:</b>\n` +
    `🎯 <b>Persona</b> — Set your trader style (quiz)\n` +
    `📄 <b>Tax</b> — Auto tax report export\n` +
    `🔔 <b>Alerts</b> — Price alerts &amp; notifications\n` +
    `📓 <b>Journal</b> — Signal history &amp; accuracy\n\n` +
    `<b>💬 NLP:</b> Type naturally — <i>"buy $500 BTC"</i> or <i>"show whale alerts"</i>\n` +
    `🎙️ <b>Voice:</b> Send a voice message to trade hands-free\n\n` +
    `💎 <i>Zero mocks · Real APIs · EIP-712 signed trades</i>`
  );
}

export function createBot(): Bot | null {
  if (!TOKEN) {
    console.warn('TELEGRAM_BOT_TOKEN not set. Bot disabled.');
    return null;
  }

  const bot = new Bot(TOKEN);

  // ── Auto-register: create an embedded wallet for every new user ────────────
  // Every Telegram user gets a dedicated EVM wallet on first contact.
  // This enables instant trading without MetaMask or any external setup.
  bot.use(async (ctx, next) => {
    const chatId = String(ctx.chat?.id ?? '');
    if (chatId) {
      const username = ctx.from?.username ?? null;
      const firstName = ctx.from?.first_name ?? null;
      // Fire-and-forget: don't block handler if DB is slow
      getOrCreateTelegramWallet(chatId, username, firstName).catch(() => {});
    }
    return next();
  });

  // ── /start & /help ──────────────────────────────────────────────────────────
  const sendMainMenu = async (ctx: Context) => {
    const kb = new InlineKeyboard()
      .text('🔬 Research', 'menu:research').text('⚡ Signal', 'menu:signal').row()
      .text('💼 Portfolio', 'menu:portfolio').text('📊 Briefing', 'briefing:now').row()
      .text('🐋 Whales', 'whales:refresh').text('🔄 Arb', 'arb:refresh').row()
      .text('📡 Funding', 'funding:refresh').text('🏆 Leaderboard', 'leaderboard:refresh').row()
      .text('📚 Playbook', 'playbook:cmd').text('⚖️ Rebalance', 'rebalance:cmd').row()
      .text('🎯 Persona', 'persona:view').text('📄 Tax Report', 'tax:cmd').row()
      .text('🔔 Alerts', 'menu:alerts').text('📓 Journal', 'journal:view').row()
      .text('🤝 Subscribe', 'subscribe:btc,macro,etf').text('⚙️ Settings', 'settings:view');

    const text = mainMenuMsg();
    if ((ctx as any).callbackQuery) {
      await (ctx as any).editMessageText(text, { parse_mode: 'HTML', reply_markup: kb });
      await (ctx as any).answerCallbackQuery();
    } else {
      await ctx.reply(text, { parse_mode: 'HTML', reply_markup: kb });
      // Show embedded wallet address on first start
      const chatId = String(ctx.chat?.id ?? '');
      if (chatId) {
        const embWallet = await getOrCreateTelegramWallet(chatId, ctx.from?.username, ctx.from?.first_name).catch(() => null);
        if (embWallet) {
          await ctx.reply(
            `👛 <b>Your SosoMind Wallet</b>\n\n` +
            `<code>${embWallet.wallet_address}</code>\n\n` +
            `<i>This wallet is auto-generated for you on SoDEX Testnet.\n` +
            `Fund it with testnet tokens to start trading — no MetaMask needed!</i>`,
            { parse_mode: 'HTML' }
          );
        }
      }
      // Also send the persistent keyboard
      await ctx.reply(
        `🔑 <b>Quick keyboard activated</b> — tap any button below or use inline buttons above.`,
        { parse_mode: 'HTML', reply_markup: MAIN_KB }
      );
    }
  };

  bot.command('start', sendMainMenu);
  bot.command('help', sendMainMenu);
  bot.hears('ℹ️ Help', sendMainMenu);
  bot.callbackQuery('menu:main', sendMainMenu);

  // ── Research ────────────────────────────────────────────────────────────────
  const sendResearchMenu = async (ctx: Context) => {
    const text =
      `🔬 <b>Deep Research</b>\n\n` +
      `<i>Fetches 13+ data sources: price, ETF flows, macro events,\n` +
      `sector momentum, crypto stocks, fear-greed index — then AI-synthesises.</i>\n\n` +
      `Select an asset or type: <code>/research ASSET</code>`;
    const kb = assetMenu('research');
    if ((ctx as any).callbackQuery) {
      await (ctx as any).editMessageText(text, { parse_mode: 'HTML', reply_markup: kb });
      await (ctx as any).answerCallbackQuery();
    } else {
      await ctx.reply(text, { parse_mode: 'HTML', reply_markup: kb });
    }
  };

  bot.command('research', async (ctx) => {
    const asset = (ctx.match || '').toString().trim().toUpperCase();
    if (!asset) return sendResearchMenu(ctx);
    await runResearch(ctx, asset);
  });
  bot.hears('🔬 Research', sendResearchMenu);
  bot.callbackQuery('menu:research', sendResearchMenu);

  bot.callbackQuery(/^research:(.+)$/, async (ctx) => {
    const asset = ctx.match[1];
    await ctx.answerCallbackQuery({ text: `🔬 Researching ${asset}…` });
    await ctx.editMessageText(
      `🔬 <b>Researching ${asset}…</b>\n\n` +
      `⛓️ Fetching on-chain data, ETF flows, macro events…\n` +
      `🤖 Running AI synthesis…\n\n<i>Please wait ~10 seconds</i>`,
      { parse_mode: 'HTML' }
    );
    await runResearch(ctx, asset);
  });

  async function runResearch(ctx: Context, asset: string) {
    try {
      const signal = await runResearchAgent(asset, { saveToDb: true });
      const report = formatResearchReport(signal);
      const kb = new InlineKeyboard()
        .text('⚡ Quick Signal', `signal:${asset}`)
        .text('📈 Trade LONG', `trade_amount:${asset}:buy`).row()
        .text('🔄 Re-research', `research:${asset}`)
        .text('⬅️ Back', 'menu:research');
      if ((ctx as any).callbackQuery) {
        await (ctx as any).editMessageText(report, { parse_mode: 'HTML', reply_markup: kb });
      } else {
        await ctx.reply(report, { parse_mode: 'HTML', reply_markup: kb });
      }
    } catch (e) {
      const errMsg = `❌ <b>Research failed</b>\n<code>${(e as Error).message}</code>`;
      const kb = new InlineKeyboard().text('🔄 Retry', `research:${asset}`).text('⬅️ Back', 'menu:research');
      if ((ctx as any).callbackQuery) {
        await (ctx as any).editMessageText(errMsg, { parse_mode: 'HTML', reply_markup: kb });
      } else {
        await ctx.reply(errMsg, { parse_mode: 'HTML', reply_markup: kb });
      }
    }
  }

  // ── Signal ──────────────────────────────────────────────────────────────────
  const sendSignalMenu = async (ctx: Context) => {
    const text =
      `⚡ <b>Live Signal</b>\n\n` +
      `<i>Fetches live price, 24h change and volume from SoSoValue.\nSelect an asset:</i>`;
    const kb = assetMenu('signal');
    if ((ctx as any).callbackQuery) {
      await (ctx as any).editMessageText(text, { parse_mode: 'HTML', reply_markup: kb });
      await (ctx as any).answerCallbackQuery();
    } else {
      await ctx.reply(text, { parse_mode: 'HTML', reply_markup: kb });
    }
  };

  bot.command('signal', async (ctx) => {
    const asset = (ctx.match || '').toString().trim().toUpperCase();
    if (!asset) return sendSignalMenu(ctx);
    await fetchSignal(ctx, asset);
  });
  bot.hears('⚡ Signal', sendSignalMenu);
  bot.callbackQuery('menu:signal', sendSignalMenu);

  bot.callbackQuery(/^signal:(.+)$/, async (ctx) => {
    const asset = ctx.match[1];
    await ctx.answerCallbackQuery({ text: `Fetching ${asset}…` });
    await fetchSignal(ctx, asset);
  });

  async function fetchSignal(ctx: Context, asset: string) {
    try {
      const s: any = await sosovalue.getMarketSnapshot(asset);
      if (!s) throw new Error(`No data for ${asset}`);
      const price = Number(s.price ?? s.last_price ?? 0);
      const chg = Number(s.change_pct_24h ?? 0) * 100;   // API field is fraction: 0.0229 = 2.29%
      const vol = Number(s.turnover_24h ?? 0);            // API field is turnover_24h
      const mktCap = Number(s.marketcap ?? 0);            // API field is lowercase marketcap
      const chgIcon = chg >= 0 ? '📈' : '📉';
      const text =
        `⚡ <b>${asset} Live Signal</b>\n\n` +
        `💰 Price: <b>$${price.toLocaleString()}</b>\n` +
        `${chgIcon} 24h Change: <b>${chg >= 0 ? '+' : ''}${chg.toFixed(2)}%</b>\n` +
        `📦 Volume 24h: $${(vol / 1e6).toFixed(1)}M\n` +
        `🏦 Market Cap: $${(mktCap / 1e9).toFixed(2)}B\n\n` +
        `<i>⛓️ Data: SoSoValue · ${new Date().toUTCString()}</i>`;
      const kb = new InlineKeyboard()
        .text('🔬 Deep Research', `research:${asset}`)
        .text('📈 Trade LONG', `trade_amount:${asset}:buy`).row()
        .text('📉 Trade SHORT', `trade_amount:${asset}:sell`)
        .text('🔄 Refresh', `signal:${asset}`).row()
        .text('⬅️ Back', 'menu:signal');
      if ((ctx as any).callbackQuery) {
        await (ctx as any).editMessageText(text, { parse_mode: 'HTML', reply_markup: kb });
      } else {
        await ctx.reply(text, { parse_mode: 'HTML', reply_markup: kb });
      }
    } catch (e) {
      const errMsg = `❌ <b>Signal failed</b>\n<code>${(e as Error).message}</code>`;
      const kb = new InlineKeyboard().text('🔄 Retry', `signal:${asset}`).text('⬅️ Back', 'menu:signal');
      if ((ctx as any).callbackQuery) {
        await (ctx as any).editMessageText(errMsg, { parse_mode: 'HTML', reply_markup: kb });
      } else {
        await ctx.reply(errMsg, { parse_mode: 'HTML', reply_markup: kb });
      }
    }
  }

  // ── Trade ───────────────────────────────────────────────────────────────────
  bot.command('trade', async (ctx) => {
    const parts = (ctx.match || '').toString().trim().split(/\s+/);
    if (parts.length < 3) {
      return ctx.reply(
        `📈 <b>Trade</b>\n\nUsage: <code>/trade LONG BTC 0.01</code>\n\nOr use the Signal menu to pick an asset.`,
        { parse_mode: 'HTML', reply_markup: new InlineKeyboard().text('⚡ Go to Signals', 'menu:signal') }
      );
    }
    const [dirRaw, asset, qtyRaw] = parts;
    await showTradeConfirm(ctx, asset.toUpperCase(), dirRaw.toUpperCase() === 'LONG' ? 'buy' : 'sell', Number(qtyRaw));
  });

  // ── Amount selector (ask how much to trade) ───────────────────────────────
  bot.callbackQuery(/^trade_amount:([^:]+):([^:]+)$/, async (ctx) => {
    const asset = ctx.match[1];
    const side = ctx.match[2] as 'buy' | 'sell';
    await ctx.answerCallbackQuery();
    // Fetch live price to show approximate qty per $ amount
    let price = 0;
    try { const s: any = await sosovalue.getMarketSnapshot(asset); price = Number(s?.price ?? 0); } catch {}
    if (!price) { try { const { getBinancePrice } = await import('../clients/market'); price = (await getBinancePrice(asset)) ?? 0; } catch {} }
    const qtyFor = (usd: number) => price > 0 ? `~${(usd / price).toFixed(4)}` : '';
    const dir = side === 'buy' ? 'LONG 📈' : 'SHORT 📉';
    const text =
      `💰 <b>How much do you want to ${dir}?</b>\n\n` +
      `Asset: <b>${asset}</b>${price ? ` | Price: <b>$${price.toLocaleString()}</b>` : ''}\n\n` +
      `Select trade size in <b>USD</b>:\n` +
      `<i>Use /trade ${side === 'buy' ? 'LONG' : 'SHORT'} ${asset} &lt;qty&gt; for custom amount</i>`;
    const kb = new InlineKeyboard()
      .text(`$10 ${qtyFor(10) ? `(${qtyFor(10)})` : ''}`, `trade_usd:${asset}:${side}:10`)
      .text(`$25 ${qtyFor(25) ? `(${qtyFor(25)})` : ''}`, `trade_usd:${asset}:${side}:25`).row()
      .text(`$50 ${qtyFor(50) ? `(${qtyFor(50)})` : ''}`, `trade_usd:${asset}:${side}:50`)
      .text(`$100 ${qtyFor(100) ? `(${qtyFor(100)})` : ''}`, `trade_usd:${asset}:${side}:100`).row()
      .text(`$250 ${qtyFor(250) ? `(${qtyFor(250)})` : ''}`, `trade_usd:${asset}:${side}:250`)
      .text(`$500 ${qtyFor(500) ? `(${qtyFor(500)})` : ''}`, `trade_usd:${asset}:${side}:500`).row()
      .text('⬅️ Back', 'menu:signal');
    if ((ctx as any).callbackQuery) {
      await (ctx as any).editMessageText(text, { parse_mode: 'HTML', reply_markup: kb });
    } else {
      await ctx.reply(text, { parse_mode: 'HTML', reply_markup: kb });
    }
  });

  // USD amount selected → compute qty and show confirmation
  bot.callbackQuery(/^trade_usd:([^:]+):([^:]+):(\d+)$/, async (ctx) => {
    const asset = ctx.match[1];
    const side = ctx.match[2] as 'buy' | 'sell';
    const usd = Number(ctx.match[3]);
    await ctx.answerCallbackQuery({ text: `Computing quantity for $${usd}…` });
    let price = 0;
    try { const s: any = await sosovalue.getMarketSnapshot(asset); price = Number(s?.price ?? 0); } catch {}
    if (!price) { try { const { getBinancePrice } = await import('../clients/market'); price = (await getBinancePrice(asset)) ?? 0; } catch {} }
    const qty = price > 0 ? Math.max(parseFloat((usd / price).toFixed(5)), 0.00001) : 0.01;
    await showTradeConfirm(ctx, asset, side, qty);
  });

  // Legacy quick trade (from /trade command path and trade_again buttons)
  bot.callbackQuery(/^trade_quick:([^:]+):([^:]+):([^:]+)$/, async (ctx) => {
    const asset = ctx.match[1];
    const side = ctx.match[2] as 'buy' | 'sell';
    const qty = Number(ctx.match[3]);
    await ctx.answerCallbackQuery();
    await showTradeConfirm(ctx, asset, side, qty);
  });

  async function showTradeConfirm(ctx: Context, asset: string, side: 'buy' | 'sell', qty: number) {
    let price = 0;
    try {
      const s: any = await sosovalue.getMarketSnapshot(asset);
      price = Number(s?.price ?? s?.last_price ?? 0);
    } catch {}
    const estValue = (price * qty).toFixed(2);
    const market = `v${asset}_vUSDC`;
    const chatId = String((ctx as any).chat?.id ?? '');

    // Resolve user's embedded wallet (always available — created on first contact)
    let embeddedWallet: { wallet_address: string; encrypted_key: string } | null = null;
    if (chatId) {
      embeddedWallet = await getOrCreateTelegramWallet(chatId, ctx.from?.username, ctx.from?.first_name).catch(() => null);
    }

    // Check if user has a linked external wallet (MetaMask via dashboard)
    let linkedWallet: string | null = null;
    if (chatId) {
      try {
        const { data } = await supabase.from('user_profiles')
          .select('wallet_address').eq('telegram_chat_id', chatId).maybeSingle();
        linkedWallet = (data as any)?.wallet_address ?? null;
      } catch {}
    }

    // Only show the browser-sign button if DASHBOARD_URL is a real public https URL
    const dashboardUrl = process.env.DASHBOARD_URL || '';
    const isPublicUrl = dashboardUrl.startsWith('https://') && !dashboardUrl.includes('localhost');

    const activeWallet = linkedWallet ?? embeddedWallet?.wallet_address ?? null;
    const isEmbedded = !linkedWallet && !!embeddedWallet;

    const text =
      `🔐 <b>Trade Confirmation</b>\n\n` +
      `⛓️ Network: SoDEX ${process.env.SODEX_CHAIN_ID === '286623' ? 'Mainnet' : 'Testnet'} (chainId ${process.env.SODEX_CHAIN_ID || '138565'})\n` +
      `🪙 Asset: <b>${asset}</b>\n` +
      `${side === 'buy' ? '📈' : '📉'} Direction: <b>${side === 'buy' ? 'LONG (Buy)' : 'SHORT (Sell)'}</b>\n` +
      `📦 Quantity: <b>${qty}</b>\n` +
      `💰 Est. Price: $${price.toLocaleString()}\n` +
      `💵 Est. Value: $${estValue}\n` +
      (activeWallet
        ? `👛 Wallet: <code>${activeWallet.slice(0, 6)}…${activeWallet.slice(-4)}</code>${isEmbedded ? ' <i>(auto)</i>' : ' <i>(MetaMask)</i>'}\n`
        : '') +
      `\n<i>EIP-712 signed · SoDEX Testnet</i>`;

    const kb = new InlineKeyboard();

    // Browser sign button — only if dashboard is deployed publicly AND user has MetaMask linked
    if (isPublicUrl && linkedWallet) {
      const orderPayload = {
        scope: 'spot' as const,
        actionName: 'batchNewOrder' as const,
        market,
        side,
        orderType: 'market' as const,
        quantity: qty,
      };
      const b64 = Buffer.from(JSON.stringify(orderPayload), 'utf8')
        .toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
      kb.url('🦊 Sign with MetaMask', `${dashboardUrl}/trade/sign?p=${b64}`).row();
    }

    // Execute button — always available (uses embedded wallet or house account)
    const execLabel = embeddedWallet
      ? `⚡ Execute (Your Wallet)`
      : `⚙️ Execute (House Account)`;
    kb.text(execLabel, `tx:${market}:${side}:${qty}`).row();
    kb.text('❌ Cancel', 'tx:cancel').text('⬅️ Back', 'menu:signal');

    if ((ctx as any).callbackQuery) {
      await (ctx as any).editMessageText(text, { parse_mode: 'HTML', reply_markup: kb, link_preview_options: { is_disabled: true } });
    } else {
      await ctx.reply(text, { parse_mode: 'HTML', reply_markup: kb, link_preview_options: { is_disabled: true } });
    }
  }

  bot.callbackQuery(/^tx:/, async (ctx) => {
    const data = ctx.callbackQuery.data;
    if (data === 'tx:cancel') {
      await ctx.editMessageText(
        `❌ <b>Trade Cancelled</b>\n<i>No order was sent.</i>`,
        { parse_mode: 'HTML', reply_markup: new InlineKeyboard().text('⬅️ Back to Menu', 'menu:main') }
      );
      return ctx.answerCallbackQuery();
    }
    const [, market, side, qtyStr] = data.split(':');
    await ctx.answerCallbackQuery({ text: '⛓️ Signing & submitting…' });
    await ctx.editMessageText(
      `⏳ <b>Executing Trade…</b>\n\n🔐 Signing EIP-712…\n📡 Sending to SoDEX…`,
      { parse_mode: 'HTML' }
    );
    try {
      // Use embedded wallet if available — per-user non-custodial execution
      const chatId = String((ctx as any).chat?.id ?? '');
      let sodexResult: any = null;
      let walletUsed = 'house';

      if (chatId) {
        const embWallet = await getOrCreateTelegramWallet(chatId, ctx.from?.username, ctx.from?.first_name).catch(() => null);
        if (embWallet) {
          const { decryptPrivateKey } = await import('../utils/walletCrypto');
          const { SoDEXClient } = await import('../clients/sodex');
          const userClient = new SoDEXClient({
            chainId: parseInt(process.env.SODEX_CHAIN_ID || '138565', 10),
            privateKey: decryptPrivateKey(embWallet.encrypted_key),
            isTestnet: true,
          });
          // Resolve symbolID and accountID from SoDEX
          const symbolID = await userClient.resolveSymbolID(market, 'spot').catch(() => 0);
          const accountID = await userClient.resolveAccountID().catch(() => 0);
          if (symbolID > 0) {
            sodexResult = await userClient.placeSpotOrder({
              accountID,
              symbolID,
              clOrdID: `bot-${Date.now()}`,
              side: (side === 'buy' ? 1 : 2) as 1 | 2,
              type: 2 as 1 | 2, // market
              timeInForce: 3 as 1 | 2 | 3,
              quantity: String(qtyStr),
            });
            walletUsed = `${embWallet.wallet_address.slice(0, 6)}…${embWallet.wallet_address.slice(-4)}`;
          }
        }
      }

      // Fallback: house execution agent
      if (!sodexResult) {
        const result = await runExecutionAgent({
          market,
          side: side as 'buy' | 'sell',
          amount: Number(qtyStr),
          orderType: 'market',
        });
        const statusIcon = result.status === 'submitted' ? '✅' : '⚠️';
        const text =
          `${statusIcon} <b>Execution Result</b>\n\n` +
          `📊 Status: <b>${result.status}</b>\n` +
          `🛡️ Risk: <b>${result.risk?.verdict}</b>\n` +
          `📋 ${(result.risk?.reasons || []).join(' · ')}\n` +
          `🪙 Trade ID: <code>${result.trade?.id || 'n/a'}</code>\n` +
          (result.status === 'failed' && (result as any).error
            ? `\n❌ Error: <code>${String((result as any).error).slice(0, 200)}</code>\n`
            : '') +
          `\n<i>⛓️ House account · SoDEX Testnet</i>`;
        const kb = new InlineKeyboard()
          .text('💼 View Portfolio', 'menu:portfolio')
          .text('🔄 Trade Again', `trade_quick:${market.split('_')[0]}:${side}:${qtyStr}`).row()
          .text('🏠 Main Menu', 'menu:main');
        return await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: kb });
      }

      // Embedded wallet execution result
      const orderId = sodexResult?.data?.orders?.[0]?.orderID ?? sodexResult?.orderID ?? 'n/a';
      const text =
        `✅ <b>Order Submitted</b>\n\n` +
        `🪙 Market: <b>${market}</b>\n` +
        `📊 Side: <b>${side.toUpperCase()}</b>\n` +
        `📦 Qty: <b>${qtyStr}</b>\n` +
        `🔖 Order ID: <code>${orderId}</code>\n` +
        `👛 Wallet: <code>${walletUsed}</code>\n` +
        `\n<i>⛓️ Your wallet · EIP-712 signed · SoDEX Testnet</i>`;
      const kb = new InlineKeyboard()
        .text('💼 View Portfolio', 'menu:portfolio')
        .text('🔄 Trade Again', `trade_quick:${market.split('_')[0]}:${side}:${qtyStr}`).row()
        .text('🏠 Main Menu', 'menu:main');
      await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: kb });
    } catch (e) {
      await ctx.editMessageText(
        `❌ <b>Execution Error</b>\n<code>${(e as Error).message}</code>`,
        { parse_mode: 'HTML', reply_markup: new InlineKeyboard().text('⬅️ Back', 'menu:main') }
      );
    }
  });

  // ── Portfolio ───────────────────────────────────────────────────────────────
  const sendPortfolio = async (ctx: Context) => {
    try {
      const [{ data: positions }, { data: trades }] = await Promise.all([
        supabase.from('positions').select('*').eq('status', 'open'),
        supabase.from('trades').select('*').order('created_at', { ascending: false }).limit(5),
      ]);
      const lines: string[] = ['💼 <b>Portfolio Overview</b>', ''];
      lines.push('🏦 <b>Open Positions</b>');
      if (!positions?.length) lines.push('  <i>No open positions yet.</i>');
      else for (const p of positions)
        lines.push(`  ${p.side === 'buy' ? '📈' : '📉'} <b>${p.market}</b> | ${p.size} @ $${Number(p.entry_price).toLocaleString()}`);
      lines.push('');
      lines.push('🧾 <b>Recent Trades</b>');
      if (!trades?.length) lines.push('  <i>No trades recorded yet.</i>');
      else for (const t of trades)
        lines.push(`  ${t.side === 'buy' ? '📈' : '📉'} ${t.market} · ${t.amount} @ $${Number(t.price).toLocaleString()} · ${t.status}`);
      const kb = new InlineKeyboard()
        .text('🔄 Refresh', 'menu:portfolio').text('📊 Stats', 'portfolio:stats').row()
        .text('🔬 Research BTC', 'research:BTC').text('🏠 Menu', 'menu:main');
      const text = lines.join('\n');
      if ((ctx as any).callbackQuery) {
        await (ctx as any).editMessageText(text, { parse_mode: 'HTML', reply_markup: kb });
        await (ctx as any).answerCallbackQuery();
      } else {
        await ctx.reply(text, { parse_mode: 'HTML', reply_markup: kb });
      }
    } catch (e) {
      const errMsg = `❌ <b>Portfolio Error</b>\n<code>${(e as Error).message}</code>`;
      if ((ctx as any).callbackQuery) await (ctx as any).editMessageText(errMsg, { parse_mode: 'HTML' });
      else await ctx.reply(errMsg, { parse_mode: 'HTML' });
    }
  };

  bot.command('portfolio', sendPortfolio);
  bot.hears('💼 Portfolio', sendPortfolio);
  bot.callbackQuery('menu:portfolio', sendPortfolio);

  bot.callbackQuery('portfolio:stats', async (ctx) => {
    await ctx.answerCallbackQuery({ text: 'Fetching stats…' });
    const { data: trades } = await supabase.from('trades').select('*').order('created_at', { ascending: false }).limit(50);
    const total = trades?.length ?? 0;
    const filled = (trades ?? []).filter((t) => t.status === 'filled').length;
    const vol = (trades ?? []).reduce((s, t) => s + Number(t.amount ?? 0) * Number(t.price ?? 0), 0);
    const text =
      `📊 <b>Trade Stats (last 50)</b>\n\n` +
      `📋 Total Trades: <b>${total}</b>\n` +
      `✅ Filled: <b>${filled}</b>\n` +
      `📦 Total Volume: <b>$${vol.toFixed(2)}</b>\n\n` +
      `<i>⛓️ Source: Supabase trades table</i>`;
    await ctx.editMessageText(text, {
      parse_mode: 'HTML',
      reply_markup: new InlineKeyboard().text('⬅️ Back', 'menu:portfolio').text('🏠 Menu', 'menu:main'),
    });
  });

  // ── Briefing ─────────────────────────────────────────────────────────────────
  const runBriefing = async (ctx: Context) => {
    const loadingText = `📡 <b>Compiling Market Briefing…</b>\n\n🔍 Fetching ETF flows…\n⛓️ Loading macro events…\n📰 Getting hot news…`;
    if ((ctx as any).callbackQuery) {
      await (ctx as any).editMessageText(loadingText, { parse_mode: 'HTML' });
      await (ctx as any).answerCallbackQuery({ text: 'Compiling briefing…' });
    } else {
      await ctx.reply(loadingText, { parse_mode: 'HTML' });
    }
    try {
      const [hot, sectors, etfList, macros] = await Promise.all([
        sosovalue.getHotNews({ page_size: 5 }).catch(() => [] as any),
        sosovalue.getSectorSpotlight().catch(() => [] as any),
        sosovalue.getETFList('BTC', 'US').catch(() => [] as any[]),
        sosovalue.getMacroEvents().catch(() => [] as any[]),
      ]);
      // Fetch snapshots for top-3 ETFs in parallel (each has net_inflow field)
      const etfTickers = (Array.isArray(etfList) ? etfList.slice(0, 3) : []).map((e: any) => e.ticker).filter(Boolean);
      const etfSnaps = (await Promise.all(
        etfTickers.map((t: string) => sosovalue.getETFMarketSnapshot(t).catch(() => null))
      )).filter(Boolean);
      const briefText = formatBriefing({ hot, sectors, etfs: etfSnaps.length ? etfSnaps : (etfList as any), macros });
      const kb = new InlineKeyboard()
        .text('🔄 Refresh', 'briefing:now').text('📢 Publish', 'publish:BTC').row()
        .text('🔬 Research BTC', 'research:BTC').text('🏠 Menu', 'menu:main');
      if ((ctx as any).callbackQuery) {
        await (ctx as any).editMessageText(briefText, { parse_mode: 'HTML', reply_markup: kb });
      } else {
        await ctx.reply(briefText, { parse_mode: 'HTML', reply_markup: kb });
      }
    } catch (e) {
      const errMsg = `❌ <b>Briefing Error</b>\n<code>${(e as Error).message}</code>`;
      const kb = new InlineKeyboard().text('🔄 Retry', 'briefing:now').text('⬅️ Back', 'menu:main');
      if ((ctx as any).callbackQuery) await (ctx as any).editMessageText(errMsg, { parse_mode: 'HTML', reply_markup: kb });
      else await ctx.reply(errMsg, { parse_mode: 'HTML', reply_markup: kb });
    }
  };

  bot.command('briefing', runBriefing);
  bot.hears('📊 Briefing', runBriefing);
  bot.callbackQuery('briefing:now', runBriefing);

  // ── Publish ──────────────────────────────────────────────────────────────────
  bot.command('publish', async (ctx) => {
    const asset = (ctx.match || '').toString().trim().toUpperCase() || 'BTC';
    await publishContent(ctx, asset);
  });

  bot.callbackQuery(/^publish:(.+)$/, async (ctx) => {
    const asset = ctx.match[1];
    await ctx.answerCallbackQuery({ text: `Publishing ${asset}…` });
    await publishContent(ctx, asset);
  });

  async function publishContent(ctx: Context, asset: string) {
    const loadMsg = `📝 <b>Composing publishable post for ${asset}…</b>`;
    if ((ctx as any).callbackQuery) {
      await (ctx as any).editMessageText(loadMsg, { parse_mode: 'HTML' });
    } else {
      await ctx.reply(loadMsg, { parse_mode: 'HTML' });
    }
    const signal = await runResearchAgent(asset, { saveToDb: true });
    const post = formatResearchReport(signal);
    await supabase.from('content_posts').insert({
      title: `SosoMind Research: ${asset}`,
      body: post,
      summary: signal.reasoning?.slice(0, 200),
      sector: null,
      symbols: [asset],
      sentiment: signal.direction.toLowerCase(),
      confidence: signal.confidence,
    });
    const channel = process.env.TELEGRAM_CHANNEL_ID;
    const kb = new InlineKeyboard().text('🔄 Publish Again', `publish:${asset}`).text('🏠 Menu', 'menu:main');
    if (channel) {
      try {
        await bot.api.sendMessage(channel, post, { parse_mode: 'HTML' });
        const successMsg = `✅ <b>Published to ${channel}</b>\n<i>Post saved to content_posts DB.</i>`;
        if ((ctx as any).callbackQuery) await (ctx as any).editMessageText(successMsg, { parse_mode: 'HTML', reply_markup: kb });
        else await ctx.reply(successMsg, { parse_mode: 'HTML', reply_markup: kb });
      } catch (e) {
        const errMsg = `⚠️ <b>Channel publish failed</b>\n<code>${(e as Error).message}</code>\n\n<i>Post saved to DB. Preview:</i>`;
        if ((ctx as any).callbackQuery) await (ctx as any).editMessageText(errMsg, { parse_mode: 'HTML', reply_markup: kb });
        else await ctx.reply(errMsg, { parse_mode: 'HTML', reply_markup: kb });
        await ctx.reply(post, { parse_mode: 'HTML' });
      }
    } else {
      const noChannelMsg = `ℹ️ <b>No TELEGRAM_CHANNEL_ID set</b>\n\nSet <code>TELEGRAM_CHANNEL_ID=@yourchannel</code> in .env to publish.\n\n<b>Preview:</b>`;
      if ((ctx as any).callbackQuery) await (ctx as any).editMessageText(noChannelMsg, { parse_mode: 'HTML', reply_markup: kb });
      else await ctx.reply(noChannelMsg, { parse_mode: 'HTML', reply_markup: kb });
      await ctx.reply(post, { parse_mode: 'HTML' });
    }
  }

  // ── Alerts ───────────────────────────────────────────────────────────────────
  const sendAlertsMenu = async (ctx: Context) => {
    const { data: alerts } = await supabase.from('alerts').select('*').eq('is_active', true).limit(10);
    const lines = ['🔔 <b>Active Alerts</b>\n'];
    if (!alerts?.length) lines.push('<i>No active alerts.</i>');
    else for (const a of alerts)
      lines.push(`• <b>${a.asset}</b> ${a.condition === 'gt' ? '▲ above' : '▼ below'} <b>$${Number(a.threshold).toLocaleString()}</b> — ${a.triggered ? '✅ Triggered' : '⏳ Waiting'}`);
    lines.push('\n<i>Add new: <code>/alert BTC gt 80000</code></i>');
    const kb = new InlineKeyboard()
      .text('🔔 BTC > $80k', 'alert_quick:BTC:gt:80000').text('🔔 ETH < $2k', 'alert_quick:ETH:lt:2000').row()
      .text('🗑️ Clear All', 'alerts:clear').text('🔄 Refresh', 'menu:alerts').row()
      .text('⬅️ Back', 'menu:main');
    const text = lines.join('\n');
    if ((ctx as any).callbackQuery) {
      await (ctx as any).editMessageText(text, { parse_mode: 'HTML', reply_markup: kb });
      await (ctx as any).answerCallbackQuery();
    } else {
      await ctx.reply(text, { parse_mode: 'HTML', reply_markup: kb });
    }
  };

  bot.command('alert', async (ctx) => {
    const parts = (ctx.match || '').toString().trim().split(/\s+/);
    if (parts.length < 3) return sendAlertsMenu(ctx);
    const [asset, cond, valStr] = parts;
    await createAlert(ctx, asset.toUpperCase(), cond as 'gt' | 'lt', Number(valStr));
  });
  bot.hears('🔔 Alerts', sendAlertsMenu);
  bot.callbackQuery('menu:alerts', sendAlertsMenu);

  bot.callbackQuery(/^alert_quick:([^:]+):([^:]+):([^:]+)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    await createAlert(ctx, ctx.match[1], ctx.match[2] as 'gt' | 'lt', Number(ctx.match[3]));
  });

  bot.callbackQuery('alerts:clear', async (ctx) => {
    const chatId = String(ctx.chat?.id ?? '');
    await supabase.from('alerts').update({ is_active: false }).eq('is_active', true);
    await ctx.answerCallbackQuery({ text: '🗑️ All alerts cleared' });
    await sendAlertsMenu(ctx);
  });

  async function createAlert(ctx: Context, asset: string, cond: 'gt' | 'lt', threshold: number) {
    if (!threshold) return ctx.reply('❌ Invalid threshold. Usage: /alert BTC gt 80000');
    const { data, error } = await supabase.from('alerts').insert({
      type: cond === 'gt' ? 'price_above' : 'price_below',
      asset,
      threshold,
      condition: cond,
      message: `${asset} ${cond === 'gt' ? '▲ above' : '▼ below'} $${threshold.toLocaleString()}`,
      is_active: true,
    }).select('*').single();
    if (error) {
      const errMsg = `❌ <b>Alert Error</b>\n<code>${error.message}</code>`;
      if ((ctx as any).callbackQuery) await (ctx as any).editMessageText(errMsg, { parse_mode: 'HTML' });
      else await ctx.reply(errMsg, { parse_mode: 'HTML' });
      return;
    }
    const successMsg =
      `🔔 <b>Alert Created!</b>\n\n` +
      `🪙 Asset: <b>${asset}</b>\n` +
      `📊 Condition: ${cond === 'gt' ? '▲ Price above' : '▼ Price below'} <b>$${threshold.toLocaleString()}</b>\n` +
      `🆔 ID: <code>${data.id}</code>`;
    const kb = new InlineKeyboard().text('🔔 View All Alerts', 'menu:alerts').text('🏠 Menu', 'menu:main');
    if ((ctx as any).callbackQuery) await (ctx as any).editMessageText(successMsg, { parse_mode: 'HTML', reply_markup: kb });
    else await ctx.reply(successMsg, { parse_mode: 'HTML', reply_markup: kb });
  }

  // ── Journal ──────────────────────────────────────────────────────────────────
  const sendJournal = async (ctx: Context) => {
    try {
      const signals = await getSignals({ limit: 10 });
      const lines: string[] = ['📓 <b>Signal Journal</b> — last 10 signals\n'];
      if (!signals.length) lines.push('<i>No signals yet. Run /research BTC to start.</i>');
      else {
        for (const s of signals) {
          const dirIcon = s.direction?.toUpperCase() === 'LONG' ? '📈' : s.direction?.toUpperCase() === 'SHORT' ? '📉' : '➡️';
          const conf = Number(s.confidence ?? 0);
          const confBar = '█'.repeat(Math.round(conf / 10)) + '░'.repeat(10 - Math.round(conf / 10));
          lines.push(`${dirIcon} <b>${s.asset}</b> | ${s.direction?.toUpperCase()} | ${s.status || 'active'}`);
          lines.push(`   Confidence: [${confBar}] ${conf}%`);
          if (s.reasoning) lines.push(`   <i>${String(s.reasoning).slice(0, 80)}…</i>`);
          lines.push('');
        }
        const total = signals.length;
        const active = signals.filter((s) => s.status === 'active').length;
        lines.push(`📊 Total: ${total} | Active: ${active}`);
      }
      const kb = new InlineKeyboard()
        .text('🔄 Refresh', 'journal:view').text('🔬 New Research', 'menu:research').row()
        .text('⬅️ Back', 'menu:main');
      const text = lines.join('\n');
      if ((ctx as any).callbackQuery) {
        await (ctx as any).editMessageText(text, { parse_mode: 'HTML', reply_markup: kb });
        await (ctx as any).answerCallbackQuery();
      } else {
        await ctx.reply(text, { parse_mode: 'HTML', reply_markup: kb });
      }
    } catch (e) {
      const errMsg = `❌ <b>Journal Error</b>\n<code>${(e as Error).message}</code>`;
      if ((ctx as any).callbackQuery) await (ctx as any).editMessageText(errMsg, { parse_mode: 'HTML' });
      else await ctx.reply(errMsg, { parse_mode: 'HTML' });
    }
  };

  bot.command('journal', sendJournal);
  bot.hears('📓 Journal', sendJournal);
  bot.callbackQuery('journal:view', sendJournal);

  // ── Subscribe ─────────────────────────────────────────────────────────────────
  bot.command('subscribe', async (ctx) => {
    const segInput = (ctx.match || '').toString().trim();
    await doSubscribe(ctx, segInput);
  });
  bot.hears('🤝 Subscribe', async (ctx) => doSubscribe(ctx, ''));

  bot.callbackQuery(/^subscribe:(.+)$/, async (ctx) => {
    await ctx.answerCallbackQuery({ text: 'Subscribing…' });
    await doSubscribe(ctx, ctx.match[1]);
  });

  async function doSubscribe(ctx: Context, segInput: string) {
    const chatId = String(ctx.chat?.id ?? '');
    const userId = String(ctx.from?.id ?? chatId);
    const segments = segInput ? segInput.split(/[\s,]+/).map((s) => s.toLowerCase()).filter(Boolean) : ['btc', 'macro', 'etf'];
    try {
      await upsertSubscriber({ user_id: userId, chat_id: chatId, segments, active: true, preferences: null });
      const text =
        `✅ <b>Subscribed!</b>\n\n` +
        `📡 You'll receive automated briefings every 4 hours.\n` +
        `🏷️ Segments: <b>${segments.join(', ')}</b>\n\n` +
        `<i>Use /unsubscribe to opt out anytime.</i>`;
      const kb = new InlineKeyboard()
        .text('🔔 Set Alerts', 'menu:alerts').text('⚙️ Settings', 'settings:view').row()
        .text('🏠 Menu', 'menu:main');
      if ((ctx as any).callbackQuery) await (ctx as any).editMessageText(text, { parse_mode: 'HTML', reply_markup: kb });
      else await ctx.reply(text, { parse_mode: 'HTML', reply_markup: kb });
    } catch (e) {
      const errMsg = `❌ <b>Subscribe Error</b>\n<code>${(e as Error).message}</code>`;
      if ((ctx as any).callbackQuery) await (ctx as any).editMessageText(errMsg, { parse_mode: 'HTML' });
      else await ctx.reply(errMsg, { parse_mode: 'HTML' });
    }
  }

  bot.command('unsubscribe', async (ctx) => {
    const userId = String(ctx.from?.id ?? ctx.chat?.id ?? '');
    try {
      await supabase.from('subscribers').update({ active: false }).eq('user_id', userId);
      await ctx.reply(
        `✅ <b>Unsubscribed</b>\n\nYou will no longer receive auto-briefings.\n\n<i>Use /subscribe to re-subscribe.</i>`,
        { parse_mode: 'HTML', reply_markup: new InlineKeyboard().text('🤝 Re-subscribe', 'subscribe:btc,macro,etf').text('🏠 Menu', 'menu:main') }
      );
    } catch (e) {
      await ctx.reply(`❌ ${(e as Error).message}`);
    }
  });

  // ── /link — link Telegram to wallet ─────────────────────────────────────────
  bot.command('link', async (ctx) => {
    const code = (ctx.match || '').toString().trim().toUpperCase();
    const chatId = String(ctx.chat?.id ?? '');
    if (!code) {
      const profile = await Promise.resolve(supabase.from('user_profiles').select('wallet_address').eq('telegram_chat_id', chatId).single()).then(r => r.data).catch(() => null);
      if (profile?.wallet_address) {
        const addr = profile.wallet_address;
        return ctx.reply(
          `🔗 <b>Already linked!</b>\n\n` +
          `Your Telegram is linked to wallet:\n<code>${addr}</code>\n\n` +
          `To unlink, use <code>/unlink</code>.\n` +
          `To re-link a new wallet, generate a link code in the dashboard → Profile → Link Telegram.`,
          { parse_mode: 'HTML' }
        );
      }
      return ctx.reply(
        `🔗 <b>Link your wallet</b>\n\n` +
        `1. Open the SosoMind dashboard\n` +
        `2. Connect your MetaMask wallet\n` +
        `3. Go to Profile → <b>Link Telegram</b>\n` +
        `4. Copy the 6-digit code and send:\n\n` +
        `<code>/link YOUR_CODE</code>`,
        { parse_mode: 'HTML' }
      );
    }
    // Call the internal link-telegram endpoint
    try {
      const resp = await fetch(`http://localhost:${process.env.PORT || 10000}/api/auth/link-telegram`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, telegramChatId: chatId }),
      });
      const json = await resp.json() as any;
      if (!resp.ok) {
        return ctx.reply(`❌ <b>Link failed</b>\n${json.error ?? 'Invalid or expired code'}`, { parse_mode: 'HTML' });
      }
      const addr = json.address;
      await ctx.reply(
        `✅ <b>Wallet linked!</b>\n\n` +
        `Your Telegram account is now linked to:\n<code>${addr}</code>\n\n` +
        `You'll now receive personalized signals and alerts based on your wallet profile.\n\n` +
        `<i>Use /unlink to disconnect anytime.</i>`,
        { parse_mode: 'HTML', reply_markup: new InlineKeyboard().text('🏠 Menu', 'menu:main') }
      );
    } catch (e) {
      await ctx.reply(`❌ Link error: ${(e as Error).message}`, { parse_mode: 'HTML' });
    }
  });

  bot.command('unlink', async (ctx) => {
    const chatId = String(ctx.chat?.id ?? '');
    try {
      await supabase.from('user_profiles').update({ telegram_chat_id: null }).eq('telegram_chat_id', chatId);
      await ctx.reply(
        `✅ <b>Wallet unlinked</b>\n\nYour Telegram is no longer linked to any wallet.\n\nUse <code>/link CODE</code> to re-link.`,
        { parse_mode: 'HTML' }
      );
    } catch (e) {
      await ctx.reply(`❌ ${(e as Error).message}`);
    }
  });

  // ── Settings ──────────────────────────────────────────────────────────────────
  const sendSettings = async (ctx: Context) => {
    const userId = String(ctx.from?.id ?? ctx.chat?.id ?? '');
    const maxSize = (await getUserPreference(userId, 'max_trade_size_pct')) ?? 25;
    const stopLoss = (await getUserPreference(userId, 'default_stop_loss_pct')) ?? 5;
    const autoResearch = (await getUserPreference(userId, 'auto_research')) ?? true;
    const notifications = (await getUserPreference(userId, 'notifications')) ?? true;
    const text =
      `⚙️ <b>SosoMind Settings</b>\n\n` +
      `🛡️ Max Trade Size: <b>${maxSize}%</b> of portfolio\n` +
      `⛔ Default Stop-Loss: <b>${stopLoss}%</b>\n` +
      `🤖 Auto-Research: <b>${autoResearch ? '✅ ON' : '❌ OFF'}</b>\n` +
      `🔔 Notifications: <b>${notifications ? '✅ ON' : '❌ OFF'}</b>\n\n` +
      `<i>Tap to toggle or use:\n<code>/settings max_trade_size_pct 10</code></i>`;
    const kb = new InlineKeyboard()
      .text(`🤖 Auto-Research: ${autoResearch ? '✅' : '❌'}`, `settings:toggle:auto_research:${!autoResearch}`)
      .text(`🔔 Notifs: ${notifications ? '✅' : '❌'}`, `settings:toggle:notifications:${!notifications}`).row()
      .text('📉 Stop-Loss: 3%', 'settings:set:default_stop_loss_pct:3')
      .text('📉 Stop-Loss: 5%', 'settings:set:default_stop_loss_pct:5').row()
      .text('💰 Trade: 10%', 'settings:set:max_trade_size_pct:10')
      .text('💰 Trade: 25%', 'settings:set:max_trade_size_pct:25').row()
      .text('🔄 Refresh', 'settings:view').text('⬅️ Back', 'menu:main');
    if ((ctx as any).callbackQuery) {
      await (ctx as any).editMessageText(text, { parse_mode: 'HTML', reply_markup: kb });
      await (ctx as any).answerCallbackQuery();
    } else {
      await ctx.reply(text, { parse_mode: 'HTML', reply_markup: kb });
    }
  };

  bot.command('settings', async (ctx) => {
    const arg = (ctx.match || '').toString().trim();
    if (!arg) return sendSettings(ctx);
    const [key, val] = arg.split(/\s+/, 2);
    if (!key || !val) return ctx.reply('Usage: /settings <key> <value>');
    const userId = String(ctx.from?.id ?? ctx.chat?.id ?? '');
    const parsed = val === 'true' || val === 'on' ? true : val === 'false' || val === 'off' ? false : Number(val) || val;
    await setUserPreference(userId, key, parsed);
    await ctx.reply(
      `✅ <b>Setting Updated</b>\n\n${key} = <b>${parsed}</b>`,
      { parse_mode: 'HTML', reply_markup: new InlineKeyboard().text('⚙️ View Settings', 'settings:view').text('🏠 Menu', 'menu:main') }
    );
  });
  bot.hears('⚙️ Settings', sendSettings);
  bot.callbackQuery('settings:view', sendSettings);

  bot.callbackQuery(/^settings:toggle:([^:]+):([^:]+)$/, async (ctx) => {
    const userId = String(ctx.from?.id ?? ctx.chat?.id ?? '');
    const key = ctx.match[1];
    const val = ctx.match[2] === 'true';
    await setUserPreference(userId, key, val);
    await ctx.answerCallbackQuery({ text: `${key} → ${val ? 'ON' : 'OFF'}` });
    await sendSettings(ctx);
  });

  bot.callbackQuery(/^settings:set:([^:]+):([^:]+)$/, async (ctx) => {
    const userId = String(ctx.from?.id ?? ctx.chat?.id ?? '');
    const key = ctx.match[1];
    const val = Number(ctx.match[2]);
    await setUserPreference(userId, key, val);
    await ctx.answerCallbackQuery({ text: `${key} = ${val}` });
    await sendSettings(ctx);
  });

  // ── Voice briefing ────────────────────────────────────────────────────────
  const sendVoiceBrief = async (ctx: Context) => {
    if (!hasVoice()) {
      await ctx.reply('🔇 Voice disabled. Set <code>ELEVENLABS_API_KEY</code> in .env.', { parse_mode: 'HTML' });
      return;
    }
    await ctx.reply('🎙️ Generating voice briefing…');
    try {
      const [btcSnap, etfHistory, macros] = await Promise.all([
        sosovalue.getMarketSnapshot('BTC').catch(() => null),
        sosovalue.getETFSummaryHistory('BTC', 'US', { limit: 1 }).catch(() => null),
        sosovalue.getMacroEvents().catch(() => null),
      ]);
      const macro: any = Array.isArray(macros) && macros.length ? macros[0] : null;
      const macroName = macro ? (macro.events?.[0] ?? macro.event_name ?? macro.name) : null;
      const latestEtf: any = Array.isArray(etfHistory) && etfHistory.length ? etfHistory[0] : null;
      const script = briefingScript({
        asset: 'BTC',
        price: Number((btcSnap as any)?.price ?? 0) || undefined,
        change24h: Number((btcSnap as any)?.change_pct_24h ?? 0) || undefined,
        etfFlow: latestEtf?.net_inflow ? Number(latestEtf.net_inflow) / 1e6 : undefined,
        nextMacro: macroName ?? undefined,
      });
      const buf = await generateVoiceBrief(script);
      await ctx.replyWithVoice(new InputFile(buf, 'brief.mp3'));
    } catch (e) {
      await ctx.reply(`❌ Voice generation failed: ${(e as Error).message}`);
    }
  };
  bot.command('voicebrief', sendVoiceBrief);
  bot.hears('🎙️ Voice', sendVoiceBrief);

  // ── Whale Alerts (Part 4) ─────────────────────────────────────────────────
  const sendWhaleAlerts = async (ctx: Context) => {
    const loading = `🐋 <b>Fetching Whale Alerts…</b>`;
    if ((ctx as any).callbackQuery) {
      await (ctx as any).editMessageText(loading, { parse_mode: 'HTML' });
      await (ctx as any).answerCallbackQuery({ text: 'Loading whale alerts…' });
    } else {
      await ctx.reply(loading, { parse_mode: 'HTML' });
    }
    try {
      let alerts = await runWhaleScan().catch(() => [] as import('../agents/whales').WhaleAlert[]);
      if (!alerts.length) alerts = await getWhaleAlerts(10);
      const lines = [`🐋 <b>Whale Alerts</b> (last ${alerts.length})\n`];
      if (!alerts.length) lines.push('<i>No large whale activity detected right now. Data sources: BTC treasuries, ETF flows, VC fundraising.</i>');
      else for (const a of alerts) {
        const icon = a.signal_direction === 'bullish' ? '🟢' : a.signal_direction === 'bearish' ? '🔴' : '⚪';
        const impact = a.impact === 'high' ? '🔥' : a.impact === 'medium' ? '⚠️' : 'ℹ️';
        lines.push(`${icon} ${impact} <b>${a.asset}</b> — $${(Number(a.amount_usd) / 1e6).toFixed(1)}M`);
        lines.push(`   Type: ${a.type} | Entity: ${a.entity ?? 'Unknown'}`);
        lines.push(`   <i>${a.reasoning}</i>\n`);
      }
      const kb = new InlineKeyboard()
        .text('🔄 Refresh', 'whales:refresh').text('🔬 Research', 'menu:research').row()
        .text('⬅️ Back', 'menu:main');
      const text = lines.join('\n');
      if ((ctx as any).callbackQuery) {
        await (ctx as any).editMessageText(text, { parse_mode: 'HTML', reply_markup: kb });
      } else {
        await ctx.reply(text, { parse_mode: 'HTML', reply_markup: kb });
      }
    } catch (e) {
      const errMsg = `❌ Whale Error: ${(e as Error).message}`;
      if ((ctx as any).callbackQuery) await (ctx as any).editMessageText(errMsg, { parse_mode: 'HTML' });
      else await ctx.reply(errMsg, { parse_mode: 'HTML' });
    }
  };
  bot.command('whales', sendWhaleAlerts);
  bot.hears('🐋 Whales', sendWhaleAlerts);
  bot.callbackQuery('whales:refresh', sendWhaleAlerts);

  // ── Arbitrage Scanner (Part 3) ────────────────────────────────────────────
  const sendArbitrage = async (ctx: Context) => {
    const loading = `🔄 <b>Scanning Arbitrage Opportunities…</b>`;
    if ((ctx as any).callbackQuery) {
      await (ctx as any).editMessageText(loading, { parse_mode: 'HTML' });
      await (ctx as any).answerCallbackQuery({ text: 'Scanning arbitrage…' });
    } else {
      await ctx.reply(loading, { parse_mode: 'HTML' });
    }
    try {
      const opps = await scanArbitrage();
      const lines = [`🔄 <b>Arbitrage Opportunities</b>\n`];
      if (!opps.length) lines.push('<i>No profitable arb opportunities right now. Spread too narrow or API unavailable.</i>');
      else for (const o of opps) {
        const dir = o.direction === 'buy_sodex_sell_binance' ? 'Buy SoDEX→Sell Binance' : 'Buy Binance→Sell SoDEX';
        lines.push(`💰 <b>${o.asset}</b> — Est: +${o.est_profit_pct.toFixed(3)}%`);
        lines.push(`   Spread: ${o.spread_pct.toFixed(3)}% | ${dir}`);
        lines.push(`   SoDEX: $${o.sodex_ask?.toFixed(2)} / Binance: $${o.binance_ask?.toFixed(2)}\n`);
      }
      const kb = new InlineKeyboard()
        .text('🔄 Refresh', 'arb:refresh').text('⬅️ Back', 'menu:main');
      const text = lines.join('\n');
      if ((ctx as any).callbackQuery) {
        await (ctx as any).editMessageText(text, { parse_mode: 'HTML', reply_markup: kb });
      } else {
        await ctx.reply(text, { parse_mode: 'HTML', reply_markup: kb });
      }
    } catch (e) {
      const errMsg = `❌ Arb Error: ${(e as Error).message}`;
      if ((ctx as any).callbackQuery) await (ctx as any).editMessageText(errMsg, { parse_mode: 'HTML' });
      else await ctx.reply(errMsg, { parse_mode: 'HTML' });
    }
  };
  bot.command('arb', sendArbitrage);
  bot.hears('🔄 Arb', sendArbitrage);
  bot.callbackQuery('arb:refresh', sendArbitrage);

  // ── Funding Rate Signals (Part 15) ────────────────────────────────────────
  const sendFundingSignals = async (ctx: Context) => {
    const loading = `📡 <b>Loading Funding Rate Signals…</b>`;
    if ((ctx as any).callbackQuery) {
      await (ctx as any).editMessageText(loading, { parse_mode: 'HTML' });
      await (ctx as any).answerCallbackQuery({ text: 'Loading funding rates…' });
    } else {
      await ctx.reply(loading, { parse_mode: 'HTML' });
    }
    try {
      // Try live scan first; fall back to cached DB results
      let signals: import('../agents/funding').FundingSignal[] = await runFundingRateScan().catch(() => []);
      if (!signals.length) signals = await getFundingSignals(10);
      const lines = [`📡 <b>Funding Rate Signals</b>\n`];
      if (!signals.length) lines.push('<i>SoDEX perps API unavailable right now. Funding rates require SoDEX testnet access. Try again shortly.</i>');
      else for (const s of signals) {
        const emoji = s.signal === 'strong_buy' ? '🟢🟢' : s.signal === 'buy' ? '🟢' : s.signal === 'strong_sell' ? '🔴🔴' : s.signal === 'sell' ? '🔴' : '⚪';
        lines.push(`${emoji} <b>${s.asset}</b> | Rate: ${(s.funding_rate * 100).toFixed(4)}%`);
        lines.push(`   Ann. Rate: ${s.annualized_rate.toFixed(1)}% | Strength: ${s.strength}`);
        lines.push(`   <i>${s.reasoning}</i>\n`);
      }
      const kb = new InlineKeyboard()
        .text('🔄 Refresh', 'funding:refresh').text('⬅️ Back', 'menu:main');
      const text = lines.join('\n');
      if ((ctx as any).callbackQuery) {
        await (ctx as any).editMessageText(text, { parse_mode: 'HTML', reply_markup: kb });
      } else {
        await ctx.reply(text, { parse_mode: 'HTML', reply_markup: kb });
      }
    } catch (e) {
      const errMsg = `❌ Funding Error: ${(e as Error).message}`;
      if ((ctx as any).callbackQuery) await (ctx as any).editMessageText(errMsg, { parse_mode: 'HTML' });
      else await ctx.reply(errMsg, { parse_mode: 'HTML' });
    }
  };
  bot.command('funding', sendFundingSignals);
  bot.hears('📡 Funding', sendFundingSignals);
  bot.callbackQuery('funding:refresh', sendFundingSignals);

  // ── Paper Trading Leaderboard (Part 7) ────────────────────────────────────
  const sendLeaderboard = async (ctx: Context) => {
    const loading = `🏆 <b>Loading Leaderboard…</b>`;
    if ((ctx as any).callbackQuery) {
      await (ctx as any).editMessageText(loading, { parse_mode: 'HTML' });
      await (ctx as any).answerCallbackQuery({ text: 'Loading leaderboard…' });
    } else {
      await ctx.reply(loading, { parse_mode: 'HTML' });
    }
    try {
      const entries = await getPaperLeaderboard(10);
      const lines = [`🏆 <b>Paper Trading Leaderboard</b>\n`];
      if (!entries.length) lines.push('<i>No paper traders yet. Use /papertrade to start!</i>');
      else {
        const medals = ['🥇','🥈','🥉'];
        for (let i = 0; i < entries.length; i++) {
          const e = entries[i];
          const medal = medals[i] ?? `${i+1}.`;
          lines.push(`${medal} <b>${e.user_id.slice(0,8)}…</b> | PnL: $${e.total_pnl_usd.toFixed(2)}`);
          lines.push(`   Win Rate: ${(e.win_rate * 100).toFixed(0)}% | ${e.total_trades} trades\n`);
        }
      }
      const kb = new InlineKeyboard()
        .text('🔄 Refresh', 'leaderboard:refresh')
        .text('📄 Start Paper Trade', 'papertrade:menu').row()
        .text('⬅️ Back', 'menu:main');
      const text = lines.join('\n');
      if ((ctx as any).callbackQuery) {
        await (ctx as any).editMessageText(text, { parse_mode: 'HTML', reply_markup: kb });
      } else {
        await ctx.reply(text, { parse_mode: 'HTML', reply_markup: kb });
      }
    } catch (e) {
      const errMsg = `❌ Leaderboard Error: ${(e as Error).message}`;
      if ((ctx as any).callbackQuery) await (ctx as any).editMessageText(errMsg, { parse_mode: 'HTML' });
      else await ctx.reply(errMsg, { parse_mode: 'HTML' });
    }
  };
  bot.command('leaderboard', sendLeaderboard);
  bot.hears('🏆 Leaderboard', sendLeaderboard);
  bot.callbackQuery('leaderboard:refresh', sendLeaderboard);

  // Paper trade start menu
  bot.callbackQuery('papertrade:menu', async (ctx) => {
    await ctx.answerCallbackQuery();
    const text = `📄 <b>Paper Trading</b>\n\nPractice trading with virtual funds!\nPick asset to paper trade:`;
    const kb = assetMenu('papertrade');
    await (ctx as any).editMessageText(text, { parse_mode: 'HTML', reply_markup: kb });
  });

  bot.callbackQuery(/^papertrade:([A-Z]+)$/, async (ctx) => {
    const asset = ctx.match[1];
    await ctx.answerCallbackQuery();
    const text = `📄 <b>Paper Trade ${asset}</b>\nSelect direction:`;
    const kb = new InlineKeyboard()
      .text('📈 LONG $100', `pt_exec:${asset}:buy:100`)
      .text('📉 SHORT $100', `pt_exec:${asset}:sell:100`).row()
      .text('📈 LONG $500', `pt_exec:${asset}:buy:500`)
      .text('📉 SHORT $500', `pt_exec:${asset}:sell:500`).row()
      .text('⬅️ Back', 'papertrade:menu');
    await (ctx as any).editMessageText(text, { parse_mode: 'HTML', reply_markup: kb });
  });

  bot.callbackQuery(/^pt_exec:([^:]+):([^:]+):(\d+)$/, async (ctx) => {
    const asset = ctx.match[1];
    const side = ctx.match[2] as 'buy' | 'sell';
    const amountUsd = Number(ctx.match[3]);
    const userId = String(ctx.from?.id ?? ctx.chat?.id ?? '');
    await ctx.answerCallbackQuery({ text: `Creating paper trade…` });
    try {
      const trade = await createPaperTrade(userId, asset, side, amountUsd);
      const text = `✅ <b>Paper Trade Created!</b>\n\n` +
        `${side === 'buy' ? '📈' : '📉'} <b>${side.toUpperCase()} ${asset}</b>\n` +
        `💰 Amount: $${amountUsd}\n` +
        `📊 Entry Price: $${Number(trade.entry_price).toLocaleString()}\n` +
        `🆔 Trade ID: <code>${trade.id}</code>\n\n` +
        `<i>This is simulated paper trading — no real funds at risk!</i>`;
      const kb = new InlineKeyboard()
        .text('🏆 View Leaderboard', 'leaderboard:refresh')
        .text('⬅️ Back', 'menu:main');
      await (ctx as any).editMessageText(text, { parse_mode: 'HTML', reply_markup: kb });
    } catch (e) {
      await (ctx as any).editMessageText(`❌ Paper trade failed: ${(e as Error).message}`, { parse_mode: 'HTML' });
    }
  });

  // ── Trader Persona (Part 14) ──────────────────────────────────────────────
  const sendPersonaMenu = async (ctx: Context) => {
    const userId = String(ctx.from?.id ?? ctx.chat?.id ?? '');
    const currentPersona = await getUserPersona(userId).catch(() => 'balanced');
    const cfg = PERSONAS[currentPersona as keyof typeof PERSONAS];
    const text = `🎯 <b>Trader Persona</b>\n\n` +
      `Current: <b>${currentPersona.toUpperCase()}</b>\n` +
      `Min Confidence: ${cfg.minConfidence}% | Max Risk: ${cfg.maxRiskPct}%\n` +
      `Min R:R: ${cfg.minRR} | Shorts: ${cfg.allowShorts ? 'Yes' : 'No'}\n\n` +
      `Select your trading style:`;
    const kb = new InlineKeyboard()
      .text('🦁 Aggressive', 'persona:aggressive').text('⚖️ Balanced', 'persona:balanced').row()
      .text('🛡️ Conservative', 'persona:conservative').text('🤖 Quant', 'persona:quant').row()
      .text('🌊 Swing', 'persona:swing').row()
      .text('📝 Take Quiz', 'persona:quiz').text('⬅️ Back', 'menu:main');
    if ((ctx as any).callbackQuery) {
      await (ctx as any).editMessageText(text, { parse_mode: 'HTML', reply_markup: kb });
      await (ctx as any).answerCallbackQuery();
    } else {
      await ctx.reply(text, { parse_mode: 'HTML', reply_markup: kb });
    }
  };
  bot.command('persona', sendPersonaMenu);
  bot.hears('🎯 Persona', sendPersonaMenu);
  bot.callbackQuery('persona:view', sendPersonaMenu);

  bot.callbackQuery(/^persona:(aggressive|balanced|conservative|quant|swing)$/, async (ctx) => {
    const persona = ctx.match[1] as any;
    const userId = String(ctx.from?.id ?? ctx.chat?.id ?? '');
    await ctx.answerCallbackQuery({ text: `Setting persona to ${persona}…` });
    await setUserPersona(userId, persona);
    const cfg = (PERSONAS as any)[String(persona)];
    const text = `✅ <b>Persona Updated: ${persona.toUpperCase()}</b>\n\n` +
      `🎯 Min Confidence: ${cfg.minConfidence}%\n` +
      `⚠️ Max Risk per Trade: ${cfg.maxRiskPct}%\n` +
      `📊 Min R:R: ${cfg.minRR}\n` +
      `📉 Shorts Allowed: ${cfg.allowShorts ? 'Yes' : 'No'}\n` +
      `🕐 Timeframes: ${cfg.preferredTimeframes.join(', ')}\n\n` +
      `<i>AI signals will now be filtered to match your style.</i>`;
    const kb = new InlineKeyboard().text('⬅️ Back', 'persona:view').text('🏠 Menu', 'menu:main');
    await (ctx as any).editMessageText(text, { parse_mode: 'HTML', reply_markup: kb });
  });

  bot.callbackQuery('persona:quiz', async (ctx) => {
    await ctx.answerCallbackQuery();
    const quiz = getPersonaQuiz();
    const q = quiz[0];
    const kb = new InlineKeyboard();
    q.options.forEach((opt, i) => kb.text(opt, `quiz_ans:0:${i}`).row());
    const text = `📝 <b>Persona Quiz</b> (Q1/${quiz.length})\n\n${q.question}`;
    await (ctx as any).editMessageText(text, { parse_mode: 'HTML', reply_markup: kb });
    // Store quiz state in user preferences
    const userId = String(ctx.from?.id ?? ctx.chat?.id ?? '');
    await setUserPreference(userId, '_quiz_answers', []);
  });

  bot.callbackQuery(/^quiz_ans:(\d+):(\d+)$/, async (ctx) => {
    const qIdx = Number(ctx.match[1]);
    const ansIdx = Number(ctx.match[2]);
    const userId = String(ctx.from?.id ?? ctx.chat?.id ?? '');
    await ctx.answerCallbackQuery();
    const quiz = getPersonaQuiz();
    const existingAnswers: number[] = ((await getUserPreference(userId, '_quiz_answers')) as number[]) ?? [];
    const answers = [...existingAnswers, ansIdx];
    await setUserPreference(userId, '_quiz_answers', answers);
    const nextQ = quiz[qIdx + 1];
    if (nextQ) {
      const kb = new InlineKeyboard();
      nextQ.options.forEach((opt, i) => kb.text(opt, `quiz_ans:${qIdx+1}:${i}`).row());
      await (ctx as any).editMessageText(
        `📝 <b>Q${qIdx+2}/${quiz.length}</b>\n\n${nextQ.question}`,
        { parse_mode: 'HTML', reply_markup: kb }
      );
    } else {
      const persona = inferPersonaFromQuiz(answers);
      await setUserPersona(userId, persona);
      const cfg = PERSONAS[persona];
      await (ctx as any).editMessageText(
        `🎯 <b>Your Persona: ${persona.toUpperCase()}</b>\n\n${cfg.tone}\n\n` +
        `Min Confidence: ${cfg.minConfidence}% | Max Risk: ${cfg.maxRiskPct}%\n` +
        `<i>Your AI filters are now calibrated!</i>`,
        { parse_mode: 'HTML', reply_markup: new InlineKeyboard().text('🏠 Menu', 'menu:main') }
      );
    }
  });

  // ── Tax Report (Part 12) ──────────────────────────────────────────────────
  bot.command('tax', async (ctx) => {
    const userId = String(ctx.from?.id ?? ctx.chat?.id ?? '');
    const year = Number((ctx.match || '').toString().trim()) || new Date().getFullYear() - 1;
    await ctx.reply(`📄 <b>Generating Tax Report ${year}…</b>`, { parse_mode: 'HTML' });
    try {
      const resp = await fetch(`http://localhost:${process.env.PORT || 10000}/api/tax/report?user_id=${userId}&year=${year}`);
      const json = await resp.json() as any;
      const r = json.data;
      const estTax = Math.max(0, Number(r.net_pnl_after_fees ?? r.total_realized_pnl ?? 0) * 0.30);
      const text = `📄 <b>Tax Report ${r.year}</b>\n\n` +
        `📊 Total Trades: ${r.total_trades} (✅ ${r.winning_trades} wins / ❌ ${r.losing_trades} losses)\n` +
        `💰 Total Realized P&L: $${Number(r.total_realized_pnl ?? 0).toFixed(2)}\n` +
        `💸 Est. Fees: $${Number(r.total_fees_est ?? 0).toFixed(2)}\n` +
        `✅ Net P&L After Fees: $${Number(r.net_pnl_after_fees ?? 0).toFixed(2)}\n` +
        `📈 Short-term Gains: $${Number(r.short_term_gains ?? 0).toFixed(2)}\n` +
        `📅 Long-term Gains: $${Number(r.long_term_gains ?? 0).toFixed(2)}\n` +
        `💵 Est. Tax (30%): $${estTax.toFixed(2)}\n` +
        `⏱ Avg Hold: ${Number(r.avg_holding_days ?? 0).toFixed(1)} days\n\n` +
        `<i>CSV export: /api/tax/report?user_id=${userId}&year=${year}&format=csv</i>`;
      await ctx.reply(text, { parse_mode: 'HTML', reply_markup: new InlineKeyboard().text('📥 CSV Export Info', 'tax:csv').text('🏠 Menu', 'menu:main') });
    } catch (e) {
      await ctx.reply(`❌ Tax Error: ${(e as Error).message}`);
    }
  });
  bot.hears('📄 Tax', async (ctx) => {
    await ctx.reply(`Use <code>/tax YEAR</code> — e.g. <code>/tax 2024</code>`, { parse_mode: 'HTML' });
  });

  // ── Rebalance (Part 6) ────────────────────────────────────────────────────
  bot.command('rebalance', async (ctx) => {
    const userId = String(ctx.from?.id ?? ctx.chat?.id ?? '');
    await ctx.reply(`🔄 <b>Generating Rebalance Plan…</b>`, { parse_mode: 'HTML' });
    try {
      const rec = await generateRebalanceRecommendation(userId);
      const lines = [
        `🔄 <b>Portfolio Rebalance</b>\n`,
        `📊 Persona: <b>${rec.persona.toUpperCase()}</b>`,
        `🌍 Macro: <b>${rec.macro_regime.replace('_', ' ').toUpperCase()}</b>`,
        `⚠️ Risk Score: ${rec.risk_score}/100\n`,
        `<b>Top Actions:</b>`,
        ...rec.rebalance_actions.slice(0, 5).map(a => `• ${a}`),
      ];
      if (!rec.rebalance_actions.length) lines.push('• Portfolio is already well-balanced ✅');
      await ctx.reply(lines.join('\n'), {
        parse_mode: 'HTML',
        reply_markup: new InlineKeyboard()
          .text('🎯 Change Persona', 'persona:view').text('🏠 Menu', 'menu:main'),
      });
    } catch (e) {
      await ctx.reply(`❌ Rebalance Error: ${(e as Error).message}`);
    }
  });

  
  // ── Playbook callback (Part 5) ─────────────────────────────────────────────
  bot.callbackQuery(/^playbook:/, async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.reply('📚 <b>Loading Playbook…</b>', { parse_mode: 'HTML' });
    try {
      const strategies = await getStrategies();
      const list = strategies.length ? strategies : PRESET_STRATEGIES;
      const lines = ['📚 <b>Macro Event Playbook</b>\n', '<i>Auto-execute strategies on macro events</i>\n'];
      list.slice(0, 6).forEach((s, i) => {
        lines.push(`${i + 1}. <b>${s.name}</b>\n   Trigger: ${s.trigger_event} | ${s.action_direction.toUpperCase()} ${s.action_asset}\n   Size: ${s.action_size_pct}% | SL: ${s.action_sl_pct}% | TP: ${s.action_tp_pct}%`);
      });
      lines.push('\n<i>Use /playbook to manage your strategies.</i>');
      await ctx.reply(lines.join('\n'), { parse_mode: 'HTML', reply_markup: new InlineKeyboard().text('🏠 Menu', 'menu:main') });
    } catch (e) {
      await ctx.reply(`❌ Playbook Error: ${(e as Error).message}`);
    }
  });

  // ── Rebalance callback (Part 6) ──────────────────────────────────────────
  bot.callbackQuery(/^rebalance:/, async (ctx) => {
    const userId = String(ctx.from?.id ?? ctx.chat?.id ?? '');
    await ctx.answerCallbackQuery({ text: 'Generating rebalance plan…' });
    try {
      const rec = await generateRebalanceRecommendation(userId);
      const lines = [
        `🔄 <b>Portfolio Rebalance</b>\n`,
        `📊 Persona: <b>${rec.persona.toUpperCase()}</b>`,
        `🌍 Macro: <b>${rec.macro_regime.replace('_', ' ').toUpperCase()}</b>`,
        `⚠️ Risk Score: ${rec.risk_score}/100\n`,
        `<b>Top Actions:</b>`,
        ...rec.rebalance_actions.slice(0, 5).map((a: string) => `• ${a}`),
      ];
      if (!rec.rebalance_actions.length) lines.push('• Portfolio is already well-balanced ✅');
      await ctx.editMessageText(lines.join('\n'), {
        parse_mode: 'HTML',
        reply_markup: new InlineKeyboard()
          .text('🎯 Change Persona', 'persona:view').text('🏠 Menu', 'menu:main'),
      });
    } catch (e) {
      await ctx.reply(`❌ Rebalance Error: ${(e as Error).message}`);
    }
  });

  // ── Tax callback (Part 12) ────────────────────────────────────────────────
  bot.callbackQuery(/^tax:/, async (ctx) => {
    const userId = String(ctx.from?.id ?? ctx.chat?.id ?? '');
    await ctx.answerCallbackQuery({ text: 'Generating tax report…' });
    const year = new Date().getFullYear() - 1;
    await ctx.reply(`📄 <b>Generating Tax Report ${year}…</b>\nUse <code>/tax ${year}</code> for detailed export.`, { parse_mode: 'HTML', reply_markup: new InlineKeyboard().text('🏠 Menu', 'menu:main') });
  });

  // ── Voice message handler (Part 9) ────────────────────────────────────────
  bot.on('message:voice', async (ctx) => {
    await ctx.reply('🎙️ <b>Voice received!</b> Transcribing…', { parse_mode: 'HTML' });
    try {
      const file = await ctx.getFile();
      const fileUrl = `https://api.telegram.org/file/bot${TOKEN}/${file.file_path}`;
      // Transcribe with Whisper — try Groq (free) first, then OpenAI
      const groqKey = process.env.GROQ_API_KEY;
      const openaiKey = process.env.OPENAI_API_KEY;
      if (groqKey || openaiKey) {
        const audioResp = await fetch(fileUrl);
        const audioBuffer = Buffer.from(await audioResp.arrayBuffer());
        const formData = new FormData();
        formData.append('file', new Blob([audioBuffer], { type: 'audio/ogg' }), 'voice.ogg');
        const useGroq = !!groqKey;
        formData.append('model', useGroq ? 'whisper-large-v3' : 'whisper-1');
        formData.append('language', 'en');
        const whisperUrl = useGroq
          ? 'https://api.groq.com/openai/v1/audio/transcriptions'
          : 'https://api.openai.com/v1/audio/transcriptions';
        const whisperResp = await fetch(whisperUrl, {
          method: 'POST',
          headers: { Authorization: `Bearer ${useGroq ? groqKey : openaiKey}` },
          body: formData,
        });
        const whisperJson = await whisperResp.json() as any;
        const transcript = (whisperJson?.text ?? '') as string;
        if (transcript) {
          await ctx.reply(`🗣️ <b>You said:</b> "${transcript}"\n\nProcessing…`, { parse_mode: 'HTML' });
          const intent = parseTradeIntent(transcript);
          const intentAny = intent as any;

          // ── Helper: execute a resolved voice intent ──────────────────────
          const execVoiceIntent = async (action: string, asset: string | null, amountUsd: number | null) => {
            if ((action === 'buy' || action === 'sell') && asset) {
              const side = action as 'buy' | 'sell';
              const usd = amountUsd ?? 100;
              // Convert USD → base asset quantity using current price
              let price = 0;
              try {
                const snap: any = await sosovalue.getMarketSnapshot(asset);
                price = Number(snap?.price ?? snap?.last_price ?? snap?.data?.price ?? 0);
              } catch { /* ignore */ }
              if (!price || price <= 0) {
                // Fallback: use SoDEX orderbook price via execution agent price resolution
                price = 1; // execution agent will resolve the real price internally
              }
              const qty = price > 1 ? usd / price : usd;
              const result = await runExecutionAgent({
                userId: String(ctx.from?.id ?? ''),
                market: `${asset}-USDC`,
                side,
                amount: qty,
                orderType: 'market',
              });
              const statusIcon = result.status === 'submitted' ? '✅' : result.status === 'rejected' ? '🚫' : '⚠️';
              const execPrice = (result as any).trade?.price ?? price;
              await ctx.reply(
                `${statusIcon} <b>Voice Trade Executed</b>\n\n` +
                `🎙️ "${transcript}"\n` +
                `${side === 'buy' ? '📈' : '📉'} ${side.toUpperCase()} $${usd} ${asset} @ $${Number(execPrice).toLocaleString()}\n` +
                `📊 Status: <b>${result.status}</b>\n` +
                `🛡️ Risk: <b>${result.risk?.verdict ?? 'n/a'}</b>\n` +
                (result.status === 'rejected' ? `\n⚠️ ${(result.risk?.reasons || []).join(', ')}\n` : '') +
                ((result as any).error ? `\n❌ <code>${String((result as any).error).slice(0, 200)}</code>\n` : '') +
                `\n<i>⛓️ Live order sent to SoDEX</i>`,
                { parse_mode: 'HTML' }
              );
              return true;
            } else if (action === 'research' && asset) {
              await runResearch(ctx, asset);
              return true;
            } else if (action === 'briefing') {
              await runBriefing(ctx);
              return true;
            }
            return false;
          };

          // ── Try regex NLP first ──────────────────────────────────────────
          if (intentAny.kind === 'trade' && intentAny.asset) {
            const side: 'buy' | 'sell' = intentAny.action === 'sell' ? 'sell' : 'buy';
            const usd = intentAny.usdAmount ?? (intentAny.amount && intentAny.amount > 0 ? intentAny.amount * (intentAny.price ?? 50000) : 100);
            await execVoiceIntent(side, intentAny.asset, usd);
          } else if (intentAny.kind === 'research' && intentAny.asset) {
            await runResearch(ctx, intentAny.asset);
          } else {
            // ── AI fallback: handles Arabic, multilingual, complex phrasing ──
            const { chatComplete } = await import('../clients/ai');
            const aiResp = await chatComplete([
              {
                role: 'system',
                content: 'You are a crypto trading assistant. Parse this voice command — it may be in any language (Arabic, Spanish, French, etc.). Return ONLY valid JSON (no markdown): {"action":"buy"|"sell"|"research"|"briefing"|"unknown","asset":"BTC"|"ETH"|"SOL"|"BNB"|"XRP"|"ADA"|"DOGE"|"AVAX"|"LINK"|"MATIC"|null,"amount_usd":number|null}. Common patterns: "buy X dollars ETH"=buy ETH X usd, "اشتر ETH بـ10 دولار"=buy ETH 10 usd.',
              },
              { role: 'user', content: transcript },
            ], 0.1);
            let handled = false;
            if (aiResp?.content) {
              try {
                const raw = aiResp.content.replace(/```json?|```/g, '').trim();
                const parsed = JSON.parse(raw) as { action: string; asset: string | null; amount_usd: number | null };
                handled = await execVoiceIntent(parsed.action, parsed.asset, parsed.amount_usd);
              } catch { /* ignore parse error */ }
            }
            if (!handled) {
              await ctx.reply(
                `🤖 <b>Voice Understood:</b> "${transcript}"\n\n<i>I couldn't match a specific action. Try: "buy $50 ETH", "research BTC", or "briefing".</i>`,
                { parse_mode: 'HTML' }
              );
            }
          }
          return;
        } // end if (transcript)
      } else {
        await ctx.reply(
          `🔇 <b>Transcription unavailable</b>\n\nSet <code>GROQ_API_KEY</code> (free) or <code>OPENAI_API_KEY</code> in .env to enable voice commands.\n\n` +
          `<i>For now, type your command or use buttons.</i>`,
          { parse_mode: 'HTML' }
        );
      }
    } catch (e) {
      await ctx.reply(`❌ Voice error: ${(e as Error).message}`);
    }
  });

  // ── Natural-language fallback (after all command/hears/callback handlers) ─
  const KEYBOARD_LABELS = new Set([
    '🔬 Research', '⚡ Signal', '💼 Portfolio', '📊 Briefing',
    '🔔 Alerts', '⚙️ Settings', '📓 Journal', '🤝 Subscribe', 'ℹ️ Help', '🎙️ Voice',
    '🐋 Whales', '🔄 Arb', '📡 Funding', '🏆 Leaderboard', '🎯 Persona', '📄 Tax',
  ]);
  bot.on('message:text', async (ctx) => {
    const text = ctx.message?.text ?? '';
    if (!text || text.startsWith('/') || KEYBOARD_LABELS.has(text)) return;

    const intent = parseTradeIntent(text);
    try {
      switch (intent.kind) {
        case 'research':
          return await runResearch(ctx, intent.asset);
        case 'voice_brief':
          return await sendVoiceBrief(ctx);
        case 'query':
          if (intent.topic === 'positions' || intent.topic === 'pnl') return await sendPortfolio(ctx);
          if (intent.topic === 'sectors' || intent.topic === 'macro') return await runBriefing(ctx);
          if (intent.topic === 'whale') return await sendWhaleAlerts(ctx);
          if (intent.topic === 'arb') return await sendArbitrage(ctx);
          if (intent.topic === 'funding') return await sendFundingSignals(ctx);
          if (intent.topic === 'leaderboard') return await sendLeaderboard(ctx);
          if (intent.topic === 'price' && intent.asset) {
            const s: any = await sosovalue.getMarketSnapshot(intent.asset).catch(() => null);
            const p = Number(s?.price ?? 0);
            return await ctx.reply(p > 0 ? `💱 <b>${intent.asset}</b>: $${p.toLocaleString()}` : `No price for ${intent.asset}`, { parse_mode: 'HTML' });
          }
          return await ctx.reply('🤖 Try: "show portfolio", "whale alerts", "arb scanner", "funding signals", "BTC price".');
        case 'trade': {
          const asset = intent.asset;
          const side = intent.action;
          if (intent.amount && intent.amount > 0) {
            return await showTradeConfirm(ctx, asset, side as 'buy' | 'sell', intent.amount);
          }
          // Fall through to USD picker
          const kb = new InlineKeyboard()
            .text('$10', `trade_usd:${asset}:${side}:10`).text('$25', `trade_usd:${asset}:${side}:25`).text('$50', `trade_usd:${asset}:${side}:50`).row()
            .text('$100', `trade_usd:${asset}:${side}:100`).text('$250', `trade_usd:${asset}:${side}:250`).text('$500', `trade_usd:${asset}:${side}:500`);
          await ctx.reply(`💸 Pick size for <b>${side.toUpperCase()} ${asset}</b>:`,
            { parse_mode: 'HTML', reply_markup: kb });
          return;
        }
        case 'paper_trade': {
          const asset = intent.asset || 'BTC';
          const side = intent.action === 'sell' ? 'sell' : 'buy';
          const userId = String(ctx.from?.id ?? ctx.chat?.id ?? '');
          const amountUsd = intent.amount && intent.amount > 0 ? intent.amount * ((intent as any).price ?? 50000) : 100;
          const trade = await createPaperTrade(userId, asset, side, amountUsd);
          await ctx.reply(
            `📄 <b>Paper Trade Created!</b>\n${side === 'buy' ? '📈' : '📉'} ${side.toUpperCase()} ${asset} @ $${Number(trade.entry_price).toLocaleString()}`,
            { parse_mode: 'HTML' }
          );
          return;
        }
        case 'rebalance': {
          const userId = String(ctx.from?.id ?? ctx.chat?.id ?? '');
          const rec = await generateRebalanceRecommendation(userId);
          const actions = rec.rebalance_actions.slice(0, 3);
          await ctx.reply(
            `🔄 <b>Rebalance</b> (${rec.persona})\n${actions.length ? actions.map(a => `• ${a}`).join('\n') : '• Portfolio balanced ✅'}`,
            { parse_mode: 'HTML' }
          );
          return;
        }
        case 'persona': {
          return await sendPersonaMenu(ctx);
        }
        case 'close':
          return await ctx.reply(`Use <code>/portfolio</code> to view and close <b>${intent.asset}</b> positions.`, { parse_mode: 'HTML' });
        case 'unknown':
        default:
          return await ctx.reply(
            '🤖 I didn\'t understand that.\n\n<b>Try natural commands like:</b>\n' +
            '• <code>research BTC</code>\n• <code>buy $100 BTC</code>\n• <code>show portfolio</code>\n' +
            '• <code>macro outlook</code>\n• <code>whale alerts</code>\n• <code>arb scanner</code>\n' +
            '• <code>funding rates</code>\n• <code>paper trade BTC</code>\n• <code>rebalance</code>\n' +
            '• <code>set persona aggressive</code>\n\nOr use the menu buttons / <code>/help</code>.',
            { parse_mode: 'HTML' },
          );
      }
    } catch (e) {
      await ctx.reply(`❌ Error: ${(e as Error).message}`);
    }
  });

  // ── Error handler ─────────────────────────────────────────────────────────────
  bot.catch((err) => {
    console.error('grammy error', err.error, err.ctx?.update);
  });

  return bot;
}
