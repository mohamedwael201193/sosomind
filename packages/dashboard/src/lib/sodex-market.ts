/**
 * SoDEX market metadata helpers — all limits/fees/precision from live symbol API.
 * Reference: 02_SODEX_MASTER_REFERENCE.md §7–8, mainnet-gw.sodex.dev /markets/symbols
 */

export interface SodexSymbolMeta {
  id: number;
  name: string;
  displayName: string;
  baseCoin: string;
  quoteCoin: string;
  minQuantity?: string;
  marketMinQuantity?: string;
  minNotional?: string;
  maxNotional?: string;
  pricePrecision?: number;
  quantityPrecision?: number;
  tickSize?: string;
  stepSize?: string;
  makerFee?: string;
  takerFee?: string;
  status?: string;
}

/** SoDEX enums (matches go-sdk + production behavior). */
export const ORDER_TYPE = { LIMIT: 1, MARKET: 2 } as const;
export const TIF = { GTC: 1, FOK: 2, IOC: 3 } as const;

export function parseNum(raw: string | number | undefined | null): number {
  if (raw == null || raw === '') return 0;
  const n = typeof raw === 'number' ? raw : parseFloat(String(raw));
  return Number.isFinite(n) ? n : 0;
}

export function getMinNotional(symbol: SodexSymbolMeta | null | undefined): number {
  return parseNum(symbol?.minNotional);
}

export function getMinQuantity(symbol: SodexSymbolMeta | null | undefined, orderType: 'limit' | 'market'): number {
  if (!symbol) return 0;
  if (orderType === 'market') {
    return parseNum(symbol.marketMinQuantity) || parseNum(symbol.minQuantity);
  }
  return parseNum(symbol.minQuantity) || parseNum(symbol.marketMinQuantity);
}

export function getTickSize(symbol: SodexSymbolMeta | null | undefined): number {
  if (!symbol) return 0;
  const tick = parseNum(symbol.tickSize);
  if (tick > 0) return tick;
  const pp = symbol.pricePrecision ?? 2;
  return Math.pow(10, -pp);
}

export function getStepSize(symbol: SodexSymbolMeta | null | undefined): number {
  if (!symbol) return 0;
  const step = parseNum(symbol.stepSize);
  if (step > 0) return step;
  const qp = symbol.quantityPrecision ?? 2;
  return Math.pow(10, -qp);
}

export function formatDecimal(value: number, stepOrPrecision: number, mode: 'round' | 'floor' = 'round'): string {
  if (!Number.isFinite(value) || value <= 0) return '0';
  const step = stepOrPrecision > 0 && stepOrPrecision < 1 ? stepOrPrecision : Math.pow(10, -Math.max(0, stepOrPrecision));
  const scaled = mode === 'floor' ? Math.floor(value / step) * step : Math.round(value / step) * step;
  const decimals = step < 1 ? Math.max(0, Math.ceil(-Math.log10(step))) : 0;
  return scaled.toFixed(decimals).replace(/\.?0+$/, '') || '0';
}

export function formatPrice(value: number, symbol: SodexSymbolMeta): string {
  return formatDecimal(value, getTickSize(symbol));
}

export function formatQuantity(value: number, symbol: SodexSymbolMeta): string {
  return formatDecimal(value, getStepSize(symbol), 'floor');
}

export function feeRateForOrder(
  symbol: SodexSymbolMeta | null | undefined,
  orderType: 'limit' | 'market',
): number {
  if (!symbol) return 0;
  const maker = parseNum(symbol.makerFee);
  const taker = parseNum(symbol.takerFee);
  if (orderType === 'limit') return maker > 0 ? maker : taker;
  return taker > 0 ? taker : maker;
}

export function feePercentLabel(rate: number): string {
  if (rate <= 0) return '0%';
  return `${(rate * 100).toFixed(3).replace(/\.?0+$/, '')}%`;
}

export function getMaxSellQuantity(
  available: number,
  symbol: SodexSymbolMeta,
  orderType: 'limit' | 'market',
): number {
  if (!Number.isFinite(available) || available <= 0) return 0;
  const feeRate = feeRateForOrder(symbol, orderType);
  const afterFee = available / (1 + Math.max(0, feeRate));
  return parseFloat(formatQuantity(afterFee, symbol));
}

export function validateSpotOrder(input: {
  symbol: SodexSymbolMeta;
  orderType: 'limit' | 'market';
  quantity: number;
  price: number;
  side?: 'buy' | 'sell';
  /** Available base coin balance (required for sell validation) */
  availableBase?: number;
}): { ok: true } | { ok: false; message: string } {
  const { symbol, orderType, quantity, price, side, availableBase } = input;
  if (!quantity || quantity <= 0) return { ok: false, message: 'Enter a quantity > 0' };

  if (side === 'sell' && availableBase != null) {
    const maxSell = getMaxSellQuantity(availableBase, symbol, orderType);
    if (maxSell <= 0) {
      return { ok: false, message: `No ${symbol.displayName.split('/')[0] ?? symbol.baseCoin} available to sell` };
    }
    if (quantity > maxSell + 1e-12) {
      const coin = symbol.displayName.split('/')[0] ?? symbol.baseCoin.replace(/^v/, '');
      return {
        ok: false,
        message: `Insufficient ${coin} balance. Max sell: ${maxSell} (available ${formatQuantity(availableBase, symbol)}, fee reserved)`,
      };
    }
  }

  const minQty = getMinQuantity(symbol, orderType);
  if (minQty > 0 && quantity < minQty) {
    return {
      ok: false,
      message: `Minimum quantity is ${minQty} ${symbol.displayName.split('/')[0] ?? symbol.baseCoin}`,
    };
  }

  const notional = quantity * price;
  const minNotional = getMinNotional(symbol);
  if (minNotional > 0 && notional < minNotional) {
    return {
      ok: false,
      message: `Minimum order is $${minNotional} USDC (yours ≈ $${notional.toFixed(2)}). Increase quantity.`,
    };
  }

  return { ok: true };
}

export interface BuiltSpotOrderItem {
  symbolID: number;
  clOrdID: string;
  side: 1 | 2;
  type: 1 | 2;
  timeInForce: 1 | 2 | 3;
  price?: string;
  quantity: string;
}

/**
 * Build a spot batch order item matching official SoDEX mainnet/testnet rules.
 * Market orders always use limit + IOC with a slippage buffer (proven on bot + execution agent).
 * Pure MARKET type can leave sells stuck at SUBMITTED without filling.
 * LIMIT: GTC on mainnet, IOC on testnet.
 */
export function buildSpotOrderItem(input: {
  symbol: SodexSymbolMeta;
  isTestnet: boolean;
  orderType: 'limit' | 'market';
  side: 'buy' | 'sell';
  quantity: number;
  /** Best bid/ask or limit price */
  referencePrice: number;
  clOrdID: string;
}): BuiltSpotOrderItem {
  const sideCode: 1 | 2 = input.side === 'buy' ? 1 : 2;
  const qtyStr = formatQuantity(input.quantity, input.symbol);

  if (input.orderType === 'market') {
    const slip = input.side === 'buy' ? 1.005 : 0.995;
    const px = formatPrice(input.referencePrice * slip, input.symbol);
    return {
      symbolID: input.symbol.id,
      clOrdID: input.clOrdID,
      side: sideCode,
      type: ORDER_TYPE.LIMIT,
      timeInForce: TIF.IOC,
      price: px,
      quantity: qtyStr,
    };
  }

  return {
    symbolID: input.symbol.id,
    clOrdID: input.clOrdID,
    side: sideCode,
    type: ORDER_TYPE.LIMIT,
    timeInForce: input.isTestnet ? TIF.IOC : TIF.GTC,
    price: formatPrice(input.referencePrice, input.symbol),
    quantity: qtyStr,
  };
}

export function lowestMinNotional(symbols: SodexSymbolMeta[]): number {
  let min = Infinity;
  for (const s of symbols) {
    const n = getMinNotional(s);
    if (n > 0) min = Math.min(min, n);
  }
  return Number.isFinite(min) ? min : 0;
}
