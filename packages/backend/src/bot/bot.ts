import { Bot, InlineKeyboard, InputFile, Keyboard, Context } from 'grammy';
import { runResearchAgent } from '../agents/research';
import { sosovalue } from '../clients/sosovalue';
import { supabase } from '../db/supabase';
import { upsertSubscriber, getSignals, getUserPreference, setUserPreference, getOrCreateTelegramWallet, replaceTelegramWallet } from '../db/supabase';
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
import { getBinanceTicker } from '../clients/market';

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
  .text('🏆 Leaderboard').text('🎯 Persona').text('📄 Tax').row()
  .text('📈 SSI Indexes').text('📰 Newsletter').text('🧠 Intel').row()
  .text('✖ Hide Menu')
  .resized();

// ─── Inline asset picker ─────────────────────────────────────────────────────
function assetMenu(prefix: string) {
  return new InlineKeyboard()
    // ── Core Crypto ──
    .text('₿ BTC', `${prefix}:BTC`).text('Ξ ETH', `${prefix}:ETH`).text('◎ SOL', `${prefix}:SOL`).row()
    .text('⚡ XRP', `${prefix}:XRP`).text('🪙 ADA', `${prefix}:ADA`).text('🐶 DOGE', `${prefix}:DOGE`).row()
    .text('🔗 LINK', `${prefix}:LINK`).text('🔴 AVAX', `${prefix}:AVAX`).text('🟡 BNB', `${prefix}:BNB`).row()
    .text('🦄 UNI', `${prefix}:UNI`).text('🔵 LTC', `${prefix}:LTC`).text('🔒 ZEC', `${prefix}:ZEC`).row()
    .text('🔥 HYPE', `${prefix}:HYPE`).text('🐕 SHIB', `${prefix}:SHIB`).text('🏦 AAVE', `${prefix}:AAVE`).row()
    // ── Commodities & Tokens ──
    .text('🥇 XAUT', `${prefix}:XAUT`).text('💵 USDT', `${prefix}:USDT`).text('🌊 SOSO', `${prefix}:SOSO`).row()
    // ── Stocks ──
    .text('🚗 TSLA', `${prefix}:TSLA`).text('🟢 NVDA', `${prefix}:NVDA`).text('📘 META', `${prefix}:META`).row()
    .text('🍎 AAPL', `${prefix}:AAPL`).text('📦 AMZN', `${prefix}:AMZN`).text('🔍 GOOGL', `${prefix}:GOOGL`).row()
    .text('🪟 MSFT', `${prefix}:MSFT`).row()
    // ── SSI Indexes ──
    .text('📊 MAG7ssi', `${prefix}:MAG7SSI`).text('😂 MEMEssi', `${prefix}:MEMESSI`).row()
    .text('💎 DEFIssi', `${prefix}:DEFISSI`).text('🏛️ USSI', `${prefix}:USSI`).row()
    .text('⬅️ Back', 'menu:main');
}

function mainMenuMsg() {
  return (
    `<b>🧠 SosoMind</b> — AI Crypto Intelligence (17 Unique Features)\n` +
    `<i>⛓️ Powered by SoSoValue + SoDEX · DeFi-native · AI-driven</i>\n\n` +
    `<b>📊 Market Intelligence:</b>\n` +
    `🔬 <b>Research</b> — Deep AI analysis (13+ sources)\n` +
    `⚡ <b>Signal</b> — Live price + AI signal\n` +
    `📊 <b>Briefing</b> — ETF/Macro/Sectors daily brief\n` +
    `🐋 <b>Whales</b> — Smart money: ETF flows, treasuries, VC\n` +
    `🔄 <b>Arb</b> — Cross-exchange arbitrage scanner\n` +
    `📡 <b>Funding</b> — Perps funding rate contrarian signals\n` +
    `🧺 <b>Basket</b> — Top-3 assets for any SSI sector + execute\n` +
    `📐 <b>Methodology</b> — Signal scoring formula (S1·S2·S3)\n\n` +
    `<b>� SSI Indexes (SoSoValue Protocol):</b>\n` +
    `📈 <b>SSI Indexes</b> — Live baskets: MAG7.ssi, DEFI.ssi, MEME.ssi, USSI\n` +
    `📰 <b>Newsletter</b> — Smart-money daily brief with provenance\n\n` +
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
    `<b>💬 NLP:</b> Type naturally — <i>"buy $500 BTC"</i>, <i>"show MAG7.ssi"</i>, or <i>"show whale alerts"</i>\n` +
    `🎙️ <b>Voice:</b> Send a voice message to trade hands-free\n\n` +
    `💎 <i>Zero mocks · Real APIs · EIP-712 signed trades · SSI on-chain indexes</i>`
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
      .text('🤝 Subscribe', 'subscribe:btc,macro,etf').text('⚙️ Settings', 'settings:view').row()
      .text('📈 SSI Indexes', 'ssi:view').text('📰 Newsletter', 'newsletter:latest').row()
      .text('🧠 Intel', 'intel:view').text('📊 Track Record', 'track_record:view').row()
      .text('🧺 Basket', 'basket:menu').text('📐 Methodology', 'methodology:full').row()
      .text('💎👛 My Wallet', 'menu:wallet');

    const text = mainMenuMsg();
    if ((ctx as any).callbackQuery) {
      await (ctx as any).editMessageText(text, { parse_mode: 'HTML', reply_markup: kb });
      await (ctx as any).answerCallbackQuery();
    } else {
      // ── New user: show onboarding wizard (Step 1) immediately ──────────────
      const chatId = String(ctx.chat?.id ?? '');
      const embWallet = chatId
        ? await getOrCreateTelegramWallet(chatId, ctx.from?.username, ctx.from?.first_name).catch(() => null)
        : null;

      if (embWallet) {
        // Fire-and-forget SoDEX auto-register
        setImmediate(async () => {
          try {
            const { SoDEXClient } = await import('../clients/sodex');
            const { decryptPrivateKey } = await import('../utils/walletCrypto');
            const userClient = new SoDEXClient({
              chainId: parseInt(process.env.SODEX_CHAIN_ID || '138565', 10),
              privateKey: decryptPrivateKey(embWallet.encrypted_key),
              isTestnet: true,
            });
            const accID = await userClient.resolveAccountID().catch(() => 0);
            if (!accID) {
              await userClient.registerApiKey({ name: `tg-${chatId}` });
              console.log(`[Bot] Auto-registered SoDEX for chatId=${chatId} addr=${embWallet.wallet_address}`);
            }
          } catch (e) {
            console.warn(`[Bot] SoDEX auto-register skipped for chatId=${chatId}:`, (e as Error).message);
          }
        });

        // Send the beautiful onboarding wizard — Step 1
        await ctx.reply(
          `🚀 <b>Welcome to SosoMind!</b>\n\n` +
          `Your AI-powered crypto trading assistant on <b>SoDEX Testnet</b>.\n\n` +
          `A personal trading wallet has been created for you automatically.\n` +
          `Follow the 4-step guide below to activate trading in under 3 minutes.\n\n` +
          `━━━━━━━━━━━━━━━━━━━━━\n` +
          `<b>● ○ ○ ○  STEP 1 — Your Wallet Address</b>\n` +
          `━━━━━━━━━━━━━━━━━━━━━\n\n` +
          `📍 <b>Your wallet address:</b>\n` +
          `<code>${embWallet.wallet_address}</code>\n\n` +
          `This wallet is used to sign all your trades automatically — <i>no MetaMask popup needed during trading.</i>\n\n` +
          `<b>What to do now:</b>\n` +
          `① Tap <b>📤 Export Private Key</b> below\n` +
          `② Copy the key\n` +
          `③ Open <b>MetaMask</b> → tap your account icon → <b>Import Account</b>\n` +
          `④ Paste the key and import\n\n` +
          `⚠️ <i>Keep your key secret. Never share it with anyone.</i>\n\n` +
          `<i>When done, tap ➡️ Next Step to continue.</i>`,
          {
            parse_mode: 'HTML',
            reply_markup: new InlineKeyboard()
              .text('📤 Export Private Key', 'wallet:export').row()
              .text('➡️ Next Step: Add Network', 'setup:step2').row()
              .text('⏭ Skip — Go to Menu', 'menu:main'),
          }
        );
      } else {
        // Fallback: no wallet (very rare), show main menu
        await ctx.reply(text, { parse_mode: 'HTML', reply_markup: kb });
      }

      // Always send the persistent bottom keyboard
      await ctx.reply(
        `⌨️ <b>Keyboard ready</b> — use buttons below anytime, or type commands naturally.`,
        { parse_mode: 'HTML', reply_markup: MAIN_KB }
      );
    }
  };

  bot.command('start', sendMainMenu);
  bot.command('help', sendMainMenu);
  bot.command('menu', sendMainMenu);
  bot.hears('ℹ️ Help', sendMainMenu);
  bot.callbackQuery('menu:main', sendMainMenu);

  // ── Wallet Reset (when embedded wallet decryption fails) ─────────────────
  bot.callbackQuery('wallet:reset:confirm', async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.editMessageText(
      `⚠️ <b>Reset Embedded Wallet?</b>\n\n` +
      `This will generate a <b>new wallet address</b>.\n` +
      `Your old wallet address will be replaced.\n\n` +
      `<b>Make sure your old wallet holds no funds before continuing.</b>`,
      {
        parse_mode: 'HTML',
        reply_markup: new InlineKeyboard()
          .text('✅ Yes, Reset Now', 'wallet:reset:execute').row()
          .text('❌ Cancel', 'menu:main'),
      }
    );
  });

  bot.callbackQuery('wallet:reset:execute', async (ctx) => {
    await ctx.answerCallbackQuery({ text: '🔄 Resetting wallet…' });
    const chatId = String((ctx as any).chat?.id ?? '');
    try {
      const { ethers } = await import('ethers');
      const { encryptPrivateKey } = await import('../utils/walletCrypto');
      const { replaceTelegramWallet } = await import('../db/supabase');
      const newWallet = ethers.Wallet.createRandom();
      const newEncKey = encryptPrivateKey(newWallet.privateKey);
      const updated = await replaceTelegramWallet(chatId, newWallet.address, newEncKey);
      if (!updated) throw new Error('DB update failed');
      await ctx.editMessageText(
        `✅ <b>Wallet Reset Complete</b>\n\n` +
        `New wallet address:\n<code>${newWallet.address}</code>\n\n` +
        `Your new wallet is ready. Use it on SoDEX Testnet.\n` +
        `<i>Fund it with testnet tokens before trading.</i>`,
        {
          parse_mode: 'HTML',
          reply_markup: new InlineKeyboard()
            .text('💼 My Wallet', 'menu:wallet')
            .text('🏠 Main Menu', 'menu:main'),
        }
      );
    } catch (err) {
      await ctx.editMessageText(
        `❌ <b>Reset Failed</b>\n<code>${(err as Error).message}</code>`,
        { parse_mode: 'HTML', reply_markup: new InlineKeyboard().text('⬅️ Back', 'menu:main') }
      );
    }
  });

  // ── Hide / Show bottom keyboard ──────────────────────────────────────────
  bot.hears('✖ Hide Menu', async (ctx) => {
    await ctx.reply(
      '⌨️ Menu hidden. Tap <b>/menu</b> or <b>/start</b> to show it again.',
      { parse_mode: 'HTML', reply_markup: { remove_keyboard: true } }
    );
  });

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
      const signalId: string | undefined = (signal as any).id;
      const signalUrl = signalId ? `\n\n🔗 <a href="https://sosomind.vercel.app/signals/${signalId}">View Full Signal</a>` : '';
      const report = formatResearchReport(signal) + signalUrl;
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

    // Early tradeability check — read-only SoDEX client, no private key needed
    try {
      const { SoDEXClient } = await import('../clients/sodex');
      const pubClient = new SoDEXClient({ chainId: parseInt(process.env.SODEX_CHAIN_ID || '138565', 10), isTestnet: true });
      const symMeta: any = await pubClient.findMarketForAsset(asset).catch(() => null);
      if (symMeta) {
        const st = String(symMeta?.status ?? '').toUpperCase();
        const NON_TRADING = ['CANCEL_ONLY', 'HALT', 'SUSPENDED', 'BREAK', 'DISABLED', 'INACTIVE', 'CLOSED'];
        if (st && NON_TRADING.some(s => st.includes(s))) {
          const kb = new InlineKeyboard()
            .text('₿ BTC', 'trade_amount:BTC:buy').text('Ξ ETH', 'trade_amount:ETH:buy').text('◎ SOL', 'trade_amount:SOL:buy').row()
            .text('⬅️ Back', 'menu:signal');
          await (ctx as any).editMessageText(
            `⛔ <b>${asset} is in ${st} mode</b>\n\n` +
            `New orders for <b>${asset}</b> are blocked on SoDEX Testnet right now.\n\n` +
            `<b>Available to trade:</b>\n₿ BTC · Ξ ETH · ◎ SOL · ⚡ XRP · 🐕 DOGE · 🌊 SUI`,
            { parse_mode: 'HTML', reply_markup: kb }
          );
          return;
        }
      }
    } catch { /* non-fatal — proceed normally if check fails */ }

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
    // Compute base qty from USD amount; will be enforced against SoDEX minimums in tx: handler
    const rawQty = price > 0 ? usd / price : 0.001;
    const qty = Math.max(parseFloat(rawQty.toFixed(8)), 0.00000001);
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
    // Price fetch: 3-source fallback for display (est. price in confirmation)
    // 1. Binance (free, real-time, no key — most reliable for crypto)
    // 2. SoDEX ticker lastPx (covers stocks & niche tokens not on Binance)
    // 3. SosoValue market-snapshot (last resort)
    let price = 0;
    try {
      const binTicker = await getBinanceTicker(asset).catch(() => null);
      if (binTicker && binTicker.price > 0) {
        price = binTicker.price;
      } else {
        // SoDEX ticker fallback (stocks, indices, niche tokens)
        try {
          const { sodex: houseSodex2 } = await import('../clients/sodex');
          const tickers: any = await houseSodex2.getSpotTickers().catch(() => null);
          const tickerArr: any[] = Array.isArray(tickers) ? tickers : Array.isArray(tickers?.data) ? tickers.data : [];
          const cleanAsset = asset.toUpperCase().replace(/^V/, '');
          const t = tickerArr.find((x: any) =>
            x.symbol === `v${cleanAsset}_vUSDC` ||
            x.symbol === `${cleanAsset}_vUSDC` ||
            x.symbol?.startsWith(cleanAsset + '_')
          );
          const lastPx = parseFloat(t?.lastPx ?? '0');
          if (lastPx > 0) price = lastPx;
        } catch {}
        // SosoValue last resort
        if (!price) {
          const s: any = await sosovalue.getMarketSnapshot(asset).catch(() => null);
          price = Number(s?.price ?? s?.last_price ?? s?.current_price ?? 0);
        }
      }
    } catch {}
    const estValue = (price * qty).toFixed(2);
    const chatId = String((ctx as any).chat?.id ?? '');

    // Resolve the real SoDEX market for this asset (testnet uses TESTBTC_vUSDC, etc.)
    let market: string;
    let resolvedAssetLabel = asset;
    try {
      const { sodex: houseSodex } = await import('../clients/sodex');
      const symMeta = await houseSodex.findMarketForAsset(asset);
      market = symMeta.name;  // e.g. "TESTBTC_vUSDC"
      resolvedAssetLabel = symMeta.displayName ?? symMeta.name;
    } catch {
      // Asset not listed on SoDEX Testnet — inform user and abort
      const notFoundText =
        `⚠️ <b>${asset} not found on SoDEX Testnet</b>\n\n` +
        `Available spot assets:\n` +
        `<b>BTC · ETH · SOL · XRP · ADA · DOGE · LINK · AVAX · BNB</b>\n` +
        `<b>UNI · LTC · ZEC · HYPE · SHIB · AAVE · XAUT · USDT · SOSO</b>\n` +
        `<b>TSLA · NVDA · META · AAPL · AMZN · GOOGL · MSFT</b>\n` +
        `<b>MAG7ssi · MEMEssi · DEFIssi · USSI</b>\n\n` +
        `<i>Use /trade ASSET or tap below to pick another asset.</i>`;
      const kb = new InlineKeyboard()
        .text('₿ BTC', 'trade_amount:BTC:buy').text('Ξ ETH', 'trade_amount:ETH:buy').text('◎ SOL', 'trade_amount:SOL:buy').row()
        .text('⚡ XRP', 'trade_amount:XRP:buy').text('🪙 ADA', 'trade_amount:ADA:buy').text('🐶 DOGE', 'trade_amount:DOGE:buy').row()
        .text('⬅️ Back', 'menu:main');
      if ((ctx as any).callbackQuery) {
        await (ctx as any).editMessageText(notFoundText, { parse_mode: 'HTML', reply_markup: kb });
      } else {
        await ctx.reply(notFoundText, { parse_mode: 'HTML', reply_markup: kb });
      }
      return;
    }

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

    // tx: handler always executes with the embedded wallet — show it as the signing wallet.
    // MetaMask-linked wallet is shown separately (used only for browser sign button).
    const signingWallet = embeddedWallet?.wallet_address ?? null;

    const text =
      `🔐 <b>Trade Confirmation</b>\n\n` +
      `⛓️ Network: SoDEX ${process.env.SODEX_CHAIN_ID === '286623' ? 'Mainnet' : 'Testnet'} (chainId ${process.env.SODEX_CHAIN_ID || '138565'})\n` +
      `🪙 Asset: <b>${resolvedAssetLabel}</b>${resolvedAssetLabel !== asset ? ` <i>(${asset})</i>` : ''}\n` +
      `${side === 'buy' ? '📈' : '📉'} Direction: <b>${side === 'buy' ? 'LONG (Buy)' : 'SHORT (Sell)'}</b>\n` +
      `📦 Quantity: <b>${qty}</b>\n` +
      `💰 Est. Price: $${price.toLocaleString()}\n` +
      `💵 Est. Value: $${estValue}\n` +
      (signingWallet
        ? `👛 Wallet: <code>${signingWallet.slice(0, 6)}…${signingWallet.slice(-4)}</code> <i>(auto-sign)</i>\n`
        : '') +
      (linkedWallet ? `🦊 MetaMask: <code>${linkedWallet.slice(0, 6)}…${linkedWallet.slice(-4)}</code> also linked\n` : '') +
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
          let privKey: string;
          try {
            const { decryptPrivateKey } = await import('../utils/walletCrypto');
            privKey = decryptPrivateKey(embWallet.encrypted_key);
          } catch (decryptErr: any) {
            // AES-256-GCM auth-tag mismatch — encryption key changed in environment.
            // Redirect to browser signing and offer a wallet reset.
            const dashboardUrl = (process.env.DASHBOARD_URL || '').replace(/\/$/, '');
            const isPublic = dashboardUrl.startsWith('https://');
            const kb = new InlineKeyboard();
            if (isPublic) {
              kb.url('🦊 Sign in Browser', `${dashboardUrl}/trade?m=${market}&s=${side}&q=${qtyStr}`).row();
            }
            kb.text('🔑 Reset Wallet', `wallet:reset:confirm`).row()
              .text('⬅️ Back', 'menu:main');
            await ctx.editMessageText(
              `🔑 <b>Wallet Key Error</b>\n\n` +
              `Your embedded wallet could not be unlocked.\n` +
              `This usually happens after a server update.\n\n` +
              (isPublic ? `• Tap <b>Sign in Browser</b> to trade via MetaMask\n` : '') +
              `• Tap <b>Reset Wallet</b> to generate a fresh wallet\n` +
              `  ⚠️ <i>Only reset if your current wallet holds no funds</i>`,
              { parse_mode: 'HTML', reply_markup: kb }
            );
            return;
          }
          const { SoDEXClient } = await import('../clients/sodex');
          const userClient = new SoDEXClient({
            chainId: parseInt(process.env.SODEX_CHAIN_ID || '138565', 10),
            privateKey: privKey!,
            isTestnet: true,
          });
          // Resolve symbolID from SoDEX market list
          const symbolID = await userClient.resolveSymbolID(market, 'spot').catch(() => 0);
          if (symbolID <= 0) {
            throw new Error(`Market ${market} not found on SoDEX Testnet. Try BTC or ETH.`);
          }

          // Resolve accountID — auto-register wallet on SoDEX if this is first-time use
          let accountID = await userClient.resolveAccountID().catch(() => 0);
          if (accountID === 0) {
            await ctx.editMessageText(
              `⏳ <b>First-time Setup…</b>\n\n🔗 Registering your wallet on SoDEX…\n<i>This only happens once.</i>`,
              { parse_mode: 'HTML' }
            );
            try {
              const reg = await userClient.registerApiKey({
                name: `sosomind-${chatId.slice(-6)}`,
                expiresInDays: 365,
              });
              accountID = reg.accountID;
              console.log(`[Bot] Auto-registered SoDEX account for ${chatId}: accountID=${accountID}`);
            } catch (regErr: any) {
              console.warn(`[Bot] SoDEX registerApiKey failed:`, (regErr as Error).message);
              // Inform user they need to set up manually
              await ctx.editMessageText(
                `⚙️ <b>SoDEX Account Not Activated</b>\n\n` +
                `Your wallet (<code>${embWallet.wallet_address.slice(0, 6)}…${embWallet.wallet_address.slice(-4)}</code>) ` +
                `isn't registered on SoDEX yet.\n\n` +
                `<b>One-time setup required:</b>\n` +
                `1. Export your key → <code>/wallet</code> → Export Key\n` +
                `2. Import into MetaMask\n` +
                `3. Go to <a href="https://testnet.sodex.com">testnet.sodex.com</a>\n` +
                `4. Connect wallet → click <b>Enable Trading</b>\n` +
                `5. Come back and trade!\n\n` +
                `<i>Or tap Setup Guide below.</i>`,
                {
                  parse_mode: 'HTML',
                  reply_markup: new InlineKeyboard()
                    .url('🌐 SoDEX Testnet', 'https://testnet.sodex.com').row()
                    .text('📋 Setup Guide', 'setup:start').row()
                    .text('⬅️ Back', 'menu:main'),
                  link_preview_options: { is_disabled: true },
                }
              );
              return;
            }
            await ctx.editMessageText(
              `⏳ <b>Executing Trade…</b>\n\n✅ Wallet registered!\n🔐 Signing EIP-712…\n📡 Sending to SoDEX…`,
              { parse_mode: 'HTML' }
            );
          }

          // Sanitize quantity — ensure it's a valid positive decimal string
          const qtyNum = parseFloat(qtyStr);
          if (!isFinite(qtyNum) || qtyNum <= 0) {
            throw new Error(`Invalid quantity "${qtyStr}". Please select an amount from the menu.`);
          }
          // Fetch symbol meta with multiple field-name fallbacks
          // (SoDEX API field names may differ from the TypeScript interface — store raw item)
          const symMeta: any = await userClient.getSymbolMeta(market, 'spot').catch(() => null);
          console.log(`[Bot] symMeta for ${market}:`, JSON.stringify(symMeta));

          // Pre-flight: reject if market is in cancel-only / halt / suspended mode
          // SoDEX returns status: "TRADING" for active markets; other values block new orders.
          const rawStatus = String(symMeta?.status ?? '').toUpperCase();
          const NON_TRADING = ['CANCEL_ONLY', 'HALT', 'SUSPENDED', 'BREAK', 'DISABLED', 'INACTIVE', 'CLOSED'];
          if (rawStatus && NON_TRADING.some(s => rawStatus.includes(s))) {
            const assetName = market.split('_')[0].replace(/^v/i, '').replace(/^TEST/i, '');
            throw new Error(
              `${assetName} is in <b>${rawStatus}</b> mode on SoDEX Testnet — new orders are not accepted.\n\n` +
              `Try an active asset: BTC · ETH · SOL · XRP · DOGE · SUI`
            );
          }

          // Precision: try all known SoDEX field names, default to 4
          const precision = Number(
            symMeta?.quantityPrecision ?? symMeta?.qty_precision ?? symMeta?.qtyPrecision ??
            symMeta?.quantity_precision ?? symMeta?.baseAssetPrecision ?? 4
          );

          // Min market qty: try all known field names
          const minMarketQtyRaw =
            symMeta?.marketMinQuantity ?? symMeta?.market_min_quantity ?? symMeta?.marketMinQty ??
            symMeta?.market_min_qty ?? symMeta?.minQty ?? symMeta?.minQuantity ??
            symMeta?.min_quantity ?? symMeta?.min_qty ?? '0';
          const minMarketQty = parseFloat(String(minMarketQtyRaw)) || 0;

          // Min notional: try all known field names
          const minNotionalRaw =
            symMeta?.minNotional ?? symMeta?.min_notional ?? symMeta?.minNotionalFilter ??
            symMeta?.minOrderValue ?? '0';
          const minNotional = parseFloat(String(minNotionalRaw)) || 0;

          let finalQty = qtyNum;

          // Bump up to market-order minimum quantity (e.g. 0.001 TESTBTC, 0.1 AAVE)
          if (minMarketQty > 0 && finalQty < minMarketQty) {
            console.log(`[Bot] qty bumped ${finalQty} → ${minMarketQty} (marketMinQty for ${market})`);
            finalQty = minMarketQty;
          }

          // Bump up to meet minNotional (e.g. $5 USDC minimum order value)
          if (minNotional > 0) {
            try {
              const ob: any = await userClient.getSpotOrderbook(market, 1);
              const bestAsk = parseFloat(
                ob?.asks?.[0]?.[0] ?? ob?.asks?.[0]?.price ?? ob?.data?.asks?.[0]?.[0] ?? '0'
              ) || 0;
              if (bestAsk > 0 && finalQty * bestAsk < minNotional) {
                const bumpedQty = minNotional / bestAsk;
                console.log(`[Bot] qty bumped ${finalQty} → ${bumpedQty} (minNotional=${minNotional} for ${market})`);
                finalQty = bumpedQty;
              }
            } catch { /* non-fatal */ }
          }

          // Apply precision — use at least 1 decimal place to keep valid format
          const safePrecision = (isFinite(precision) && precision >= 0) ? precision : 4;
          // SoDEX REJECTS trailing zeros (e.g. "0.0110" → must be "0.011") — strip them
          const qtyFormatted = finalQty.toFixed(safePrecision).replace(/\.?0+$/, '');
          if (parseFloat(qtyFormatted) <= 0) {
            throw new Error(`Order size rounds to zero for ${market} (precision=${safePrecision}). Please choose a larger USD amount.`);
          }

          // Fetch live best price for limit-IOC order.
          // Market orders (type:2) fail on SoDEX testnet with "MissingOraclePrice".
          // Limit-IOC (type:1, timeInForce:3) with a 0.5% buffer fills like a market order.
          // Fallback chain: orderbook best ask/bid → ticker lastPx → throw.
          // Some pairs have empty asks (no sellers) or empty bids (no buyers) on testnet —
          // in that case we use lastPx from the ticker as the reference price.
          const pricePrecision = Number(symMeta?.pricePrecision ?? 0);
          const priceMultiplier = Math.pow(10, pricePrecision);
          let limitPriceStr: string | undefined;
          try {
            const ob2: any = await userClient.getSpotOrderbook(market, 1);
            const bestRaw = side === 'buy'
              ? parseFloat(ob2?.asks?.[0]?.[0] ?? ob2?.asks?.[0]?.price ?? '0')
              : parseFloat(ob2?.bids?.[0]?.[0] ?? ob2?.bids?.[0]?.price ?? '0');
            if (bestRaw > 0) {
              const bestWithBuffer = side === 'buy' ? bestRaw * 1.005 : bestRaw * 0.995;
              limitPriceStr = (Math.round(bestWithBuffer * priceMultiplier) / priceMultiplier)
                .toFixed(pricePrecision).replace(/\.?0+$/, '');
            }
          } catch { /* non-fatal — fall through to ticker */ }
          // Ticker fallback: use lastPx when orderbook side is empty (e.g. no asks on testnet)
          if (!limitPriceStr) {
            try {
              const tickers: any = await userClient.getSpotTickers();
              const tickerArr: any[] = Array.isArray(tickers) ? tickers
                : Array.isArray(tickers?.data) ? tickers.data : [];
              const t = tickerArr.find((x: any) => x.symbol === market);
              const lastPx = parseFloat(t?.lastPx ?? t?.askPx ?? t?.bidPx ?? '0');
              if (lastPx > 0) {
                const withBuffer = side === 'buy' ? lastPx * 1.01 : lastPx * 0.99; // wider buffer for stale price
                limitPriceStr = (Math.round(withBuffer * priceMultiplier) / priceMultiplier)
                  .toFixed(pricePrecision).replace(/\.?0+$/, '');
                console.log(`[Bot] orderbook empty for ${market} ${side} — using ticker lastPx=${lastPx} limitPrice=${limitPriceStr}`);
              }
            } catch { /* non-fatal */ }
          }
          // Binance real-market price as final fallback
          if (!limitPriceStr) {
            try {
              const cleanAsset2 = market.split('_')[0].replace(/^v/i, '');
              const binT = await getBinanceTicker(cleanAsset2).catch(() => null);
              const binPrice = binT?.price ?? 0;
              if (binPrice > 0) {
                const withBuffer = side === 'buy' ? binPrice * 1.01 : binPrice * 0.99;
                limitPriceStr = (Math.round(withBuffer * priceMultiplier) / priceMultiplier)
                  .toFixed(pricePrecision).replace(/\.?0+$/, '');
                console.log(`[Bot] using Binance fallback price for ${market}: ${binPrice} → limit=${limitPriceStr}`);
              }
            } catch { /* non-fatal */ }
          }
          if (!limitPriceStr) throw new Error(`Cannot fetch price for ${market} — orderbook, ticker, and Binance all unavailable. Try again shortly.`);

          console.log(`[Bot] Placing order: market=${market} symbolID=${symbolID} accountID=${accountID} side=${side} qty=${qtyFormatted} price=${limitPriceStr}`);

          sodexResult = await userClient.placeSpotOrder({
            accountID,
            symbolID,
            clOrdID: `bot${Date.now()}`,
            side: (side === 'buy' ? 1 : 2) as 1 | 2,
            type: 1 as 1 | 2,        // 1=limit (market type:2 fails with MissingOraclePrice on testnet)
            timeInForce: 3 as 1 | 2 | 3, // 3=IOC: fill immediately or cancel (market-like)
            price: limitPriceStr,
            quantity: qtyFormatted,
          });
          if (!sodexResult) throw new Error('No response from SoDEX — order may not have been placed.');
          walletUsed = `${embWallet.wallet_address.slice(0, 6)}…${embWallet.wallet_address.slice(-4)}`;
        }
      }

      // No embedded wallet available — surface a clear error instead of using house account
      if (!sodexResult) {
        const kb = new InlineKeyboard()
          .text('🔄 Retry', `trade_quick:${market.split('_')[0]}:${side}:${qtyStr}`).row()
          .text('📋 Setup Guide', 'setup:start').row()
          .text('🏠 Main Menu', 'menu:main');
        return await ctx.editMessageText(
          `❌ <b>Wallet Not Available</b>\n\n` +
          `Could not load your embedded wallet (database error).\n\n` +
          `<b>To fix:</b>\n` +
          `• Tap <b>Retry</b> to try again\n` +
          `• If the issue persists, run /start to re-initialise your wallet\n\n` +
          `<i>Your funds are safe — no order was sent.</i>`,
          { parse_mode: 'HTML', reply_markup: kb }
        );
      }

      // Embedded wallet execution result
      // placeSpotOrder → placeSpotOrderBatch → unwrap() → batch response
      // Batch response shape: { orders: [{ orderID, clOrdID, status, ... }] }
      // or direct array of order objects
      let orderId = 'pending';
      try {
        const orders = sodexResult?.orders ?? (Array.isArray(sodexResult) ? sodexResult : []);
        const first = orders[0] ?? sodexResult ?? {};
        orderId = String(first.orderID ?? first.clOrdID ?? first.id ?? 'pending');
      } catch { /* keep 'pending' */ }
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
      const errMsg = (e as Error).message ?? '';
      const isCancelOnly = /cancel.?only/i.test(errMsg) || /not.?trading/i.test(errMsg) || /halt/i.test(errMsg);
      const assetHint = market ? market.split('_')[0].replace(/^v/i, '').replace(/^TEST/i, '') : '';
      const userMsg = isCancelOnly
        ? `⛔ <b>${assetHint || 'Asset'} Not Tradeable</b>\n\n` +
          `This asset is in <b>cancel-only mode</b> on SoDEX Testnet — new orders are blocked by the exchange.\n\n` +
          `<b>Active assets to try:</b>\n` +
          `₿ BTC · Ξ ETH · ◎ SOL · ⚡ XRP · 🐕 DOGE · 🌊 SUI\n\n` +
          `<i>Use /trade LONG BTC 0.001 to trade BTC directly</i>`
        : `❌ <b>Execution Error</b>\n<code>${errMsg}</code>`;
      const kb = isCancelOnly
        ? new InlineKeyboard()
            .text('₿ BTC', 'trade_amount:BTC:buy').text('Ξ ETH', 'trade_amount:ETH:buy').text('◎ SOL', 'trade_amount:SOL:buy').row()
            .text('⬅️ Back', 'menu:main')
        : new InlineKeyboard().text('⬅️ Back', 'menu:main');
      await ctx.editMessageText(userMsg, { parse_mode: 'HTML', reply_markup: kb });
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

  // ── SSI Indexes (SoSoValue Protocol) ────────────────────────────────────────
  async function sendSSIIndex(ctx: Context) {
    const loadMsg = `📈 <b>SSI Indexes</b> — Loading live baskets…`;
    let sent: any;
    if ((ctx as any).callbackQuery) {
      sent = await (ctx as any).editMessageText(loadMsg, { parse_mode: 'HTML' }).catch(() => null);
      await (ctx as any).answerCallbackQuery().catch(() => {});
    } else {
      sent = await ctx.reply(loadMsg, { parse_mode: 'HTML' });
    }

    let products: any[] = [];
    try {
      const indices = await sosovalue.getIndices();
      const tickers: string[] = Array.isArray(indices) && indices.length > 0
        ? indices.map((idx: any) => String(idx.ticker ?? idx.symbol ?? idx.index_ticker ?? '')).filter(Boolean)
        : ['MAG7.ssi', 'DEFI.ssi', 'MEME.ssi', 'USSI'];

      const settled = await Promise.allSettled(tickers.map((t) => sosovalue.getIndexMarketSnapshot(t)));
      products = tickers.map((t, i) => {
        const r = settled[i];
        const snap = r.status === 'fulfilled' && r.value ? r.value as any : {};
        const price = Number(snap.price ?? snap.last_price ?? snap.nav ?? snap.current_price ?? 0);
        const change = Number(snap.price_change_percent_24h ?? snap.change_24h ?? 0);
        const tvl = Number(snap.tvl ?? snap.total_value_locked ?? snap.aum ?? 0);
        const apy = Number(snap.apy ?? snap.staking_apy ?? 0);
        const holders = Number(snap.holders ?? snap.holder_count ?? 0);
        return { ticker: t, price, change, tvl, apy, holders };
      });
    } catch {
      products = [
        { ticker: 'MAG7.ssi', price: 0, change: 0, tvl: 0, apy: 0, holders: 0 },
        { ticker: 'DEFI.ssi', price: 0, change: 0, tvl: 0, apy: 0, holders: 0 },
        { ticker: 'MEME.ssi', price: 0, change: 0, tvl: 0, apy: 0, holders: 0 },
        { ticker: 'USSI',     price: 0, change: 0, tvl: 0, apy: 0, holders: 0 },
      ];
    }

    const lines = [
      `📈 <b>SoSoValue Indexes (SSI Protocol)</b>`,
      `<i>On-chain spot-index baskets · Institutional custody (Cobo/Ceffu) · Monthly rebalance</i>`,
      ``,
    ];
    for (const p of products) {
      const dir = p.change >= 0 ? '▲' : '▼';
      const changeStr = p.price > 0 ? `${dir}${Math.abs(p.change).toFixed(2)}%` : 'N/A';
      const priceStr  = p.price > 0 ? `$${p.price.toFixed(4)}` : 'N/A';
      const tvlStr    = p.tvl > 0 ? `$${(p.tvl / 1e6).toFixed(1)}M TVL` : '';
      const apyStr    = p.apy > 0 ? ` · ${p.apy.toFixed(1)}% APY` : '';
      lines.push(`<b>${p.ticker}</b>  ${priceStr}  <code>${changeStr}</code>  ${tvlStr}${apyStr}`);
    }
    lines.push(``);
    lines.push(`<b>Protocol TVL:</b> $108M+ · <b>Holders:</b> 491K+ · <b>Audited by:</b> BlockSec, SlowMist, Zenith`);
    lines.push(`<b>Bridge:</b> Mirror Protocol (MPC+TEE) — deposit USDC on Base Chain`);
    lines.push(`\n🔗 <a href="https://ssi.sosovalue.com">ssi.sosovalue.com</a>`);

    const kb = new InlineKeyboard();
    for (const p of products.slice(0, 4)) {
      kb.text(`📊 ${p.ticker}`, `ssi:product:${p.ticker}`);
    }
    kb.row().text('📈 Recommend for Me', 'ssi:recommend').text('🏠 Menu', 'menu:main');

    const text = lines.join('\n');
    if (sent && (ctx as any).callbackQuery) {
      await (ctx as any).editMessageText(text, { parse_mode: 'HTML', reply_markup: kb, link_preview_options: { is_disabled: true } });
    } else {
      await ctx.reply(text, { parse_mode: 'HTML', reply_markup: kb, link_preview_options: { is_disabled: true } });
    }
  }

  bot.command('ssi', sendSSIIndex);
  bot.hears('📈 SSI Indexes', sendSSIIndex);
  bot.callbackQuery('ssi:view', sendSSIIndex);

  // SSI product detail — composition + klines summary
  bot.callbackQuery(/^ssi:product:(.+)$/, async (ctx) => {
    const ticker = ctx.match[1];
    await ctx.answerCallbackQuery({ text: `Loading ${ticker}…` });

    let text = `📊 <b>${ticker}</b> — Composition\n\n`;
    try {
      const [cons, snap] = await Promise.all([
        sosovalue.getIndexConstituents(ticker).catch(() => []),
        sosovalue.getIndexMarketSnapshot(ticker).catch(() => null),
      ]);
      const price = (snap as any)?.price ?? (snap as any)?.nav ?? 0;
      if (price > 0) text += `<b>Price:</b> $${Number(price).toFixed(4)}\n`;

      if (Array.isArray(cons) && cons.length > 0) {
        text += `\n<b>Constituents (${cons.length}):</b>\n`;
        const total = cons.reduce((s: number, c: any) => s + Number(c.weight ?? c.weight_pct ?? c.allocation ?? 0), 0) || 1;
        for (const c of cons.slice(0, 10)) {
          const w = Number(c.weight ?? c.weight_pct ?? c.allocation ?? 0);
          const pct = (w / total * 100).toFixed(1);
          const sym = c.symbol ?? c.token ?? c.name ?? '?';
          const ch = Number(c.price_change_percent_24h ?? c.change_24h ?? 0);
          const chStr = ch !== 0 ? ` (${ch > 0 ? '+' : ''}${ch.toFixed(2)}%)` : '';
          text += `  • <b>${sym}</b> ${pct}%${chStr}\n`;
        }
      } else {
        text += `\n<i>Constituents loading from SoSoValue API…</i>\n`;
      }
    } catch {
      text += `<i>Data unavailable — API may be rate-limited.</i>`;
    }

    const kb = new InlineKeyboard()
      .text('⬅️ All Indexes', 'ssi:view')
      .text('🏠 Menu', 'menu:main');
    await (ctx as any).editMessageText(text, { parse_mode: 'HTML', reply_markup: kb });
  });

  // SSI persona recommendation via bot
  bot.callbackQuery('ssi:recommend', async (ctx) => {
    await ctx.answerCallbackQuery({ text: 'Getting recommendation…' });
    const chatId = String(ctx.chat?.id ?? '');
    const persona = await getUserPersona(chatId).catch(() => 'balanced' as const);
    let text = `🎯 <b>SSI Recommendation</b> — persona: <code>${persona}</code>\n\n`;
    try {
      const tickers = ['MAG7.ssi', 'DEFI.ssi', 'MEME.ssi', 'USSI'];
      const settled = await Promise.allSettled(tickers.map((t) => sosovalue.getIndexMarketSnapshot(t)));
      const products = tickers.map((t, i) => {
        const r = settled[i];
        const snap = r.status === 'fulfilled' && r.value ? r.value as any : {};
        return {
          ticker: t,
          change: Number(snap.price_change_percent_24h ?? snap.change_24h ?? 0),
          tvl: Number(snap.tvl ?? snap.aum ?? 0),
          apy: Number(snap.apy ?? snap.staking_apy ?? 0),
          price: Number(snap.price ?? snap.nav ?? 0),
        };
      });
      const scored = products.map((p) => {
        let score = 50 + p.change * 1.5;
        if (persona === 'aggressive') score += p.change * 2 + (p.ticker === 'MEME.ssi' ? 8 : 0);
        if (persona === 'conservative') score += (p.ticker === 'MAG7.ssi' ? 12 : 0) + (p.ticker === 'USSI' ? 15 : 0) - Math.abs(p.change);
        if (persona === 'balanced') score += (p.ticker === 'DEFI.ssi' ? 6 : 0) + (p.ticker === 'MAG7.ssi' ? 4 : 0);
        if (persona === 'quant') score += p.tvl > 0 ? Math.log10(p.tvl + 1) * 2 : 0;
        return { ...p, score };
      }).sort((a, b) => b.score - a.score);
      const top = scored[0];
      const second = scored[1];
      text += `🏆 <b>Top Pick:</b> <b>${top.ticker}</b>`;
      if (top.price > 0) text += ` @ $${top.price.toFixed(4)}`;
      if (top.apy > 0) text += ` · ${top.apy.toFixed(1)}% APY`;
      text += `\n\n`;
      text += `🥈 <b>Runner-up:</b> ${second.ticker}`;
      text += `\n\n<i>Ranking by: 24h momentum, TVL depth, persona profile (${persona}).</i>`;
      text += `\n🔗 <a href="https://ssi.sosovalue.com">Buy on ssi.sosovalue.com</a>`;
    } catch {
      text += `<i>Unable to fetch live data. Try again shortly.</i>`;
    }
    const kb = new InlineKeyboard().text('⬅️ All Indexes', 'ssi:view').text('🏠 Menu', 'menu:main');
    await (ctx as any).editMessageText(text, { parse_mode: 'HTML', reply_markup: kb, link_preview_options: { is_disabled: true } });
  });

  // SSI NLP: "show ssi", "ssi indexes", "buy MAG7.ssi", "what is defi.ssi"
  bot.hears(/\b(ssi|mag7\.ssi|defi\.ssi|meme\.ssi|ussi)\b/i, async (ctx) => {
    const text = (ctx.message?.text ?? '').toLowerCase();
    const tickerMatch = text.match(/\b(mag7\.ssi|defi\.ssi|meme\.ssi|ussi)\b/i);
    if (tickerMatch) {
      // Route to product detail
      const ticker = tickerMatch[1].toUpperCase().replace('SSI', '.ssi').replace('USSI', 'USSI');
      const realTicker = text.includes('mag7') ? 'MAG7.ssi' : text.includes('defi') ? 'DEFI.ssi' : text.includes('meme') ? 'MEME.ssi' : 'USSI';
      await ctx.reply(`📊 Loading <b>${realTicker}</b>…`, { parse_mode: 'HTML' });
      let detail = `📊 <b>${realTicker}</b>\n\n`;
      try {
        const snap = await sosovalue.getIndexMarketSnapshot(realTicker).catch(() => null);
        const cons = await sosovalue.getIndexConstituents(realTicker).catch(() => []);
        const price = (snap as any)?.price ?? (snap as any)?.nav ?? 0;
        if (price > 0) detail += `<b>Price:</b> $${Number(price).toFixed(4)}\n`;
        if (Array.isArray(cons) && cons.length > 0) {
          detail += `\n<b>Constituents:</b> ${cons.slice(0, 7).map((c: any) => c.symbol ?? c.token ?? '?').join(', ')}...\n`;
        }
        detail += `\n🔗 <a href="https://ssi.sosovalue.com/buy/${realTicker}">Buy ${realTicker}</a>`;
      } catch {
        detail += `<i>Data loading…</i>`;
      }
      await ctx.reply(detail, { parse_mode: 'HTML', link_preview_options: { is_disabled: true } });
    } else {
      await sendSSIIndex(ctx);
    }
  });

  // ── Newsletter latest ────────────────────────────────────────────────────────
  bot.callbackQuery('newsletter:latest', async (ctx) => {
    await ctx.answerCallbackQuery({ text: 'Loading latest brief…' });
    try {
      const { data: posts } = await supabase
        .from('content_posts')
        .select('id, title, summary, created_at, symbols, citations')
        .eq('published', true)
        .order('created_at', { ascending: false })
        .limit(1);
      const post = posts?.[0];
      if (!post) {
        await (ctx as any).editMessageText(
          `📰 <b>No newsletters yet</b>\n\nGenerate the first one at <b>/dashboard → Newsletter</b> or use <b>/briefing</b> to create a market brief.`,
          { parse_mode: 'HTML', reply_markup: new InlineKeyboard().text('📊 Briefing', 'briefing:now').text('🏠 Menu', 'menu:main') },
        );
        return;
      }
      const citeCount = Array.isArray(post.citations) ? post.citations.length : 0;
      const timeStr = new Date(post.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'UTC' });
      const syms = Array.isArray(post.symbols) ? post.symbols.join(', ') : '';
      let text = `📰 <b>${post.title}</b>\n<i>${timeStr} UTC ${syms ? `· ${syms}` : ''}</i>\n\n`;
      text += (post.summary ?? '').slice(0, 600);
      if (citeCount > 0) text += `\n\n<i>📌 ${citeCount} SoSoValue data sources cited</i>`;
      const kb = new InlineKeyboard().text('📊 Briefing', 'briefing:now').text('🏠 Menu', 'menu:main');
      await (ctx as any).editMessageText(text, { parse_mode: 'HTML', reply_markup: kb });
    } catch {
      await (ctx as any).editMessageText(`<i>Failed to load newsletter.</i>`, { parse_mode: 'HTML' });
    }
  });


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

  bot.callbackQuery(/^papertrade:([A-Z0-9]+)$/, async (ctx) => {
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
              // 1. Validate asset on SoDEX Testnet (catches SOL "cancel only", unlisted assets, etc.)
              let symMeta: any;
              try {
                const { sodex: houseSodex } = await import('../clients/sodex');
                symMeta = await houseSodex.findMarketForAsset(asset);
                // Status guard — cancel-only symbols reject all new orders immediately
                const st = (symMeta?.status ?? '').toLowerCase().replace(/[_\s-]/g, '');
                if (st && st !== 'trading' && st !== 'active' && st !== '' && st !== 'open') {
                  await ctx.reply(
                    `⚠️ <b>${asset} Not Tradeable on SoDEX Testnet</b>\n\n` +
                    `<b>${symMeta.name}</b> is currently in <b>${symMeta.status}</b> mode.\n` +
                    `New orders are not accepted for this symbol.\n\n` +
                    `<b>Available now:</b> BTC · ETH · SOL · XRP · ADA · DOGE · LINK · AVAX · BNB · UNI · LTC · ZEC · HYPE · SHIB · AAVE · XAUT · SOSO · TSLA · NVDA · META · AAPL · AMZN · GOOGL · MSFT\n` +
                    `<i>Try: "buy $10 SOL" or tap below</i>`,
                    {
                      parse_mode: 'HTML',
                      reply_markup: new InlineKeyboard()
                        .text('₿ BTC', 'trade_amount:BTC:buy').text('Ξ ETH', 'trade_amount:ETH:buy').text('◎ SOL', 'trade_amount:SOL:buy').row()
                        .text('⚡ XRP', 'trade_amount:XRP:buy').text('🪙 ADA', 'trade_amount:ADA:buy').text('🐶 DOGE', 'trade_amount:DOGE:buy').row()
                        .text('🏠 Main Menu', 'menu:main'),
                    }
                  );
                  return true;
                }
              } catch {
                // Asset not found on SoDEX Testnet
                await ctx.reply(
                  `⚠️ <b>${asset} not found on SoDEX Testnet</b>\n\n` +
                  `Available spot assets:\n` +
                  `<b>BTC · ETH · SOL · XRP · ADA · DOGE · LINK · AVAX · BNB · UNI · LTC · ZEC · HYPE · SHIB · AAVE · XAUT · SOSO · TSLA · NVDA · META · AAPL · AMZN · GOOGL · MSFT</b>\n\n` +
                  `<i>Try: "buy $50 SOL" or tap below</i>`,
                  {
                    parse_mode: 'HTML',
                    reply_markup: new InlineKeyboard()
                      .text('₿ BTC', 'trade_amount:BTC:buy').text('Ξ ETH', 'trade_amount:ETH:buy').text('◎ SOL', 'trade_amount:SOL:buy').row()
                      .text('⚡ XRP', 'trade_amount:XRP:buy').text('🪙 ADA', 'trade_amount:ADA:buy').text('🐶 DOGE', 'trade_amount:DOGE:buy').row()
                      .text('🏠 Main Menu', 'menu:main'),
                  }
                );
                return true;
              }
              // 2. Get price to estimate quantity from USD amount
              let price = 0;
              try {
                const snap: any = await sosovalue.getMarketSnapshot(asset);
                price = Number(snap?.price ?? snap?.last_price ?? snap?.data?.price ?? 0);
              } catch { /* ignore */ }
              if (!price || price <= 0) {
                try {
                  const { getSpotPrice } = await import('../clients/market');
                  price = (await getSpotPrice(asset)) ?? 0;
                } catch { /* ignore */ }
              }
              const qty = price > 1 ? usd / price : 0.001;
              // 3. Route through showTradeConfirm → uses embedded wallet (same path as button trades)
              //    This ensures orders appear in the user's own portfolio on testnet.sodex.com
              await showTradeConfirm(ctx, asset, side, qty);
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
    '📈 SSI Indexes', '📰 Newsletter', '🧠 Intel',
    '✖ Hide Menu',
  ]);
  bot.on('message:text', async (ctx, next) => {
    const text = ctx.message?.text ?? '';
    // Pass commands and keyboard shortcuts to their registered handlers
    if (!text || text.startsWith('/') || KEYBOARD_LABELS.has(text)) return next();

    // ── Private key import conversation handler ──────────────────────────────
    const chatId = String(ctx.chat?.id ?? '');
    if (chatId && awaitingInput.get(chatId) === 'import_key') {
      awaitingInput.delete(chatId);
      // Try to delete user's message for security
      await ctx.deleteMessage().catch(() => {});

      const rawKey = text.trim();
      const normalized = rawKey.startsWith('0x') ? rawKey : `0x${rawKey}`;
      if (!/^0x[0-9a-fA-F]{64}$/.test(normalized)) {
        await ctx.reply(
          '❌ <b>Invalid private key</b>\n\nMust be 64 hex characters (with or without 0x prefix).\n\nTry <b>Import Key</b> again from /wallet.',
          { parse_mode: 'HTML' }
        );
        return;
      }
      try {
        const { ethers } = await import('ethers');
        const { encryptPrivateKey } = await import('../utils/walletCrypto');
        const newWallet = new ethers.Wallet(normalized);
        const encryptedKey = encryptPrivateKey(normalized);
        const updated = await replaceTelegramWallet(chatId, newWallet.address, encryptedKey);
        if (!updated) throw new Error('DB update failed');
        await ctx.reply(
          `✅ <b>Wallet Imported Successfully</b>\n\n` +
          `📍 New Address:\n<code>${newWallet.address}</code>\n\n` +
          `<i>The bot will now trade using this wallet. If this is your MetaMask wallet, it's already connected to SoDEX — just fund it via the 🚰 faucet.</i>`,
          {
            parse_mode: 'HTML',
            reply_markup: new InlineKeyboard()
              .text('🚰 Faucet Guide', 'wallet:faucet').text('💰 Check Balance', 'wallet:balance').row()
              .text('👛 My Wallet', 'menu:wallet'),
          }
        );
      } catch (e) {
        await ctx.reply(
          `❌ <b>Import Failed</b>\n<code>${(e as Error).message}</code>\n\nTry again via /wallet.`,
          { parse_mode: 'HTML' }
        );
      }
      return;
    }

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

  // ── Setup Onboarding — 4-Step Interactive Wizard ─────────────────────────────
  //
  //  Step 1 (/start)  → Wallet address + Export key → MetaMask import
  //  Step 2 (setup:step2) → Add ValueChain Testnet network to MetaMask
  //  Step 3 (setup:step3) → testnet.sodex.com/portfolio: connect, claim, enable
  //  Step 4 (setup:step4) / done → Fully ready, show trading shortcuts
  //
  // setup:start re-shows Step 1 overview (used from buttons throughout bot)
  // ─────────────────────────────────────────────────────────────────────────────

  const sendSetupGuide = async (ctx: Context) => {
    // Overview / re-entry point — shows wallet status and step links
    const chatId = String(ctx.chat?.id ?? '');
    const wallet = chatId
      ? await getOrCreateTelegramWallet(chatId, ctx.from?.username, ctx.from?.first_name).catch(() => null)
      : null;

    let sodexStatus = '⏳ Checking…';
    let balanceLine = '⏳ Checking…';
    if (wallet?.encrypted_key) {
      try {
        const { SoDEXClient } = await import('../clients/sodex');
        const { decryptPrivateKey } = await import('../utils/walletCrypto');
        const userClient = new SoDEXClient({
          chainId: parseInt(process.env.SODEX_CHAIN_ID || '138565', 10),
          privateKey: decryptPrivateKey(wallet.encrypted_key),
          isTestnet: true,
        });
        const accID = await userClient.resolveAccountID().catch(() => 0);
        if (accID > 0) {
          sodexStatus = `✅ Registered (ID: ${accID})`;
          const rawBals: any = await userClient.getAccountBalances().catch(() => []);
          const bals: any[] = Array.isArray(rawBals) ? rawBals
            : Array.isArray(rawBals?.balances) ? rawBals.balances
            : Array.isArray(rawBals?.data) ? rawBals.data : [];
          const usdc = bals.find((b: any) =>
            String(b.coin ?? b.asset ?? '').toUpperCase().includes('USDC')
          );
          const usdcAmt = usdc ? Number(usdc.available ?? usdc.free ?? usdc.total ?? 0) : 0;
          balanceLine = usdcAmt > 0
            ? `✅ ${usdcAmt.toFixed(2)} USDC`
            : bals.length > 0
              ? `⚠️ ${bals.length} assets — transfer Funding → Spot`
              : '❌ Empty — claim faucet then transfer to Spot';
        } else {
          sodexStatus = '❌ Not yet registered';
          balanceLine = '❌ Complete Step 3 first';
        }
      } catch {
        sodexStatus = '⏳ Could not connect'; balanceLine = '⏳';
      }
    }

    const addr = wallet?.wallet_address ?? '—';
    const text =
      `📋 <b>SosoMind Setup Guide</b>\n\n` +
      `<b>Wallet:</b> <code>${addr}</code>\n` +
      `<b>SoDEX Account:</b> ${sodexStatus}\n` +
      `<b>Spot Balance:</b> ${balanceLine}\n\n` +
      `━━━━━━━━━━━━━━━━━━━━━\n` +
      `<b>4-Step Activation Checklist:</b>\n\n` +
      `① 📤 Export private key → import to MetaMask\n` +
      `② 🌐 Add ValueChain Testnet network\n` +
      `③ 💰 Connect wallet → Claim testnet → Enable Trading\n` +
      `④ 🚀 Place your first trade from this bot!\n\n` +
      `<i>Tap any step to jump straight to its instructions.</i>`;

    const kb = new InlineKeyboard()
      .text('① Wallet & Key', 'setup:step1').text('② Add Network', 'setup:step2').row()
      .text('③ Claim & Enable', 'setup:step3').text('④ First Trade', 'setup:step4').row()
      .url('🚰 Faucet', 'https://testnet.sodex.com/faucet').url('📊 Portfolio', 'https://testnet.sodex.com/portfolio').row()
      .text('🔄 Refresh Status', 'setup:start').text('🏠 Main Menu', 'menu:main');

    if ((ctx as any).callbackQuery) {
      await (ctx as any).editMessageText(text, { parse_mode: 'HTML', reply_markup: kb, link_preview_options: { is_disabled: true } });
      await (ctx as any).answerCallbackQuery();
    } else {
      await ctx.reply(text, { parse_mode: 'HTML', reply_markup: kb, link_preview_options: { is_disabled: true } } as any);
    }
  };

  bot.command('setup', sendSetupGuide);
  bot.callbackQuery('setup:start', sendSetupGuide);

  // ── Setup Step 1 — Wallet address + export private key ──────────────────────
  bot.callbackQuery('setup:step1', async (ctx) => {
    await ctx.answerCallbackQuery();
    const chatId = String(ctx.chat?.id ?? '');
    const wallet = chatId
      ? await getOrCreateTelegramWallet(chatId, ctx.from?.username, ctx.from?.first_name).catch(() => null)
      : null;
    const addr = wallet?.wallet_address ?? '—';
    const text =
      `<b>● ○ ○ ○  STEP 1 — Your Wallet</b>\n\n` +
      `📍 <b>Your wallet address:</b>\n<code>${addr}</code>\n\n` +
      `This wallet signs all your trades automatically — you only need to set it up once in MetaMask to get testnet funds.\n\n` +
      `<b>What to do:</b>\n` +
      `① Tap <b>📤 Export Private Key</b> below\n` +
      `② Copy the key (it appears in the next message)\n` +
      `③ Open <b>MetaMask</b> → tap your account icon → <b>Import Account</b>\n` +
      `④ Paste the private key and tap <b>Import</b>\n\n` +
      `✅ Done? Proceed to Step 2 to add the network.\n\n` +
      `⚠️ <i>Never share your private key with anyone. Delete the key message after copying.</i>`;
    const kb = new InlineKeyboard()
      .text('📤 Export Private Key', 'wallet:export').row()
      .text('⬅️ Overview', 'setup:start').text('➡️ Step 2: Network', 'setup:step2');
    await (ctx as any).editMessageText(text, { parse_mode: 'HTML', reply_markup: kb });
  });

  // ── Setup Step 2 — Add ValueChain Testnet to MetaMask ───────────────────────
  bot.callbackQuery('setup:step2', async (ctx) => {
    await ctx.answerCallbackQuery();
    const text =
      `<b>○ ● ○ ○  STEP 2 — Add ValueChain Testnet to MetaMask</b>\n\n` +
      `Your imported wallet needs to be on the right network to interact with SoDEX.\n\n` +
      `<b>In MetaMask:</b>\n` +
      `① Tap the network selector at the top\n` +
      `② Tap <b>Add Network</b> → <b>Add Manually</b>\n` +
      `③ Fill in these details:\n\n` +
      `<b>Network Name:</b>\n<code>ValueChain Testnet</code>\n\n` +
      `<b>RPC URL:</b>\n<code>https://testnet-rpc.sosovalue.org</code>\n\n` +
      `<b>Chain ID:</b>\n<code>138565</code>\n\n` +
      `<b>Currency Symbol:</b>\n<code>SOSO</code>\n\n` +
      `<b>Block Explorer:</b>\n<code>https://testnet.sodex.com/explorer</code>\n\n` +
      `④ Tap <b>Save</b> — you are now on ValueChain Testnet!\n\n` +
      `✅ Done? Proceed to Step 3 to claim your free testnet funds.`;
    const kb = new InlineKeyboard()
      .text('⬅️ Step 1', 'setup:step1').text('➡️ Step 3: Claim Funds', 'setup:step3');
    await (ctx as any).editMessageText(text, { parse_mode: 'HTML', reply_markup: kb });
  });

  // ── Setup Step 3 — Portfolio: connect, claim, enable trading ────────────────
  bot.callbackQuery('setup:step3', async (ctx) => {
    await ctx.answerCallbackQuery();
    const text =
      `<b>○ ○ ● ○  STEP 3 — Claim Testnet Funds &amp; Enable Trading</b>\n\n` +
      `Now open the SoDEX Portfolio page and complete 3 quick actions:\n\n` +
      `<b>① Connect Your Wallet</b>\n` +
      `Go to 👉 <a href="https://testnet.sodex.com/portfolio">testnet.sodex.com/portfolio</a>\n` +
      `Tap <b>Connect Wallet</b> → choose <b>MetaMask</b>\n` +
      `Select your imported account and approve.\n\n` +
      `<b>② Claim Testnet Funds (free!)</b>\n` +
      `Go to 👉 <a href="https://testnet.sodex.com/faucet">testnet.sodex.com/faucet</a>\n` +
      `Tap <b>Claim</b> — you receive <b>100 USDC + SOSO gas</b> free per day.\n\n` +
      `<b>③ Enable Trading (one-time)</b>\n` +
      `Back on the portfolio page, click <b>"Enable Trading"</b>\n` +
      `Sign the MetaMask popup (this authorises the bot to place orders).\n\n` +
      `<b>④ Transfer to Spot</b>\n` +
      `Portfolio → Balances → find USDC → tap <b>Transfer</b>\n` +
      `Move funds from <b>Funding → Spot</b> so they are available to trade.\n\n` +
      `✅ Done? You are fully set up. Tap Step 4 to place your first trade!`;
    const kb = new InlineKeyboard()
      .url('📊 Open Portfolio', 'https://testnet.sodex.com/portfolio').row()
      .url('🚰 Open Faucet', 'https://testnet.sodex.com/faucet').row()
      .text('⬅️ Step 2', 'setup:step2').text('➡️ Step 4: Trade!', 'setup:step4');
    await (ctx as any).editMessageText(text, { parse_mode: 'HTML', reply_markup: kb, link_preview_options: { is_disabled: true } });
  });

  // ── Setup Step 4 — You're ready! First trade guide ──────────────────────────
  bot.callbackQuery('setup:step4', async (ctx) => {
    await ctx.answerCallbackQuery();
    const chatId = String(ctx.chat?.id ?? '');
    const wallet = chatId
      ? await getOrCreateTelegramWallet(chatId, ctx.from?.username, ctx.from?.first_name).catch(() => null)
      : null;

    let balanceLine = '⏳ Checking…';
    if (wallet?.encrypted_key) {
      try {
        const { SoDEXClient } = await import('../clients/sodex');
        const { decryptPrivateKey } = await import('../utils/walletCrypto');
        const userClient = new SoDEXClient({
          chainId: parseInt(process.env.SODEX_CHAIN_ID || '138565', 10),
          privateKey: decryptPrivateKey(wallet.encrypted_key),
          isTestnet: true,
        });
        const rawBals: any = await userClient.getAccountBalances().catch(() => []);
        const bals: any[] = Array.isArray(rawBals) ? rawBals
          : Array.isArray(rawBals?.balances) ? rawBals.balances
          : Array.isArray(rawBals?.data) ? rawBals.data : [];
        const nonZero = bals.filter((b: any) => Number(b.available ?? b.free ?? 0) > 0);
        balanceLine = nonZero.length > 0
          ? nonZero.map((b: any) => `<b>${b.coin ?? b.asset}</b> ${Number(b.available ?? b.free ?? 0).toFixed(2)}`).join(' · ')
          : '⚠️ No spot balance — complete Step 3 first';
      } catch {
        balanceLine = '⏳ Could not load';
      }
    }

    const text =
      `<b>○ ○ ○ ●  STEP 4 — You're Ready to Trade! 🎉</b>\n\n` +
      `💳 <b>Spot Balance:</b> ${balanceLine}\n\n` +
      `━━━━━━━━━━━━━━━━━━━━━\n` +
      `<b>How to trade from this bot:</b>\n\n` +
      `💬 <b>Natural language</b> — just type:\n` +
      `  <i>"buy $50 of BTC"</i>\n` +
      `  <i>"short ETH with $100"</i>\n` +
      `  <i>"close my BTC position"</i>\n\n` +
      `📊 <b>Inline buttons</b> — tap ⚡ Signal → pick asset → Execute\n\n` +
      `🎙️ <b>Voice messages</b> — send a voice note to trade hands-free\n\n` +
      `━━━━━━━━━━━━━━━━━━━━━\n` +
      `<b>Other things you can do:</b>\n` +
      `🔬 Research — AI deep analysis of any coin\n` +
      `🐋 Whales — track smart money flows\n` +
      `📊 Briefing — daily ETF &amp; macro summary\n` +
      `🏆 Leaderboard — paper trading competition\n\n` +
      `<i>⚡ The bot signs all orders automatically with your wallet. Zero MetaMask popups needed!</i>`;
    const kb = new InlineKeyboard()
      .text('⚡ Pick a Signal', 'menu:signal').text('🔬 Research Coin', 'menu:research').row()
      .text('💼 My Portfolio', 'menu:portfolio').text('👛 My Wallet', 'menu:wallet').row()
      .text('🏠 Main Menu', 'menu:main').text('⬅️ Back', 'setup:step3');
    await (ctx as any).editMessageText(text, { parse_mode: 'HTML', reply_markup: kb });
  });

  // ── Wallet Management (/wallet) ─────────────────────────────────────────────
  // Map of chatId → what we're awaiting from that user (conversation state)
  const awaitingInput = new Map<string, 'import_key'>();

  const VALUECHAIN_TESTNET = {
    chainId: '0x21D85', // 138565 decimal
    chainName: 'ValueChain Testnet',
    rpcUrls: ['https://testnet-rpc.sosovalue.org'],
    nativeCurrency: { name: 'SOSO', symbol: 'SOSO', decimals: 18 },
    blockExplorerUrls: ['https://testnet.sodex.com/explorer'],
  };

  const showWalletMenu = async (ctx: Context) => {
    const chatId = String(ctx.chat?.id ?? '');
    if (!chatId) return;

    const wallet = await getOrCreateTelegramWallet(chatId, ctx.from?.username, ctx.from?.first_name).catch(() => null);

    // Check if linked MetaMask wallet exists
    let linkedMetaMask: string | null = null;
    try {
      const { data } = await supabase.from('user_profiles')
        .select('wallet_address').eq('telegram_chat_id', chatId).maybeSingle();
      linkedMetaMask = (data as any)?.wallet_address ?? null;
    } catch {}

    const addr = wallet?.wallet_address ?? '—';
    const dashboardUrl = process.env.DASHBOARD_URL || '';
    const isPublicDashboard = dashboardUrl.startsWith('https://') && !dashboardUrl.includes('localhost');

    // Fetch live SoDEX balance inline
    let balanceLine = '<i>Balance: tap 🔄 Refresh Balance to load</i>';
    if (wallet?.encrypted_key) {
      try {
        const { decryptPrivateKey } = await import('../utils/walletCrypto');
        const { SoDEXClient } = await import('../clients/sodex');
        const pk = decryptPrivateKey(wallet.encrypted_key);
        const userClient = new SoDEXClient({
          chainId: parseInt(process.env.SODEX_CHAIN_ID || '138565', 10),
          privateKey: pk,
          isTestnet: true,
        });
        const rawBals: any = await userClient.getAccountBalances().catch(() => []);
        const bals: any[] = Array.isArray(rawBals) ? rawBals
          : Array.isArray(rawBals?.balances) ? rawBals.balances
          : Array.isArray(rawBals?.data) ? rawBals.data : [];
        const nonZero = bals.filter((b: any) => {
          // SoDEX /balances returns "total" and "locked" (not "available"/"free")
          const total = Number(b.total ?? b.available ?? b.free ?? 0);
          const locked = Number(b.locked ?? b.frozen ?? b.hold ?? 0);
          return (total + locked) > 0;
        });
        if (nonZero.length === 0) {
          balanceLine = '💳 Balance: <i>0 (claim faucet → transfer Funding → Spot)</i>';
        } else {
          const parts = nonZero.map((b: any) => {
            const coin = String(b.coin ?? b.asset ?? '?');
            const total = Number(b.total ?? b.available ?? b.free ?? 0);
            return `<b>${coin}</b> ${total.toFixed(4)}`;
          });
          balanceLine = `💳 Balance: ${parts.join(' · ')}`;
        }
      } catch {
        balanceLine = '<i>Balance: unavailable (tap 🔄 to retry)</i>';
      }
    }

    const text =
      `👛 <b>Your SosoMind Wallet</b>\n\n` +
      `📍 Address:\n<code>${addr}</code>\n\n` +
      `${balanceLine}\n` +
      `🌐 Network: ValueChain Testnet (chainId 138565)\n` +
      (linkedMetaMask
        ? `🦊 MetaMask: <code>${linkedMetaMask.slice(0, 10)}…${linkedMetaMask.slice(-6)}</code>\n`
        : '') +
      `🔗 <a href="https://testnet.sodex.com/explorer">View on Explorer</a>\n\n` +
      `• <b>Export Key</b> — import into MetaMask\n` +
      `• <b>Import Key</b> — use your own wallet\n` +
      `• <b>Faucet Guide</b> — free 100 USDC/day\n` +
      (isPublicDashboard ? `• <a href="${dashboardUrl}/profile">Link MetaMask</a> via dashboard\n` : '');

    const kb = new InlineKeyboard()
      .text('🔑 Export Key', 'wallet:export').text('📥 Import Key', 'wallet:import').row()
      .text('🚰 Faucet Guide', 'wallet:faucet').text('🔄 Refresh Balance', 'wallet:balance').row();
    if (isPublicDashboard) {
      kb.url('🦊 Link MetaMask', `${dashboardUrl}/profile`).row();
    }
    kb.text('🏠 Main Menu', 'menu:main');

    if ((ctx as any).callbackQuery) {
      await (ctx as any).editMessageText(text, { parse_mode: 'HTML', reply_markup: kb, link_preview_options: { is_disabled: true } });
      await (ctx as any).answerCallbackQuery();
    } else {
      await ctx.reply(text, { parse_mode: 'HTML', reply_markup: kb, link_preview_options: { is_disabled: true } });
    }
  };

  bot.command('wallet', showWalletMenu);
  bot.callbackQuery('menu:wallet', showWalletMenu);

  // Export private key — step 1: confirm
  bot.callbackQuery('wallet:export', async (ctx) => {
    await ctx.answerCallbackQuery();
    const chatId = String(ctx.chat?.id ?? '');
    const wallet = await getOrCreateTelegramWallet(chatId).catch(() => null);
    if (!wallet) {
      await ctx.reply('❌ No wallet found. Send /start to create one.'); return;
    }
    const text =
      `⚠️ <b>Security Warning — Private Key Export</b>\n\n` +
      `Your private key grants <b>full control</b> of your wallet.\n\n` +
      `✅ <b>Safe uses:</b>\n` +
      `  • Import into MetaMask to fund via faucet\n` +
      `  • Back up offline (paper/hardware wallet)\n\n` +
      `❌ <b>Never:</b>\n` +
      `  • Share with anyone\n` +
      `  • Screenshot or paste in public chats\n` +
      `  • Use on untrusted sites\n\n` +
      `Wallet: <code>${wallet.wallet_address.slice(0, 10)}…${wallet.wallet_address.slice(-6)}</code>\n\n` +
      `Tap <b>Show Key</b> to reveal your private key in the next message.\n` +
      `<i>⚠️ Delete that message immediately after copying!</i>`;
    const kb = new InlineKeyboard()
      .text('🔑 Show Key Now', 'wallet:confirm_export').row()
      .text('❌ Cancel', 'menu:wallet');
    await (ctx as any).editMessageText(text, { parse_mode: 'HTML', reply_markup: kb });
  });

  // Export private key — step 2: reveal
  bot.callbackQuery('wallet:confirm_export', async (ctx) => {
    await ctx.answerCallbackQuery({ text: '🔑 Revealing key…' });
    const chatId = String(ctx.chat?.id ?? '');
    const wallet = await getOrCreateTelegramWallet(chatId).catch(() => null);
    if (!wallet) {
      await (ctx as any).editMessageText('❌ Wallet not found.', { parse_mode: 'HTML' }); return;
    }
    try {
      const { decryptPrivateKey } = await import('../utils/walletCrypto');
      const pk = decryptPrivateKey(wallet.encrypted_key);
      // Delete the warning message first
      await (ctx as any).editMessageText(
        `🔑 <b>Your Private Key</b>\n\n` +
        `<code>${pk}</code>\n\n` +
        `📋 Copy it now, then:\n` +
        `1. Open MetaMask → Import Account → Paste key\n` +
        `2. <b>Delete this message immediately!</b>\n\n` +
        `✅ <i>Once imported, tap <b>Continue Setup</b> to add the ValueChain network and get testnet funds.</i>\n\n` +
        `⚠️ <i>SosoMind will never ask for your key again.</i>`,
        {
          parse_mode: 'HTML',
          reply_markup: new InlineKeyboard()
            .text('➡️ Continue Setup (Step 2)', 'setup:step2').row()
            .text('✅ Done — My Wallet', 'menu:wallet'),
        }
      );
    } catch (e) {
      await (ctx as any).editMessageText(`❌ Decrypt error: ${(e as Error).message}`, { parse_mode: 'HTML' });
    }
  });

  // Import private key — prompt
  bot.callbackQuery('wallet:import', async (ctx) => {
    await ctx.answerCallbackQuery();
    const chatId = String(ctx.chat?.id ?? '');
    const current = await getOrCreateTelegramWallet(chatId).catch(() => null);
    awaitingInput.set(chatId, 'import_key');
    const text =
      `📥 <b>Import Wallet</b>\n\n` +
      `Reply with your private key (64-char hex or 0x-prefixed).\n\n` +
      `<b>Current wallet:</b> <code>${current?.wallet_address ?? '—'}</code>\n` +
      `<i>It will be replaced with your imported wallet.</i>\n\n` +
      `⚠️ Only do this in a private chat. Delete the message after sending.\n` +
      `✅ Tip: Export your MetaMask key via MetaMask → Account → Export Private Key`;
    await (ctx as any).editMessageText(text, {
      parse_mode: 'HTML',
      reply_markup: new InlineKeyboard().text('❌ Cancel', 'wallet:import_cancel'),
    });
  });

  bot.callbackQuery('wallet:import_cancel', async (ctx) => {
    const chatId = String(ctx.chat?.id ?? '');
    awaitingInput.delete(chatId);
    await ctx.answerCallbackQuery({ text: 'Import cancelled' });
    await showWalletMenu(ctx);
  });

  // Faucet guide
  bot.callbackQuery('wallet:faucet', async (ctx) => {
    await ctx.answerCallbackQuery();
    const chatId = String(ctx.chat?.id ?? '');
    const wallet = await getOrCreateTelegramWallet(chatId).catch(() => null);
    const addr = wallet?.wallet_address ?? '(run /wallet to get yours)';
    const text =
      `🚰 <b>Get Free Testnet USDC — Step by Step</b>\n\n` +
      `<b>Step 1</b> — Get your bot wallet address:\n` +
      `<code>${addr}</code>\n\n` +
      `<b>Step 2</b> — Add ValueChain Testnet to MetaMask:\n` +
      `  • Network Name: <code>ValueChain Testnet</code>\n` +
      `  • RPC URL: <code>https://testnet-rpc.sosovalue.org</code>\n` +
      `  • Chain ID: <code>138565</code>\n` +
      `  • Symbol: <code>SOSO</code>\n` +
      `  • Explorer: <code>https://testnet.sodex.com/explorer</code>\n\n` +
      `<b>Step 3</b> — Import your bot wallet into MetaMask:\n` +
      `  Use <b>Export Key</b> button → paste key in MetaMask → Import Account\n` +
      `  <i>(Or import your existing MetaMask key into the bot via Import Key)</i>\n\n` +
      `<b>Step 4</b> — Claim free tokens:\n` +
      `  🔗 <a href="https://testnet.sodex.com/faucet">testnet.sodex.com/faucet</a>\n` +
      `  → Connect wallet → Claim <b>100 USDC</b> + SOSO daily\n\n` +
      `<b>Step 5</b> — Transfer to Spot Account:\n` +
      `  On SoDEX → Funding Account → Transfer to Spot\n` +
      `  (SoDEX separates funding ↔ trading accounts)\n\n` +
      `<b>Step 6</b> — Trade on SosoMind:\n` +
      `  Go to ⚡ Signal → pick asset → set qty → Execute!\n\n` +
      `<i>💡 The bot uses your wallet directly — no MetaMask needed for trades after funding!</i>`;
    const kb = new InlineKeyboard()
      .url('🚰 Open Faucet', 'https://testnet.sodex.com/faucet').row()
      .text('🔑 Export My Key', 'wallet:export').text('📥 Import My Key', 'wallet:import').row()
      .text('⬅️ Back to Wallet', 'menu:wallet');
    await (ctx as any).editMessageText(text, { parse_mode: 'HTML', reply_markup: kb, link_preview_options: { is_disabled: true } });
  });

  // Wallet balance from SoDEX
  bot.callbackQuery('wallet:balance', async (ctx) => {
    await ctx.answerCallbackQuery({ text: '🔄 Fetching balance…' });
    const chatId = String(ctx.chat?.id ?? '');
    const wallet = await getOrCreateTelegramWallet(chatId).catch(() => null);
    if (!wallet) {
      await ctx.reply('❌ No wallet found.'); return;
    }
    try {
      const { SoDEXClient } = await import('../clients/sodex');
      const { decryptPrivateKey } = await import('../utils/walletCrypto');
      const userClient = new SoDEXClient({
        chainId: parseInt(process.env.SODEX_CHAIN_ID || '138565', 10),
        privateKey: decryptPrivateKey(wallet.encrypted_key),
        isTestnet: true,
      });
      const rawBals: any = await userClient.getAccountBalances().catch(() => null);
      // SoDEX returns { balances: [...] } or a flat array after unwrap()
      const balances: any[] = Array.isArray(rawBals)
        ? rawBals
        : Array.isArray(rawBals?.balances)
          ? rawBals.balances
          : Array.isArray(rawBals?.data)
            ? rawBals.data
            : [];
      const lines: string[] = [
        `💰 <b>SoDEX Testnet Balance</b>`,
        `👛 <code>${wallet.wallet_address.slice(0, 10)}…${wallet.wallet_address.slice(-6)}</code>`,
        '',
      ];
      if (!balances.length) {
        lines.push('<i>No assets found. Claim faucet → transfer Funding → Spot.</i>');
        lines.push('');
        lines.push('Use /setup for the full guide.');
      } else {
        for (const b of balances) {
          const coin = String(b.coin ?? b.asset ?? b.currency ?? '?');
          const avail = Number(b.available ?? b.free ?? 0);
          const locked = Number(b.locked ?? b.frozen ?? b.hold ?? 0);
          const total = avail + locked;
          if (total > 0) {
            const lockStr = locked > 0 ? ` | 🔒 ${locked.toFixed(4)}` : '';
            lines.push(`  <b>${coin}</b>: ${avail.toFixed(4)} avail${lockStr}`);
          }
        }
        if (lines.length === 3) lines.push('<i>All balances are zero.</i> Use /setup → 🚰 Faucet.');
      }
      const kb = new InlineKeyboard()
        .text('🚰 Get Testnet USDC', 'wallet:faucet').text('🔄 Refresh', 'wallet:balance').row()
        .text('⬅️ Back', 'menu:wallet');
      await (ctx as any).editMessageText(lines.join('\n'), { parse_mode: 'HTML', reply_markup: kb });
    } catch (e) {
      await (ctx as any).editMessageText(
        `❌ Balance error: <code>${(e as Error).message}</code>`,
        { parse_mode: 'HTML', reply_markup: new InlineKeyboard().text('⬅️ Back', 'menu:wallet') }
      );
    }
  });

  // ── Sector Intelligence (/intel) ────────────────────────────────────────────
  const sendSectorIntel = async (ctx: Context) => {
    const loading = `🧠 <b>Loading Sector Intelligence…</b>\n\n<i>Computing multi-signal scores for all 13 sectors…</i>`;
    if ((ctx as any).callbackQuery) {
      await (ctx as any).editMessageText(loading, { parse_mode: 'HTML' });
      await (ctx as any).answerCallbackQuery({ text: 'Loading sector intel…' });
    } else {
      await ctx.reply(loading, { parse_mode: 'HTML' });
    }
    try {
      const resp = await fetch(`http://localhost:${process.env.PORT || 10000}/api/sectors/intel`);
      const json = await resp.json() as any;
      const sectors: any[] = Array.isArray(json.data) ? json.data : [];
      const top3 = sectors.filter(s => s.verdict === 'STRONG_BUY' || s.verdict === 'BUY').slice(0, 3);
      const lines = [`🧠 <b>Sector Intelligence</b> — Top Opportunities\n`];
      if (!top3.length && sectors.length === 0) {
        lines.push('<i>Intel engine warming up. Try again shortly.</i>');
      } else {
        const display = top3.length ? top3 : sectors.slice(0, 3);
        for (const s of display) {
          const verdictIcon = s.verdict === 'STRONG_BUY' ? '🟢🟢' : s.verdict === 'BUY' ? '🟢' : s.verdict === 'NEUTRAL' ? '⚪' : '🔴';
          const scoreBar = '█'.repeat(Math.round(s.score / 10)) + '░'.repeat(10 - Math.round(s.score / 10));
          lines.push(`${verdictIcon} <b>${s.sector}</b> (<code>${s.ticker}</code>) — Score: ${s.score.toFixed(0)}/100`);
          lines.push(`   [${scoreBar}] ${s.verdict}`);
          lines.push(`   S1: ${s.s1.toFixed(0)} · S2: ${s.s2.toFixed(0)} · S3: ${s.s3.toFixed(0)}`);
          if (s.aiNarrative) lines.push(`   <i>${String(s.aiNarrative).slice(0, 100)}</i>`);
          lines.push('');
        }
        lines.push(`<i>📊 ${sectors.length} sectors scored · Updated ${new Date().toLocaleTimeString('en-US', { timeZone: 'UTC', hour12: false })} UTC</i>`);
      }
      const kb = new InlineKeyboard()
        .text('🔄 Refresh', 'intel:refresh').text('📊 All Sectors', 'intel:all').row()
        .text('⬅️ Back', 'menu:main');
      const text = lines.join('\n');
      if ((ctx as any).callbackQuery) {
        await (ctx as any).editMessageText(text, { parse_mode: 'HTML', reply_markup: kb });
      } else {
        await ctx.reply(text, { parse_mode: 'HTML', reply_markup: kb });
      }
    } catch (e) {
      const errMsg = `❌ Intel Error: ${(e as Error).message}`;
      if ((ctx as any).callbackQuery) await (ctx as any).editMessageText(errMsg, { parse_mode: 'HTML' });
      else await ctx.reply(errMsg, { parse_mode: 'HTML' });
    }
  };

  bot.command('intel', sendSectorIntel);
  bot.hears('🧠 Intel', sendSectorIntel);
  bot.callbackQuery('intel:refresh', sendSectorIntel);
  bot.callbackQuery('intel:view', sendSectorIntel);
  bot.hears(/\b(intel|sector intel|intelligence|sector score)\b/i, sendSectorIntel);

  bot.callbackQuery('intel:all', async (ctx) => {
    await ctx.answerCallbackQuery({ text: 'Loading all sectors…' });
    try {
      const resp = await fetch(`http://localhost:${process.env.PORT || 10000}/api/sectors/intel`);
      const json = await resp.json() as any;
      const sectors: any[] = Array.isArray(json.data) ? json.data : [];
      const lines = [`🧠 <b>All Sector Scores</b>\n`];
      for (const s of sectors) {
        const icon = s.verdict === 'STRONG_BUY' ? '🟢🟢' : s.verdict === 'BUY' ? '🟢' : s.verdict === 'NEUTRAL' ? '⚪' : '🔴';
        lines.push(`${icon} <b>${s.sector}</b> ${s.score.toFixed(0)}/100 — ${s.verdict}`);
      }
      await (ctx as any).editMessageText(lines.join('\n'), {
        parse_mode: 'HTML',
        reply_markup: new InlineKeyboard().text('⬅️ Back', 'intel:refresh').text('🏠 Menu', 'menu:main'),
      });
    } catch (e) {
      await (ctx as any).editMessageText(`❌ ${(e as Error).message}`, { parse_mode: 'HTML' });
    }
  });

  // ── Sector Basket (/basket <sector>) ─────────────────────────────────────────
  const SECTOR_TICKERS = ['ssiAI', 'ssiDeFi', 'ssiLayer1', 'ssiLayer2', 'ssiGaming', 'ssiInfra', 'ssiMeme', 'ssiRWA', 'ssiDePIN', 'ssiSocial', 'ssiNFT', 'ssiCEX', 'ssiDEX'];

  async function runBasket(ctx: Context, ticker: string) {
    const cleanTicker = ticker.trim().toLowerCase().startsWith('ssi') ? ticker.trim() : `ssi${ticker.trim()}`;
    const loadMsg = `🧺 <b>Building ${cleanTicker} Basket…</b>\n\n<i>Fetching top assets and live sector score…</i>`;
    if ((ctx as any).callbackQuery) {
      await (ctx as any).editMessageText(loadMsg, { parse_mode: 'HTML' });
      await (ctx as any).answerCallbackQuery({ text: 'Loading basket…' });
    } else {
      await ctx.reply(loadMsg, { parse_mode: 'HTML' });
    }
    try {
      const resp = await fetch(`http://localhost:${process.env.PORT || 10000}/api/sectors/intel/${cleanTicker}/basket`);
      if (!resp.ok) throw new Error(`Sector "${cleanTicker}" not found. Try: ${SECTOR_TICKERS.slice(0, 5).join(', ')}…`);
      const json = await resp.json() as any;
      const d = json.data ?? {};
      const basket: Array<{ asset: string; weight: number; rationale?: string }> = d.basket ?? [];
      const verdict = d.verdict ?? 'NEUTRAL';
      const score = Number(d.score ?? 0);
      const verdictIcon = verdict === 'STRONG_BUY' ? '🟢🟢' : verdict === 'BUY' ? '🟢' : verdict === 'NEUTRAL' ? '⚪' : '🔴';

      // Filter basket to only assets with tradeable SoDEX markets (skip CANCEL_ONLY etc.)
      const NON_TRADING_ST = ['CANCEL_ONLY', 'HALT', 'SUSPENDED', 'BREAK', 'DISABLED', 'INACTIVE', 'CLOSED'];
      let tradeableBasket = basket;
      try {
        const { SoDEXClient } = await import('../clients/sodex');
        const pubClient = new SoDEXClient({ chainId: parseInt(process.env.SODEX_CHAIN_ID || '138565', 10), isTestnet: true });
        const checked = await Promise.all(basket.map(async (item) => {
          try {
            const meta: any = await pubClient.findMarketForAsset(item.asset);
            const st = String(meta?.status ?? '').toUpperCase();
            const isBlocked = st && NON_TRADING_ST.some(s => st.includes(s));
            return { ...item, _blocked: isBlocked, _status: st };
          } catch { return { ...item, _blocked: false, _status: '' }; }
        }));
        tradeableBasket = checked.filter((i: any) => !i._blocked);
      } catch { /* non-fatal — show all if check fails */ }

      const lines = [
        `🧺 <b>${d.sector ?? cleanTicker} Basket</b>\n`,
        `${verdictIcon} Sector Verdict: <b>${verdict}</b> | Score: <b>${score.toFixed(0)}/100</b>\n`,
        `<b>Top Assets:</b>`,
      ];
      for (const item of basket) {
        const blocked = (item as any)._blocked;
        const bar = '█'.repeat(Math.round(item.weight / 5));
        lines.push(`  ${blocked ? '⚫' : '💎'} <b>${item.asset}</b> — ${item.weight}% weight [${bar}]${blocked ? ' <i>(cancel-only)</i>' : ''}`);
        if (item.rationale) lines.push(`     <i>${item.rationale}</i>`);
      }
      lines.push('');
      if (tradeableBasket.length < basket.length) {
        lines.push(`<i>⚠️ Some assets are in cancel-only mode on SoDEX Testnet — buttons shown only for active markets</i>`);
      } else {
        lines.push(`<i>⚖️ Equal-weight basket · Execute each position via SoDEX</i>`);
      }
      const kb = new InlineKeyboard();
      if (tradeableBasket[0]) kb.text(`🚀 ${tradeableBasket[0].asset}`, `trade_amount:${tradeableBasket[0].asset}:buy`);
      if (tradeableBasket[1]) kb.text(`🚀 ${tradeableBasket[1].asset}`, `trade_amount:${tradeableBasket[1].asset}:buy`);
      if (tradeableBasket[2]) kb.text(`🚀 ${tradeableBasket[2].asset}`, `trade_amount:${tradeableBasket[2].asset}:buy`).row();
      kb.text('🧠 Sector Intel', 'intel:view').text('⬅️ Back', 'menu:main');
      const text = lines.join('\n');
      if ((ctx as any).callbackQuery) {
        await (ctx as any).editMessageText(text, { parse_mode: 'HTML', reply_markup: kb });
      } else {
        await ctx.reply(text, { parse_mode: 'HTML', reply_markup: kb });
      }
    } catch (e) {
      const errMsg = `❌ <b>Basket Error</b>\n<code>${(e as Error).message}</code>\n\n<i>Available sectors: ${SECTOR_TICKERS.join(', ')}</i>`;
      const kb = new InlineKeyboard().text('🧠 Intel', 'intel:view').text('🏠 Menu', 'menu:main');
      if ((ctx as any).callbackQuery) await (ctx as any).editMessageText(errMsg, { parse_mode: 'HTML', reply_markup: kb });
      else await ctx.reply(errMsg, { parse_mode: 'HTML', reply_markup: kb });
    }
  }

  bot.command('basket', async (ctx) => {
    const ticker = (ctx.match || '').toString().trim();
    if (!ticker) {
      const kb = new InlineKeyboard()
        .text('ssiAI', 'basket:ssiAI').text('ssiDeFi', 'basket:ssiDeFi').text('ssiLayer1', 'basket:ssiLayer1').row()
        .text('ssiLayer2', 'basket:ssiLayer2').text('ssiGaming', 'basket:ssiGaming').text('ssiInfra', 'basket:ssiInfra').row()
        .text('ssiMeme', 'basket:ssiMeme').text('ssiRWA', 'basket:ssiRWA').text('ssiDePIN', 'basket:ssiDePIN').row()
        .text('ssiCEX', 'basket:ssiCEX').text('ssiDEX', 'basket:ssiDEX').text('ssiNFT', 'basket:ssiNFT').row()
        .text('⬅️ Back', 'menu:main');
      return ctx.reply(
        `🧺 <b>Sector Basket Builder</b>\n\n<i>Select a sector to see top-3 assets by momentum score, or use:</i>\n<code>/basket ssiAI</code>`,
        { parse_mode: 'HTML', reply_markup: kb }
      );
    }
    await runBasket(ctx, ticker);
  });

  bot.callbackQuery('basket:menu', async (ctx) => {
    await ctx.answerCallbackQuery();
    const kb = new InlineKeyboard()
      .text('ssiAI', 'basket:ssiAI').text('ssiDeFi', 'basket:ssiDeFi').text('ssiLayer1', 'basket:ssiLayer1').row()
      .text('ssiLayer2', 'basket:ssiLayer2').text('ssiGaming', 'basket:ssiGaming').text('ssiInfra', 'basket:ssiInfra').row()
      .text('ssiMeme', 'basket:ssiMeme').text('ssiRWA', 'basket:ssiRWA').text('ssiDePIN', 'basket:ssiDePIN').row()
      .text('ssiCEX', 'basket:ssiCEX').text('ssiDEX', 'basket:ssiDEX').text('ssiNFT', 'basket:ssiNFT').row()
      .text('⬅️ Back', 'menu:main');
    await (ctx as any).editMessageText(
      `🧺 <b>Sector Basket Builder</b>\n\n<i>Pick a sector to see top-3 assets by momentum score with execute buttons:</i>`,
      { parse_mode: 'HTML', reply_markup: kb }
    );
  });

  bot.callbackQuery(/^basket:(.+)$/, async (ctx) => {
    await runBasket(ctx, ctx.match[1]);
  });

  bot.hears(/\b(basket|sector basket|build basket)\b/i, async (ctx) => {
    const match = ctx.message?.text?.match(/\b(ssi\w+)\b/i);
    if (match) return runBasket(ctx, match[1]);
    return ctx.reply(`🧺 Use <code>/basket ssiAI</code> to build a sector basket.\n\nAvailable: ${SECTOR_TICKERS.join(', ')}`, { parse_mode: 'HTML' });
  });

  // ── Methodology (/methodology) ────────────────────────────────────────────────
  bot.command('methodology', async (ctx) => {
    const text =
      `📐 <b>SosoMind Signal Methodology</b>\n\n` +
      `<b>Composite Score Formula:</b>\n` +
      `<code>S = (S1 × 0.30) + (S2 × 0.35) + (S3 × 0.35)</code>\n\n` +
      `📊 <b>S1 — Market Momentum (30%)</b>\n` +
      `   Price action, ETF flows, volume, 24h change, BTC dominance\n\n` +
      `🤖 <b>S2 — AI Sentiment (35%)</b>\n` +
      `   6-provider AI chain: Cerebras → SambaNova → Together → OpenRouter → Groq → Gemini\n` +
      `   News NLP, social signals, fear/greed index\n\n` +
      `📈 <b>S3 — On-chain Fundamentals (35%)</b>\n` +
      `   Macro events, sector rotation, fundraising, crypto stocks, whale flows\n\n` +
      `<b>Verdicts:</b>\n` +
      `🟢🟢 <b>STRONG_BUY</b>  ≥ 75/100\n` +
      `🟢 <b>BUY</b>          55 – 74\n` +
      `⚪ <b>NEUTRAL</b>      35 – 54\n` +
      `🔴 <b>SELL</b>         &lt; 35\n\n` +
      `⏱️ <b>Outcome Evaluation:</b> 72h window — HIT / STOP / DRIFT tracked automatically\n\n` +
      `⛓️ <b>Execution:</b> EIP-712 signed orders on SoDEX (testnet v2)\n\n` +
      `🌐 <a href="https://sosomind.vercel.app/methodology">Full Methodology →</a>`;
    const kb = new InlineKeyboard()
      .text('📊 Track Record', 'track_record:view').text('🧠 Intel', 'intel:view').row()
      .text('⚡ Run Signal', 'menu:signal').text('🏠 Menu', 'menu:main');
    await ctx.reply(text, { parse_mode: 'HTML', reply_markup: kb });
  });

  bot.hears(/\b(methodology|scoring formula|how signals work|signal formula)\b/i, async (ctx) => {
    const text =
      `📐 <b>Signal Scoring: Quick Reference</b>\n\n` +
      `<code>Score = (S1×0.30) + (S2×0.35) + (S3×0.35)</code>\n\n` +
      `S1 Market · S2 AI Sentiment · S3 On-chain\n\n` +
      `🟢🟢 STRONG_BUY ≥75 · 🟢 BUY 55–74 · ⚪ NEUTRAL 35–54 · 🔴 SELL &lt;35\n\n` +
      `🌐 <a href="https://sosomind.vercel.app/methodology">Full docs →</a>`;
    const kb = new InlineKeyboard().text('📐 Full Methodology', 'methodology:full').text('🏠 Menu', 'menu:main');
    await ctx.reply(text, { parse_mode: 'HTML', reply_markup: kb });
  });

  bot.callbackQuery('methodology:full', async (ctx) => {
    await ctx.answerCallbackQuery();
    const text =
      `📐 <b>SosoMind Signal Methodology</b>\n\n` +
      `<b>Composite Score Formula:</b>\n` +
      `<code>S = (S1 × 0.30) + (S2 × 0.35) + (S3 × 0.35)</code>\n\n` +
      `📊 <b>S1 — Market Momentum (30%)</b>\n` +
      `   Price action, ETF flows, volume, 24h change, BTC dominance\n\n` +
      `🤖 <b>S2 — AI Sentiment (35%)</b>\n` +
      `   6-provider AI chain: Cerebras → SambaNova → Together → OpenRouter → Groq → Gemini\n` +
      `   News NLP, social signals, fear/greed index\n\n` +
      `📈 <b>S3 — On-chain Fundamentals (35%)</b>\n` +
      `   Macro events, sector rotation, fundraising, crypto stocks, whale flows\n\n` +
      `<b>Verdicts:</b>\n` +
      `🟢🟢 <b>STRONG_BUY</b>  ≥ 75/100\n` +
      `🟢 <b>BUY</b>          55 – 74\n` +
      `⚪ <b>NEUTRAL</b>      35 – 54\n` +
      `🔴 <b>SELL</b>         &lt; 35\n\n` +
      `⏱️ <b>Outcome:</b> 72h window — HIT / STOP / DRIFT\n\n` +
      `🌐 <a href="https://sosomind.vercel.app/methodology">Full Methodology →</a>`;
    const kb = new InlineKeyboard()
      .text('📊 Track Record', 'track_record:view').text('🧠 Intel', 'intel:view').row()
      .text('🏠 Menu', 'menu:main');
    await (ctx as any).editMessageText(text, { parse_mode: 'HTML', reply_markup: kb });
  });

  // ── Signal Track Record (/track_record) ─────────────────────────────────────
  const sendTrackRecord = async (ctx: Context) => {
    const loading = `📊 <b>Loading Signal Track Record…</b>`;
    if ((ctx as any).callbackQuery) {
      await (ctx as any).editMessageText(loading, { parse_mode: 'HTML' });
      await (ctx as any).answerCallbackQuery({ text: 'Loading track record…' });
    } else {
      await ctx.reply(loading, { parse_mode: 'HTML' });
    }
    try {
      const resp = await fetch(`http://localhost:${process.env.PORT || 10000}/api/signals/track-record`);
      const json = await resp.json() as any;
      const d = json.data ?? {};
      const hitRate = Number(d.hit_rate ?? 0);
      const evaluated = Number(d.evaluated_count ?? 0);
      const avgReturn = Number(d.avg_return_pct ?? 0);
      const total = Number(d.total_signals ?? 0);
      const active = Number(d.active_signals ?? 0);
      const hitPct = (hitRate * 100).toFixed(1);
      const perfIcon = hitRate >= 0.6 ? '🟢' : hitRate >= 0.4 ? '🟡' : '🔴';
      const lines = [
        `📊 <b>Signal Track Record</b>\n`,
        `${perfIcon} Hit Rate: <b>${hitPct}%</b>`,
        `✅ Evaluated: <b>${evaluated}</b> signals`,
        `📈 Avg Return: <b>${avgReturn >= 0 ? '+' : ''}${avgReturn.toFixed(2)}%</b>`,
        `📋 Total Signals: <b>${total}</b> (${active} active)\n`,
      ];
      const byDir = d.by_direction ?? {};
      if (Object.keys(byDir).length > 0) {
        lines.push(`<b>By Direction:</b>`);
        for (const [dir, stats] of Object.entries(byDir) as any) {
          const rate = stats.total > 0 ? ((stats.hits / stats.total) * 100).toFixed(0) : '0';
          lines.push(`  ${dir === 'LONG' ? '📈' : '📉'} ${dir}: ${stats.hits}/${stats.total} (${rate}% hit)`);
        }
        lines.push('');
      }
      lines.push(`<i>⛓️ Powered by SosoMind outcome evaluator · Auto-updates hourly</i>`);
      const kb = new InlineKeyboard()
        .text('🔄 Refresh', 'track_record:refresh').text('📓 View Signals', 'journal:view').row()
        .text('⬅️ Back', 'menu:main');
      const text = lines.join('\n');
      if ((ctx as any).callbackQuery) {
        await (ctx as any).editMessageText(text, { parse_mode: 'HTML', reply_markup: kb });
      } else {
        await ctx.reply(text, { parse_mode: 'HTML', reply_markup: kb });
      }
    } catch (e) {
      const errMsg = `❌ Track Record Error: ${(e as Error).message}`;
      if ((ctx as any).callbackQuery) await (ctx as any).editMessageText(errMsg, { parse_mode: 'HTML' });
      else await ctx.reply(errMsg, { parse_mode: 'HTML' });
    }
  };

  bot.command('track_record', sendTrackRecord);
  bot.callbackQuery('track_record:refresh', sendTrackRecord);
  bot.callbackQuery('track_record:view', sendTrackRecord);
  bot.hears(/\b(track record|hit rate|signal accuracy|win rate)\b/i, sendTrackRecord);

  // ── Error handler ─────────────────────────────────────────────────────────────
  bot.catch((err) => {
    console.error('grammy error', err.error, err.ctx?.update);
  });

  return bot;
}
