'use client';

/**
 * /trade — Non-custodial trading desk.
 *
 * Every order here is signed in the user's own MetaMask via EIP-712.
 * The backend NEVER sees a private key. Confirms by recovering the signer
 * from the signature and matching it against the SIWE-authenticated wallet.
 */
import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { fetcher } from '@/lib/api';
import { placeSpotOrder, listMyOrders, getRelayInfo } from '@/lib/sodex-client';
import { useWallet } from '@/context/WalletContext';
import { GlassCard } from '@/components/GlassCard';
import { ArrowUpRight, ArrowDownRight, Loader2, ShieldCheck, ExternalLink, RefreshCw } from 'lucide-react';

interface SodexSymbol {
  id: number;
  name: string;
  displayName: string;
  baseCoin: string;
  quoteCoin: string;
  minQuantity: string;
  pricePrecision: number;
  quantityPrecision: number;
  status: string;
  minNotional?: string;
}

interface SignedOrderRow {
  id: string;
  market: string | null;
  side: 'buy' | 'sell' | null;
  quantity: number | null;
  price: number | null;
  order_type: 'limit' | 'market' | null;
  status: string;
  source: string;
  created_at: string;
  error_message?: string | null;
  sodex_response?: any;
}

export default function TradePage() {
  const { address, token } = useWallet();
  const [side, setSide] = useState<'buy' | 'sell'>('buy');
  const [orderType, setOrderType] = useState<'limit' | 'market'>('limit');
  const [symbolId, setSymbolId] = useState<number | null>(null);
  const [quantity, setQuantity] = useState('');
  const [price, setPrice] = useState('');
  const [accountId, setAccountId] = useState<number>(0);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  const symbols = useQuery<SodexSymbol[]>({
    queryKey: ['sodex', 'spot', 'symbols'],
    queryFn: () => fetcher('/api/sodex/spot/symbols'),
  });
  const info = useQuery({ queryKey: ['sodex', 'relay', 'info'], queryFn: getRelayInfo });
  const orders = useQuery<SignedOrderRow[]>({
    queryKey: ['sodex', 'my-orders'],
    enabled: Boolean(token),
    refetchInterval: 8000,
    queryFn: async () => (await listMyOrders(50)) as SignedOrderRow[],
  });

  const activeSymbol = useMemo(
    () => (symbols.data ?? []).find((s) => s.id === symbolId) ?? null,
    [symbols.data, symbolId]
  );

  // Auto-pick first active symbol
  useEffect(() => {
    if (symbolId == null && symbols.data?.length) {
      const first = symbols.data.find((s) => /TRADING|active|open/i.test(s.status)) ?? symbols.data[0];
      if (first) setSymbolId(first.id);
    }
  }, [symbols.data, symbolId]);

  // Live orderbook for the active symbol
  const orderbook = useQuery<{ bids: any[]; asks: any[] }>({
    queryKey: ['sodex', 'spot', 'orderbook', activeSymbol?.name],
    enabled: Boolean(activeSymbol?.name),
    refetchInterval: 4000,
    queryFn: () => fetcher(`/api/sodex/spot/orderbook?market=${activeSymbol!.name}&depth=10`),
  });

  // Best bid/ask for quick quote
  const bestBid = useMemo(() => {
    const arr = orderbook.data?.bids ?? [];
    const r = arr[0];
    return Array.isArray(r) ? Number(r[0]) : Number(r?.price ?? 0);
  }, [orderbook.data]);
  const bestAsk = useMemo(() => {
    const arr = orderbook.data?.asks ?? [];
    const r = arr[0];
    return Array.isArray(r) ? Number(r[0]) : Number(r?.price ?? 0);
  }, [orderbook.data]);

  // Estimated cost for the user
  const qtyNum = Number(quantity);
  const priceNum = orderType === 'market'
    ? (side === 'buy' ? bestAsk : bestBid)
    : Number(price);
  const estCost = qtyNum && priceNum ? qtyNum * priceNum : 0;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setResult(null);
    if (!token || !address) {
      setResult({ ok: false, message: 'Connect your wallet to trade' });
      return;
    }
    if (!activeSymbol) {
      setResult({ ok: false, message: 'Pick a market' });
      return;
    }
    if (!qtyNum || qtyNum <= 0) {
      setResult({ ok: false, message: 'Enter a quantity > 0' });
      return;
    }
    if (orderType === 'limit' && (!Number(price) || Number(price) <= 0)) {
      setResult({ ok: false, message: 'Enter a limit price > 0' });
      return;
    }
    setSubmitting(true);
    try {
      const r = await placeSpotOrder({
        accountID: accountId,
        symbolID: activeSymbol.id,
        market: activeSymbol.name,
        side,
        orderType,
        quantity: qtyNum,
        price: orderType === 'limit' ? Number(price) : undefined,
      });
      if (r.ok) {
        setResult({ ok: true, message: `Submitted • ${r.orderId?.slice(0, 8) ?? ''}` });
        setQuantity(''); setPrice('');
        orders.refetch();
      } else {
        setResult({ ok: false, message: r.error || 'Order rejected by SoDEX' });
      }
    } catch (err: any) {
      setResult({ ok: false, message: err?.message || 'Signing cancelled' });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="px-4 sm:px-8 py-8 max-w-7xl mx-auto">
      <header className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Trading Desk</h1>
        <p className="text-sm text-[var(--text-muted)] mt-1 flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          Non-custodial — every order signed by your wallet via EIP-712.
          {info.data?.isTestnet && (
            <span className="ml-2 px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 text-xs font-semibold">TESTNET</span>
          )}
        </p>
      </header>

      {!address && (
        <GlassCard className="mb-6 text-amber-400">
          Connect your wallet from the sidebar to start trading.
        </GlassCard>
      )}

      <div className="grid lg:grid-cols-[1fr_1.4fr] gap-6">
        {/* ─── Order ticket ───────────────────────────────────────── */}
        <GlassCard padding="md">
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="flex gap-2">
              {(['buy', 'sell'] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSide(s)}
                  className={`flex-1 py-2.5 rounded-lg font-semibold text-sm transition-all ${
                    side === s
                      ? s === 'buy'
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                        : 'bg-red-500/20 text-red-400 border border-red-500/40'
                      : 'bg-white/5 text-[var(--text-muted)] border border-transparent hover:bg-white/10'
                  }`}
                >
                  {s === 'buy' ? <ArrowUpRight className="inline w-4 h-4 mr-1" /> : <ArrowDownRight className="inline w-4 h-4 mr-1" />}
                  {s.toUpperCase()}
                </button>
              ))}
            </div>

            <div>
              <label className="text-xs uppercase tracking-wider text-[var(--text-muted)]">Market</label>
              <select
                value={symbolId ?? ''}
                onChange={(e) => setSymbolId(Number(e.target.value))}
                className="mt-1 w-full bg-[var(--bg-elevated)] border border-[var(--border-default)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500/60"
              >
                {symbols.isLoading && <option>Loading…</option>}
                {(symbols.data ?? []).map((s) => (
                  <option key={s.id} value={s.id}>{s.displayName} ({s.name})</option>
                ))}
              </select>
            </div>

            <div className="flex gap-2">
              {(['limit', 'market'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setOrderType(t)}
                  className={`flex-1 py-1.5 rounded-md text-xs font-semibold uppercase tracking-wider ${
                    orderType === t
                      ? 'bg-blue-500/20 text-blue-400 border border-blue-500/40'
                      : 'bg-white/5 text-[var(--text-muted)] border border-transparent'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>

            {orderType === 'limit' && (
              <div>
                <label className="text-xs uppercase tracking-wider text-[var(--text-muted)]">Price</label>
                <div className="mt-1 flex items-center bg-[var(--bg-elevated)] border border-[var(--border-default)] rounded-lg overflow-hidden">
                  <input
                    type="number" step="any" min="0"
                    value={price} onChange={(e) => setPrice(e.target.value)}
                    placeholder={(side === 'buy' ? bestBid : bestAsk)?.toString() || '0.00'}
                    className="flex-1 bg-transparent px-3 py-2 text-sm focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setPrice(String(side === 'buy' ? bestAsk : bestBid))}
                    className="px-2 text-xs text-[var(--text-muted)] hover:text-blue-400"
                  >Best</button>
                  <span className="px-3 text-xs text-[var(--text-muted)]">{activeSymbol?.quoteCoin ?? 'USDC'}</span>
                </div>
              </div>
            )}

            <div>
              <label className="text-xs uppercase tracking-wider text-[var(--text-muted)]">Amount</label>
              <div className="mt-1 flex items-center bg-[var(--bg-elevated)] border border-[var(--border-default)] rounded-lg overflow-hidden">
                <input
                  type="number" step="any" min="0"
                  value={quantity} onChange={(e) => setQuantity(e.target.value)}
                  placeholder={activeSymbol?.minQuantity ?? '0.00'}
                  className="flex-1 bg-transparent px-3 py-2 text-sm focus:outline-none"
                />
                <span className="px-3 text-xs text-[var(--text-muted)]">{activeSymbol?.baseCoin ?? ''}</span>
              </div>
              {activeSymbol?.minQuantity && (
                <p className="mt-1 text-[11px] text-[var(--text-muted)]">Min: {activeSymbol.minQuantity} {activeSymbol.baseCoin}</p>
              )}
            </div>

            <div>
              <label className="text-xs uppercase tracking-wider text-[var(--text-muted)]">SoDEX account ID</label>
              <input
                type="number" min="0"
                value={accountId} onChange={(e) => setAccountId(Number(e.target.value))}
                className="mt-1 w-full bg-[var(--bg-elevated)] border border-[var(--border-default)] rounded-lg px-3 py-2 text-sm focus:outline-none"
              />
            </div>

            <div className="flex justify-between text-sm pt-2 border-t border-[var(--border-subtle)]">
              <span className="text-[var(--text-muted)]">Estimated total</span>
              <span className="font-semibold">
                {estCost ? estCost.toFixed(2) : '—'} {activeSymbol?.quoteCoin ?? 'USDC'}
              </span>
            </div>

            <button
              type="submit"
              disabled={submitting || !address}
              className={`w-full py-3 rounded-lg font-semibold text-sm transition-all ${
                side === 'buy'
                  ? 'bg-emerald-500 hover:bg-emerald-400 text-black disabled:bg-emerald-500/30 disabled:text-white/50'
                  : 'bg-red-500 hover:bg-red-400 text-black disabled:bg-red-500/30 disabled:text-white/50'
              }`}
            >
              {submitting ? (<><Loader2 className="inline w-4 h-4 mr-2 animate-spin" /> Awaiting wallet signature…</>)
                : address ? `${side === 'buy' ? 'Buy' : 'Sell'} ${activeSymbol?.baseCoin ?? ''}` : 'Connect wallet'}
            </button>

            <AnimatePresence>
              {result && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  className={`text-sm rounded-lg px-3 py-2 ${result.ok ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}
                >
                  {result.message}
                </motion.div>
              )}
            </AnimatePresence>
          </form>
        </GlassCard>

        {/* ─── Live orderbook + recent trades ─────────────────────── */}
        <div className="space-y-6">
          <GlassCard padding="md">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold">{activeSymbol?.displayName ?? 'Orderbook'}</h2>
              <button onClick={() => orderbook.refetch()} className="text-[var(--text-muted)] hover:text-blue-400">
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-x-4 text-sm">
              <div>
                <div className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] grid grid-cols-2 mb-1">
                  <span>Bid</span><span className="text-right">Size</span>
                </div>
                {(orderbook.data?.bids ?? []).slice(0, 10).map((b, i) => {
                  const p = Array.isArray(b) ? b[0] : b?.price;
                  const s = Array.isArray(b) ? b[1] : b?.size;
                  return (
                    <div key={i} className="grid grid-cols-2 text-emerald-400 text-xs font-mono py-0.5">
                      <span>{p}</span><span className="text-right text-[var(--text-secondary)]">{s}</span>
                    </div>
                  );
                })}
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] grid grid-cols-2 mb-1">
                  <span>Ask</span><span className="text-right">Size</span>
                </div>
                {(orderbook.data?.asks ?? []).slice(0, 10).map((a, i) => {
                  const p = Array.isArray(a) ? a[0] : a?.price;
                  const s = Array.isArray(a) ? a[1] : a?.size;
                  return (
                    <div key={i} className="grid grid-cols-2 text-red-400 text-xs font-mono py-0.5">
                      <span>{p}</span><span className="text-right text-[var(--text-secondary)]">{s}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </GlassCard>

          <GlassCard padding="md">
            <h2 className="font-semibold mb-3">My signed orders</h2>
            {!token && <p className="text-sm text-[var(--text-muted)]">Sign in to see your trade history.</p>}
            {token && orders.isLoading && <p className="text-sm text-[var(--text-muted)]">Loading…</p>}
            {token && !orders.isLoading && (orders.data ?? []).length === 0 && (
              <p className="text-sm text-[var(--text-muted)]">No orders yet — your first trade will appear here.</p>
            )}
            <div className="space-y-2 max-h-[420px] overflow-auto pr-1">
              {(orders.data ?? []).map((o) => (
                <div key={o.id} className="flex items-center justify-between bg-white/5 rounded-md px-3 py-2 text-sm">
                  <div>
                    <div className="font-mono text-xs text-[var(--text-muted)]">
                      {new Date(o.created_at).toLocaleString()}
                    </div>
                    <div className="font-medium">
                      <span className={o.side === 'buy' ? 'text-emerald-400' : 'text-red-400'}>{o.side?.toUpperCase()}</span>
                      {' '}{o.quantity} {o.market} {o.order_type === 'limit' ? `@ ${o.price}` : '(mkt)'}
                    </div>
                    {o.error_message && <div className="text-xs text-red-400 mt-0.5">{o.error_message}</div>}
                  </div>
                  <span className={`text-[10px] uppercase font-semibold px-2 py-1 rounded ${
                    o.status === 'submitted' ? 'bg-emerald-500/20 text-emerald-400' :
                    o.status === 'rejected'  ? 'bg-red-500/20 text-red-400' :
                    'bg-amber-500/20 text-amber-400'
                  }`}>{o.status}</span>
                </div>
              ))}
            </div>
            <div className="mt-3 pt-3 border-t border-[var(--border-subtle)] text-xs text-[var(--text-muted)] flex items-center gap-1">
              <ExternalLink className="w-3 h-3" />
              Trades on ValueChain {info.data?.isTestnet ? 'Testnet' : 'Mainnet'} (chain {info.data?.chainId})
            </div>
          </GlassCard>
        </div>
      </div>
    </div>
  );
}
