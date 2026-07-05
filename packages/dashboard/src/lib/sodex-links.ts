/**
 * Parse SoDEX REST order responses and build correct proof links.
 * Reference: 02_SODEX_MASTER_REFERENCE.md §24 — spot/perps appchain state is NOT on main-scan.valuechain.xyz.
 */

export interface SodexOrderMeta {
  sodexOrderId: string | null;
  clOrdId: string | null;
  exchangeStatus: string | null;
  avgPrice: number | null;
  executedQty: number | null;
}

export function extractSodexOrderMeta(upstream: unknown): SodexOrderMeta {
  const root = upstream as Record<string, unknown> | null | undefined;
  const data = (root?.data ?? root) as Record<string, unknown> | undefined;
  const ordersRaw = data?.orders;
  const orders = Array.isArray(ordersRaw) ? ordersRaw : ordersRaw ? [ordersRaw] : [];
  const first = (orders[0] ?? data ?? {}) as Record<string, unknown>;

  const sodexOrderId =
    first.orderID != null ? String(first.orderID)
    : first.orderId != null ? String(first.orderId)
    : first.id != null ? String(first.id)
    : null;

  const clOrdId = first.clOrdID != null ? String(first.clOrdID) : first.clOrdId != null ? String(first.clOrdId) : null;
  const exchangeStatus = first.status != null ? String(first.status) : data?.status != null ? String(data.status) : null;
  const avgPrice = parseOptionalNumber(first.avgPrice ?? first.price ?? first.executedPrice);
  const executedQty = parseOptionalNumber(first.executedQty ?? first.executedQuantity);

  return { sodexOrderId, clOrdId, exchangeStatus, avgPrice, executedQty };
}

export function isFilledOrderStatus(status: string | null | undefined): boolean {
  const s = (status ?? '').toUpperCase();
  return s === 'FILLED' || s === 'PARTIAL_FILL';
}

export function isFailedOrderStatus(status: string | null | undefined, executedQty?: number | null): boolean {
  const s = (status ?? '').toUpperCase();
  if (['REJECTED', 'FAILED', 'ERROR'].includes(s)) return true;
  if (['CANCELED', 'CANCELLED', 'EXPIRED'].includes(s) && !(executedQty != null && executedQty > 0)) return true;
  return false;
}

export function isPendingOrderStatus(status: string | null | undefined): boolean {
  const s = (status ?? '').toUpperCase();
  if (!s) return true;
  return !isFilledOrderStatus(s) && !isFailedOrderStatus(s);
}

function parseOptionalNumber(v: unknown): number | null {
  if (v == null || v === '') return null;
  const n = typeof v === 'number' ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : null;
}

export function isEvmTransactionHash(value: string | null | undefined): boolean {
  return typeof value === 'string' && /^0x[0-9a-fA-F]{64}$/.test(value);
}

export interface OrderProofLinks {
  /** Internal relay audit UUID */
  auditId: string;
  sodexOrderId: string | null;
  sodexPortfolioUrl: string;
  sodexOrderHistoryUrl: string;
  /** Only populated for EVM syschain txs (deposits/withdrawals) */
  evmExplorer: { url: string; hash: string } | null;
  /** Human-readable note per official docs */
  explorerNote: string;
  pending: boolean;
}

/**
 * Spot/perps CLOB orders are not EVM transactions — link to SoDEX portfolio instead.
 * ValueChain explorer (main-scan.valuechain.xyz) applies only to 0x transaction hashes.
 */
export function buildOrderProofLinks(input: {
  auditId: string;
  sodexOrderId?: string | null;
  evmTxHash?: string | null;
  sodexAppUrl: string;
  valueChainExplorer: string;
  exchangeStatus?: string | null;
}): OrderProofLinks {
  const sodexBase = input.sodexAppUrl.replace(/\/$/, '');
  const sodexPortfolioUrl = `${sodexBase}/portfolio`;
  const sodexOrderHistoryUrl = `${sodexBase}/portfolio`;

  const evmHash = isEvmTransactionHash(input.evmTxHash) ? input.evmTxHash! : null;
  const evmExplorer = evmHash
    ? { url: `${input.valueChainExplorer.replace(/\/$/, '')}/tx/${evmHash}`, hash: evmHash }
    : null;

  const sodexOrderId = input.sodexOrderId?.trim() || null;
  const status = (input.exchangeStatus ?? '').toUpperCase();
  const pending = isPendingOrderStatus(status) && !isFilledOrderStatus(status);

  const explorerNote = evmExplorer
    ? 'EVM deposit/withdrawal — viewable on ValueChain explorer.'
    : 'Spot orders settle on the SoDEX appchain (not the ValueChain EVM explorer). View fills in SoDEX Portfolio → Order History.';

  return {
    auditId: input.auditId,
    sodexOrderId,
    sodexPortfolioUrl,
    sodexOrderHistoryUrl,
    evmExplorer,
    explorerNote,
    pending,
  };
}
