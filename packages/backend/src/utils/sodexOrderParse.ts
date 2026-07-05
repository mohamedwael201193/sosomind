/**
 * Parse SoDEX REST order responses (shared backend/frontend logic).
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

export function extractSodexOrderError(upstream: unknown): string | null {
  const root = upstream as Record<string, unknown> | null | undefined;
  const data = (root?.data ?? root) as Record<string, unknown> | undefined;
  const ordersRaw = data?.orders;
  const orders = Array.isArray(ordersRaw) ? ordersRaw : ordersRaw ? [ordersRaw] : [];
  const first = (orders[0] ?? data ?? {}) as Record<string, unknown>;
  const msg = first.error ?? first.reason ?? first.message ?? data?.error ?? data?.message;
  return msg != null ? String(msg) : null;
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

export function mapExchangeStatusToRelayStatus(exchangeStatus: string | null, ok: boolean): string {
  const s = (exchangeStatus ?? '').toUpperCase();
  if (s === 'FILLED' || s === 'PARTIAL_FILL') return 'filled';
  if (['REJECTED', 'FAILED', 'ERROR'].includes(s)) return 'rejected';
  if (['CANCELED', 'CANCELLED', 'EXPIRED'].includes(s)) return 'rejected';
  return ok ? 'submitted' : 'rejected';
}
