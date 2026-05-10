import { sodex } from '../clients/sodex';
import { sosovalue } from '../clients/sosovalue';
import { getSpotPrice } from '../clients/market';
import { supabase, logAgent } from '../db/supabase';
import { runRiskAgent } from './risk';
import { calculateKellySizing, calcTradeStats } from '../utils/kelly';
import { checkMevRisk } from '../utils/mev';
import type { ResearchSignal } from './research';

export interface ExecutionParams {
  userId?: string;
  signal?: Partial<ResearchSignal> & { id?: string };
  market: string;          // e.g. "BTC-USDC"
  side: 'buy' | 'sell';
  amount: number;
  price?: number;          // omit for market order
  orderType?: 'limit' | 'market';
}

export async function runExecutionAgent(params: ExecutionParams) {
  const startedAt = Date.now();
  const { userId, market, side, amount } = params;
  const orderType = params.orderType ?? (params.price ? 'limit' : 'market');

  // Extract base asset from SoDEX format: "vBTC_vUSDC" → "BTC", also handles "BTC-USDC" → "BTC"
  const rawAsset = market.includes('_') ? market.split('_')[0] : market.split('-')[0];
  const baseAsset = rawAsset.replace(/^v/i, '').toUpperCase();

  let priceUsed = params.price;
  if (!priceUsed) {
    // 1. Try SoDEX orderbook — bids/asks are arrays [price, size], not objects
    try {
      const ob: any = await sodex.getSpotOrderbook(market, 1);
      // Handle both array format ["81572","0.034"] and object format {price:"81572",size:"0.034"}
      const asks: any[] = ob?.asks || ob?.data?.asks || [];
      const bids: any[] = ob?.bids || ob?.data?.bids || [];
      const ask = Array.isArray(asks[0]) ? asks[0][0] : asks[0]?.price;
      const bid = Array.isArray(bids[0]) ? bids[0][0] : bids[0]?.price;
      const raw = side === 'buy' ? Number(ask ?? 0) : Number(bid ?? 0);
      if (raw > 0) priceUsed = raw;
    } catch { /* ignore */ }
  }
  if (!priceUsed) {
    // 2. Fall back to SoSoValue market snapshot
    try {
      const snap: any = await sosovalue.getMarketSnapshot(baseAsset);
      priceUsed = Number(snap?.price ?? snap?.data?.price ?? snap?.lastPrice ?? 0) || undefined;
    } catch { /* ignore */ }
  }
  if (!priceUsed) {
    // 3. Fall back to Binance spot price (free, no API key needed)
    try {
      const p = await getSpotPrice(baseAsset);
      if (p && p > 0) priceUsed = p;
    } catch { /* ignore */ }
  }


  const risk = await runRiskAgent({
    userId,
    asset: baseAsset,
    side,
    amount,
    price: priceUsed || 0,
  });

  if (risk.verdict === 'REJECTED' || risk.verdict === 'HALT') {
    await logAgent({ agent: 'execution', action: 'execution:rejected', level: 'warn', output: { risk }, user_id: userId, duration_ms: Date.now() - startedAt });
    return { status: 'rejected', risk, trade: null };
  }

  let finalAmount = risk.adjustedAmount ?? amount;

  // ── Kelly Criterion sizing (if userId provided) ──────────────────────────
  let kellySizing: ReturnType<typeof calculateKellySizing> | null = null;
  if (userId && priceUsed) {
    try {
      const { data: trades } = await supabase.from('trades')
        .select('pnl_pct').eq('user_id', userId).eq('status', 'closed').limit(50);
      const stats = calcTradeStats(trades ?? []);
      const portfolioValueEst = finalAmount * (priceUsed || 1) * 10; // rough estimate
      kellySizing = calculateKellySizing({
        winRate: stats.winRate,
        avgWinPct: stats.avgWinPct,
        avgLossPct: stats.avgLossPct,
        portfolioValue: portfolioValueEst,
        confidence: params.signal?.confidence ?? 70,
      });
      // If Kelly recommends smaller position, respect it
      if (kellySizing.positionPct > 0) {
        const kellyAmount = (portfolioValueEst * kellySizing.adjustedFraction) / (priceUsed || 1);
        if (kellyAmount < finalAmount) {
          finalAmount = kellyAmount;
          console.log(`[execution] Kelly sizing: ${finalAmount.toFixed(6)} (${kellySizing.positionPct.toFixed(1)}%)`);
        }
      }
    } catch { /* ignore */ }
  }

  // ── MEV protection check ─────────────────────────────────────────────────
  let mevRisk: Awaited<ReturnType<typeof checkMevRisk>> | null = null;
  try {
    const sodexMarket = market.includes('_') ? market : `v${baseAsset}_vUSDC`;
    const orderValueUsd = finalAmount * (priceUsed || 0);
    mevRisk = await checkMevRisk(sodexMarket, side, orderValueUsd);
    if (mevRisk.risk_level === 'high') {
      console.warn(`[execution] High MEV risk detected for ${market}:`, mevRisk.warnings);
      // Still proceed but log the warning
    }
  } catch { /* ignore */ }

  let tradeId: string | undefined;
  try {
    const { data } = await supabase
      .from('trades')
      .insert({
        user_id: userId ?? null,
        signal_id: params.signal?.id ?? null,
        market, side,
        price: priceUsed || 0,
        amount: finalAmount,
        total: (priceUsed || 0) * finalAmount,
        order_type: orderType,
        status: 'pending',
        confirmed_by: 'system',
      })
      .select('id').single();
    tradeId = data?.id;
  } catch (e) {
    console.warn('trade insert failed', (e as Error).message);
  }

  // Live signed submit
  try {
    // Resolve real SoDEX market from the exact market name or asset-based fallback.
    // Priority: exact name lookup (e.g. "vBTC_vUSDC" → id=1) → asset-based (e.g. "BTC" → vBTC_vUSDC).
    // Also retrieves pricePrecision and quantityPrecision for proper price/qty formatting.
    let symbolMeta: Awaited<ReturnType<typeof sodex.getSymbolMeta>>;
    try {
      symbolMeta = await sodex.getSymbolMeta(market, 'spot');
    } catch {
      // market string is not a valid symbol name — try asset-based lookup
      symbolMeta = await sodex.findMarketForAsset(baseAsset);
    }
    const resolvedName = symbolMeta.name;
    const symbolID = symbolMeta.id;
    const pricePrecision = symbolMeta.pricePrecision ?? 0;
    const quantityPrecision = symbolMeta.quantityPrecision ?? 5;

    // Auto-resolve accountID (0 is accepted on SoDEX testnet — identified by EIP-712 signature)
    const accountID = await sodex.resolveAccountID();
    const minQty = Number(symbolMeta.marketMinQuantity ?? '0');
    const minNotional = Number(symbolMeta.minNotional ?? '0');
    // Align quantity to allowed precision (e.g. quantityPrecision=5 → max 5 decimal places)
    const qtyMultiplier = Math.pow(10, quantityPrecision);
    let safeAmount = Math.max(
      Math.round(finalAmount * qtyMultiplier) / qtyMultiplier,
      minQty || finalAmount,
    );
    // Always use limit IOC orders: avoids "MissingOraclePrice" on testnet,
    // behaves like a market order (fill immediately or cancel).
    // Price buffer: BUY 0.5% above, SELL 0.5% below to be aggressive taker.
    // Price MUST be rounded to pricePrecision decimal places (e.g. pricePrecision=0 → integer).
    const priceMultiplier = Math.pow(10, pricePrecision);
    const rawLimit = priceUsed && priceUsed > 0
      ? (side === 'buy' ? priceUsed * 1.005 : priceUsed * 0.995)
      : 0;
    const limitPrice = rawLimit > 0 ? Math.round(rawLimit * priceMultiplier) / priceMultiplier : 0;
    if (!limitPrice || limitPrice <= 0) throw new Error(`Cannot determine price for ${baseAsset} — set PRICE in request or ensure market data is available`);
    // Enforce minimum notional: bump qty up if qty*price < minNotional (e.g. $5 USDC on most SoDEX markets)
    if (minNotional > 0 && safeAmount * limitPrice < minNotional) {
      const minQtyForNotional = Math.ceil((minNotional / limitPrice) * qtyMultiplier) / qtyMultiplier;
      console.log(`[execution] bumping qty ${safeAmount} → ${minQtyForNotional} to meet minNotional $${minNotional}`);
      safeAmount = minQtyForNotional;
    }
    // Format price and quantity as strings with correct decimal places; strip trailing zeros
    // (SoDEX rejects decimal strings with trailing zeros, e.g. "0.01000" → must be "0.01")
    const priceStr = limitPrice.toFixed(pricePrecision).replace(/\.?0+$/, '');
    const qtyStr = safeAmount.toFixed(quantityPrecision).replace(/\.?0+$/, '');
    console.log(`[execution] placing order market=${resolvedName} symbolID=${symbolID} accountID=${accountID} side=${side} qty=${qtyStr} limitPrice=${priceStr} pricePrecision=${pricePrecision}`);
    const order = await sodex.placeSpotOrder({
      accountID,
      symbolID,
      clOrdID: `som${Date.now()}`,
      side: side === 'buy' ? 1 : 2,
      type: 1,           // 1=limit (always; market orders fail with MissingOraclePrice on testnet)
      timeInForce: 3,    // 3=IOC: fill immediately or cancel (market-like behavior)
      price: priceStr,
      quantity: qtyStr,
    });

    if (tradeId) {
      await supabase.from('trades').update({
        status: order?.status || 'submitted',
        sodex_order_id: order?.orderId || order?.orders?.[0]?.orderID || null,
        tx_hash: order?.txHash || null,
        executed_at: new Date().toISOString(),
      }).eq('id', tradeId);
    }
    await logAgent({ agent: 'execution', action: 'execution:submitted', output: order, user_id: userId, duration_ms: Date.now() - startedAt });
    return { status: 'submitted', risk, kellySizing, mevRisk, trade: { id: tradeId, ...order } };
  } catch (e) {
    if (tradeId) await supabase.from('trades').update({ status: 'failed' }).eq('id', tradeId);
    await logAgent({ agent: 'execution', action: 'execution:failed', level: 'error', error: (e as Error).message, user_id: userId, duration_ms: Date.now() - startedAt });
    return { status: 'failed', risk, trade: null, error: (e as Error).message };
  }
}
