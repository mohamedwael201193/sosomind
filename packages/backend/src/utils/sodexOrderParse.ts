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

function parseOptionalNumber(v: unknown): number | null {
  if (v == null || v === '') return null;
  const n = typeof v === 'number' ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : null;
}

export function mapExchangeStatusToRelayStatus(exchangeStatus: string | null, ok: boolean): string {
  const s = (exchangeStatus ?? '').toUpperCase();
  if (s === 'FILLED' || s === 'PARTIAL_FILL') return 'filled';
  if (s === 'REJECTED' || s === 'FAILED') return 'rejected';
  return ok ? 'submitted' : 'rejected';
}
