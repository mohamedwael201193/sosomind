'use client';

/**
 * /trade — Non-custodial trading desk.
 *
 * ✅ Real user balance from SoDEX (not house wallet, not vUSDC label)
 * ✅ Candlestick chart via lightweight-charts
 * ✅ Live ticker stats (price, 24h change, high, low, volume)
 * ✅ % sizing buttons (25/50/75/100%)
 * ✅ Real order history from SoDEX API
 * ✅ Auto account ID (always 0 — wallet address is the identifier)
 * ✅ EIP-712 non-custodial signing (unchanged)
 */
import { useEffect, useMemo, useRef, useState, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { fetcher } from '@/lib/api';
import { placeSpotOrder, getRelayInfo } from '@/lib/sodex-client';
import { useWallet } from '@/context/WalletContext';
import { GlassCard } from '@/components/GlassCard';
import {
  ArrowUpRight, ArrowDownRight, Loader2, ShieldCheck,
  ExternalLink, RefreshCw, TrendingUp, TrendingDown, Wallet,
} from 'lucide-react';
import { CryptoIcon } from '@/components/CryptoIcon';

// ─── helpers ─────────────────────────────────────────────────────────────────

/** Strip testnet `v` prefix for display. */
function dc(coin: string): string {
  if (!coin) return '';
  if (coin === 'WSOSO') return 'SOSO';
  return coin.startsWith('v') ? coin.slice(1) : coin;
}

function fmt(n: string | number, decimals = 2): string {
  const v = Number(n);
  if (isNaN(v)) return '—';
  return v.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

// ─── types ────────────────────────────────────────────────────────────────────

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

interface Ticker {
  symbol: string;
  lastPx: string;
  openPx: string;
  highPx: string;
  lowPx: string;
  volume: string;
  quoteVolume: string;
  change: string;
  changePct: number;
}

interface Balance {
  id: number;
  coin: string;
  total: string;
  locked: string;
}

interface BalanceData {
  balances: Balance[];
  blockTime?: number;
  blockHeight?: number;
}

interface OrderRow {
  symbol: string;
  orderID: number;
  clOrdID: string;
  side: string;
  type: string;
  price: string;
  origQty: string;
  status: string;
  executedQty: string;
  executedValue: string;
  createdAt: number;
}

// ─── Candlestick chart ────────────────────────────────────────────────────────

function CandlestickChart({ klines, symbol }: { klines: any[]; symbol: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<any>(null);

  useEffect(() => {
    if (!containerRef.current || !klines.length) return;

    let cleaned = false;

    const init = async () => {
      const { createChart, ColorType, CrosshairMode, CandlestickSeries } = await import('lightweight-charts');

      if (cleaned) return;
      if (chartRef.current) {
        try { chartRef.current.remove(); } catch {}
        chartRef.current = null;
      }

      const el = containerRef.current!;
      const chart = createChart(el, {
        layout: {
          background: { type: ColorType.Solid, color: 'transparent' },
          textColor: '#7c8899',
        },
        grid: {
          vertLines: { color: 'rgba(255,255,255,0.04)' },
          horzLines: { color: 'rgba(255,255,255,0.04)' },
        },
        crosshair: { mode: CrosshairMode.Normal },
        rightPriceScale: { borderColor: 'rgba(255,255,255,0.08)' },
        timeScale: {
          borderColor: 'rgba(255,255,255,0.08)',
          timeVisible: true,
          secondsVisible: false,
        },
        handleScroll: true,
        handleScale: true,
      });

      chartRef.current = chart;

      // lightweight-charts v5 API: addSeries(SeriesType, options)
      const candleSeries = chart.addSeries(CandlestickSeries, {
        upColor: '#10b981',
        downColor: '#ef4444',
        borderUpColor: '#10b981',
        borderDownColor: '#ef4444',
        wickUpColor: '#10b981',
        wickDownColor: '#ef4444',
      });

      const data = [...klines]
        .map((k: any) => ({
          time: Math.floor(k.t / 1000) as any,
          open: parseFloat(k.o),
          high: parseFloat(k.h),
          low: parseFloat(k.l),
          close: parseFloat(k.c),
        }))
        .sort((a: any, b: any) => a.time - b.time);

      candleSeries.setData(data);
      chart.timeScale().fitContent();

      const ro = new ResizeObserver(() => {
        if (!cleaned && chart && el) {
          chart.applyOptions({ width: el.clientWidth, height: el.clientHeight });
        }
      });
      ro.observe(el);

      return () => ro.disconnect();
    };

    const cleanup = init();

    return () => {
      cleaned = true;
      cleanup?.then?.((fn: any) => fn?.());
      if (chartRef.current) {
        try { chartRef.current.remove(); } catch {}
        chartRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [klines, symbol]);

  return <div ref={containerRef} style={{ width: '100%', height: '100%' }} />;
}

// ─── page ─────────────────────────────────────────────────────────────────────

function TradeInner() {
  const { address, token } = useWallet();
  const searchParams = useSearchParams();
  const initSide = (searchParams.get('side') ?? 'buy') as 'buy' | 'sell';
  const initType = (searchParams.get('type') === 'market' ? 'market' : 'limit') as 'limit' | 'market';
  const initQty = searchParams.get('qty') ?? '';
  const initPrice = searchParams.get('price') ?? '';
  const initAsset = searchParams.get('asset') ?? '';
  const [side, setSide] = useState<'buy' | 'sell'>(initSide);
  const [orderType, setOrderType] = useState<'limit' | 'market'>(initType);
  const [symbolId, setSymbolId] = useState<number | null>(null);
  const [quantity, setQuantity] = useState(initQty);
  const [price, setPrice] = useState(initPrice);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [chartInterval, setChartInterval] = useState('1h');

  const symbols = useQuery<SodexSymbol[]>({
    queryKey: ['sodex', 'spot', 'symbols'],
    queryFn: () => fetcher('/api/sodex/spot/symbols'),
    staleTime: 60_000,
  });

  const info = useQuery({
    queryKey: ['sodex', 'relay', 'info'],
    queryFn: getRelayInfo,
    staleTime: 300_000,
  });

  const tickers = useQuery<Ticker[]>({
    queryKey: ['sodex', 'spot', 'tickers'],
    queryFn: () => fetcher('/api/sodex/spot/tickers'),
    refetchInterval: 8_000,
  });

  const activeSymbol = useMemo(
    () => (symbols.data ?? []).find((s) => s.id === symbolId) ?? null,
    [symbols.data, symbolId],
  );

  const balanceQuery = useQuery<BalanceData>({
    queryKey: ['sodex', 'user-balance', address],
    enabled: Boolean(address),
    refetchInterval: 12_000,
    queryFn: () => fetcher(`/api/sodex/user/${address}/balances`),
  });

  const orderHistory = useQuery<OrderRow[]>({
    queryKey: ['sodex', 'user-orders-history', address],
    enabled: Boolean(address),
    refetchInterval: 10_000,
    queryFn: () => fetcher(`/api/sodex/user/${address}/orders/history?limit=30`),
  });

  const orderbook = useQuery<{ bids: any[]; asks: any[] }>({
    queryKey: ['sodex', 'spot', 'orderbook', activeSymbol?.name],
    enabled: Boolean(activeSymbol?.name),
    refetchInterval: 3_000,
    queryFn: () => fetcher(`/api/sodex/spot/orderbook?market=${activeSymbol!.name}&depth=12`),
  });

  const klines = useQuery<any[]>({
    queryKey: ['sodex', 'spot', 'klines', activeSymbol?.name, chartInterval],
    enabled: Boolean(activeSymbol?.name),
    refetchInterval: 60_000,
    queryFn: () => fetcher(
      `/api/sodex/spot/klines?market=${activeSymbol!.name}&interval=${chartInterval}&limit=200`,
    ),
  });

  const activeTicker = useMemo(
    () => (tickers.data ?? []).find((t) => t.symbol === activeSymbol?.name) ?? null,
    [tickers.data, activeSymbol],
  );

  const bestBid = useMemo(() => {
    const r = (orderbook.data?.bids ?? [])[0];
    return r ? Number(Array.isArray(r) ? r[0] : r?.price) : 0;
  }, [orderbook.data]);

  const bestAsk = useMemo(() => {
    const r = (orderbook.data?.asks ?? [])[0];
    return r ? Number(Array.isArray(r) ? r[0] : r?.price) : 0;
  }, [orderbook.data]);

  const usdcBalance = useMemo(() => {
    const coin = (balanceQuery.data?.balances ?? []).find((b) => b.coin === 'vUSDC');
    if (!coin) return 0;
    return Math.max(0, parseFloat(coin.total) - parseFloat(coin.locked));
  }, [balanceQuery.data]);

  const baseCoinBalance = useMemo(() => {
    if (!activeSymbol) return 0;
    const coin = (balanceQuery.data?.balances ?? []).find((b) => b.coin === activeSymbol.baseCoin);
    if (!coin) return 0;
    return Math.max(0, parseFloat(coin.total) - parseFloat(coin.locked));
  }, [balanceQuery.data, activeSymbol]);

  const qtyNum = Number(quantity);
  const priceNum = orderType === 'market'
    ? (side === 'buy' ? bestAsk : bestBid)
    : Number(price);
  const estCost = qtyNum && priceNum ? qtyNum * priceNum : 0;
  const changePct = activeTicker?.changePct ?? 0;
  const isPositive = changePct >= 0;

  useEffect(() => {
    if (symbolId == null && symbols.data?.length) {
      // Pre-select asset from NLP query param (e.g. asset=ETH → vETH_vUSDC)
      const fromParam = initAsset
        ? symbols.data.find((s) => s.baseCoin === `v${initAsset}` || s.baseCoin === initAsset || s.name.startsWith(`v${initAsset}_`) || s.name.startsWith(`${initAsset}_`))
        : null;
      const eth = symbols.data.find((s) => s.name === 'vETH_vUSDC');
      const btc = symbols.data.find((s) => s.name === 'vBTC_vUSDC');
      const first = fromParam ?? eth ?? btc ?? symbols.data.find((s) => /TRADING/i.test(s.status)) ?? symbols.data[0];
      if (first) setSymbolId(first.id);
    }
  }, [symbols.data, symbolId, initAsset]);

  const handlePct = useCallback(
    (pct: number) => {
      if (!activeSymbol) return;
      const effectivePrice = priceNum || (side === 'buy' ? bestAsk : bestBid);
      if (side === 'buy' && effectivePrice > 0) {
        const qty = (usdcBalance * pct) / effectivePrice;
        setQuantity(qty.toFixed(activeSymbol.quantityPrecision));
      } else if (side === 'sell') {
        const qty = baseCoinBalance * pct;
        setQuantity(qty.toFixed(activeSymbol.quantityPrecision));
      }
    },
    [activeSymbol, priceNum, usdcBalance, baseCoinBalance, bestAsk, bestBid, side],
  );

  const setBestPrice = useCallback(() => {
    setPrice(String(side === 'buy' ? bestAsk : bestBid));
  }, [side, bestAsk, bestBid]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setResult(null);
    if (!token || !address) { setResult({ ok: false, message: 'Connect your wallet to trade' }); return; }
    if (!activeSymbol) { setResult({ ok: false, message: 'Select a market' }); return; }
    if (!qtyNum || qtyNum <= 0) { setResult({ ok: false, message: 'Enter a quantity > 0' }); return; }
    if (orderType === 'limit' && (!Number(price) || Number(price) <= 0)) {
      setResult({ ok: false, message: 'Enter a limit price > 0' });
      return;
    }
    setSubmitting(true);
    try {
      const r = await placeSpotOrder({
        accountID: 0,
        symbolID: activeSymbol.id,
        market: activeSymbol.name,
        side,
        orderType,
        quantity: qtyNum,
        price: orderType === 'limit' ? Number(price) : undefined,
      });
      if (r.ok) {
        setResult({ ok: true, message: `Submitted — order ID: ${r.orderId ?? 'pending'}` });
        setQuantity('');
        setPrice('');
        orderHistory.refetch();
        balanceQuery.refetch();
      } else {
        setResult({ ok: false, message: r.error || 'Order rejected by SoDEX' });
      }
    } catch (err: any) {
      setResult({ ok: false, message: err?.message || 'Signing cancelled or rejected' });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="px-4 sm:px-6 py-6 max-w-[1440px] mx-auto space-y-4">

      {/* Top bar */}
      <div className="flex flex-wrap gap-4 items-start justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            {activeSymbol && (
              <CryptoIcon symbol={activeSymbol.baseCoin} size={28} />
            )}
            <select
              value={symbolId ?? ''}
              onChange={(e) => { setSymbolId(Number(e.target.value)); setQuantity(''); setPrice(''); }}
              className="bg-[var(--bg-elevated)] border border-[var(--border-default)] rounded-lg px-3 py-2 text-sm font-semibold focus:outline-none focus:border-emerald-500/60 min-w-[140px]"
            >
              {symbols.isLoading && <option>Loading…</option>}
              {(symbols.data ?? []).map((s) => (
                <option key={s.id} value={s.id}>{s.displayName}</option>
              ))}
            </select>
          </div>

          <div>
            <div className="text-2xl font-bold font-mono tabular-nums leading-tight">
              {activeTicker ? fmt(activeTicker.lastPx, activeSymbol?.pricePrecision ?? 2) : '—'}{' '}
              <span className="text-sm text-[var(--text-muted)] font-normal">USDC</span>
            </div>
            <div className={`text-sm font-semibold flex items-center gap-1 ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
              {isPositive ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
              {isPositive ? '+' : ''}{changePct.toFixed(2)}% (24h)
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-5 text-sm items-center">
          <div>
            <div className="text-[var(--text-muted)] text-[10px] uppercase tracking-wider">24h High</div>
            <div className="font-mono font-semibold text-emerald-400">{activeTicker ? fmt(activeTicker.highPx, 2) : '—'}</div>
          </div>
          <div>
            <div className="text-[var(--text-muted)] text-[10px] uppercase tracking-wider">24h Low</div>
            <div className="font-mono font-semibold text-red-400">{activeTicker ? fmt(activeTicker.lowPx, 2) : '—'}</div>
          </div>
          <div>
            <div className="text-[var(--text-muted)] text-[10px] uppercase tracking-wider">Volume (USDC)</div>
            <div className="font-mono font-semibold">{activeTicker ? fmt(activeTicker.quoteVolume, 0) : '—'}</div>
          </div>
          <div className="flex items-center gap-2 ml-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            {info.data?.isTestnet && (
              <span className="px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 text-xs font-semibold">TESTNET</span>
            )}
          </div>
        </div>
      </div>

      {/* Main grid */}
      <div className="grid lg:grid-cols-[1fr_320px] gap-4">

        {/* Left: chart + orderbook + history */}
        <div className="space-y-4">

          {/* Chart */}
          <GlassCard padding="sm">
            <div className="flex items-center justify-between mb-2 px-2 pt-1">
              <div className="flex gap-1">
                {['5m', '15m', '1h', '4h', '1d'].map((iv) => (
                  <button
                    key={iv}
                    onClick={() => setChartInterval(iv)}
                    className={`px-2.5 py-1 text-xs rounded font-medium transition-colors ${
                      chartInterval === iv
                        ? 'bg-emerald-500/20 text-emerald-400'
                        : 'text-[var(--text-muted)] hover:text-white'
                    }`}
                  >
                    {iv}
                  </button>
                ))}
              </div>
              <button onClick={() => klines.refetch()} className="text-[var(--text-muted)] hover:text-blue-400 p-1">
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>
            <div style={{ height: '320px' }}>
              {klines.isLoading ? (
                <div className="flex items-center justify-center h-full text-[var(--text-muted)] text-sm gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" /> Loading chart…
                </div>
              ) : klines.data && klines.data.length > 0 ? (
                <CandlestickChart klines={klines.data} symbol={activeSymbol?.name ?? ''} />
              ) : (
                <div className="flex items-center justify-center h-full text-[var(--text-muted)] text-sm">No chart data available</div>
              )}
            </div>
          </GlassCard>

          {/* Orderbook */}
          <GlassCard padding="md">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold">Order Book — {activeSymbol?.displayName ?? '…'}</h2>
              <div className="flex items-center gap-3">
                {bestAsk && bestBid ? (
                  <span className="text-xs font-mono text-[var(--text-muted)]">
                    Spread {(bestAsk - bestBid).toFixed(activeSymbol?.pricePrecision ?? 2)}
                  </span>
                ) : null}
                <button onClick={() => orderbook.refetch()} className="text-[var(--text-muted)] hover:text-blue-400">
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-x-4 text-sm">
              <div>
                <div className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] grid grid-cols-2 mb-1 pb-1 border-b border-[var(--border-subtle)]">
                  <span>Ask Price</span><span className="text-right">Size</span>
                </div>
                {[...(orderbook.data?.asks ?? [])].slice(0, 12).reverse().map((a, i) => {
                  const p = Array.isArray(a) ? a[0] : a?.price;
                  const s = Array.isArray(a) ? a[1] : a?.size;
                  return (
                    <div
                      key={i}
                      title="Click to set buy price"
                      className="grid grid-cols-2 text-xs font-mono py-0.5 cursor-pointer hover:bg-red-500/5 rounded"
                      onClick={() => { setPrice(String(p)); setSide('buy'); }}
                    >
                      <span className="text-red-400">{p}</span>
                      <span className="text-right text-[var(--text-secondary)]">{s}</span>
                    </div>
                  );
                })}
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] grid grid-cols-2 mb-1 pb-1 border-b border-[var(--border-subtle)]">
                  <span>Bid Price</span><span className="text-right">Size</span>
                </div>
                {(orderbook.data?.bids ?? []).slice(0, 12).map((b, i) => {
                  const p = Array.isArray(b) ? b[0] : b?.price;
                  const s = Array.isArray(b) ? b[1] : b?.size;
                  return (
                    <div
                      key={i}
                      title="Click to set sell price"
                      className="grid grid-cols-2 text-xs font-mono py-0.5 cursor-pointer hover:bg-emerald-500/5 rounded"
                      onClick={() => { setPrice(String(p)); setSide('sell'); }}
                    >
                      <span className="text-emerald-400">{p}</span>
                      <span className="text-right text-[var(--text-secondary)]">{s}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {bestAsk > 0 && bestBid > 0 && (
              <div className="mt-3 pt-2 border-t border-[var(--border-subtle)] text-center">
                <span className={`text-sm font-bold font-mono ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
                  {((bestAsk + bestBid) / 2).toFixed(activeSymbol?.pricePrecision ?? 2)} USDC
                </span>
                <span className="text-[var(--text-muted)] text-xs ml-2">mid</span>
              </div>
            )}
          </GlassCard>

          {/* Order history */}
          {address && (
            <GlassCard padding="md">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold">My Order History</h2>
                <button onClick={() => orderHistory.refetch()} className="text-[var(--text-muted)] hover:text-blue-400">
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              </div>

              {orderHistory.isLoading ? (
                <div className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading…
                </div>
              ) : (orderHistory.data ?? []).length === 0 ? (
                <p className="text-sm text-[var(--text-muted)]">No orders yet — your trades will appear here.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs min-w-[500px]">
                    <thead>
                      <tr className="text-[var(--text-muted)] border-b border-[var(--border-subtle)]">
                        <th className="py-1.5 text-left font-medium">Time</th>
                        <th className="py-1.5 text-left font-medium">Market</th>
                        <th className="py-1.5 text-left font-medium">Side</th>
                        <th className="py-1.5 text-left font-medium">Type</th>
                        <th className="py-1.5 text-right font-medium">Price</th>
                        <th className="py-1.5 text-right font-medium">Amount</th>
                        <th className="py-1.5 text-right font-medium">Filled</th>
                        <th className="py-1.5 text-right font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(orderHistory.data ?? []).map((o) => {
                        const sym = (symbols.data ?? []).find((s) => s.name === o.symbol);
                        const dispName = sym?.displayName
                          ?? o.symbol.replace(/_vUSDC$/, '/USDC').replace(/^v/, '');
                        return (
                          <tr key={o.orderID} className="border-b border-[var(--border-subtle)] hover:bg-white/3 transition-colors">
                            <td className="py-1.5 font-mono text-[var(--text-muted)]">
                              {new Date(o.createdAt).toLocaleTimeString()}
                            </td>
                            <td className="py-1.5">{dispName}</td>
                            <td className={`py-1.5 font-bold ${o.side === 'BUY' ? 'text-emerald-400' : 'text-red-400'}`}>
                              {o.side}
                            </td>
                            <td className="py-1.5 text-[var(--text-muted)]">{o.type}</td>
                            <td className="py-1.5 text-right font-mono">{o.price}</td>
                            <td className="py-1.5 text-right font-mono">{o.origQty}</td>
                            <td className="py-1.5 text-right font-mono">{o.executedQty || '0'}</td>
                            <td className="py-1.5 text-right">
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                                o.status === 'FILLED'      ? 'bg-emerald-500/20 text-emerald-400' :
                                o.status === 'CANCELED'    ? 'bg-red-500/15 text-red-400' :
                                o.status === 'PARTIAL_FILL'? 'bg-blue-500/15 text-blue-400' :
                                                             'bg-amber-500/15 text-amber-400'
                              }`}>{o.status}</span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="mt-2 text-[10px] text-[var(--text-muted)] flex items-center gap-1">
                <ExternalLink className="w-3 h-3" />
                Live from SoDEX {info.data?.isTestnet ? 'Testnet' : 'Mainnet'} · chain {info.data?.chainId}
              </div>
            </GlassCard>
          )}
        </div>

        {/* Right: balance + order ticket */}
        <div className="space-y-3">

          {/* Balance card */}
          <GlassCard padding="md">
            <div className="flex items-center gap-2 mb-3">
              <Wallet className="w-4 h-4 text-[var(--text-muted)]" />
              <span className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                Wallet Balance
              </span>
              <button
                onClick={() => balanceQuery.refetch()}
                className="ml-auto text-[var(--text-muted)] hover:text-blue-400"
              >
                <RefreshCw className="w-3 h-3" />
              </button>
            </div>

            {!address ? (
              <p className="text-xs text-amber-400">Connect wallet to see balance</p>
            ) : balanceQuery.isLoading ? (
              <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
                <Loader2 className="w-3 h-3 animate-spin" /> Loading balance…
              </div>
            ) : (
              <div className="space-y-2">
                {(balanceQuery.data?.balances ?? []).map((b) => {
                  const avail = Math.max(0, parseFloat(b.total) - parseFloat(b.locked));
                  return (
                    <div key={b.coin} className="flex items-center justify-between">
                      <span className="text-[var(--text-muted)] text-sm font-mono">{dc(b.coin)}</span>
                      <div className="text-right">
                        <div className="font-semibold font-mono text-sm">
                          {fmt(avail, b.coin === 'vUSDC' ? 2 : 6)}
                        </div>
                        {parseFloat(b.locked) > 0 && (
                          <div className="text-[10px] text-amber-400/70">{fmt(b.locked, 4)} locked</div>
                        )}
                      </div>
                    </div>
                  );
                })}
                {(balanceQuery.data?.balances ?? []).length === 0 && (
                  <p className="text-xs text-[var(--text-muted)]">
                    No balance found. Get testnet USDC from the SoDEX faucet.
                  </p>
                )}
              </div>
            )}
          </GlassCard>

          {/* Order form */}
          <GlassCard padding="md">
            <form onSubmit={onSubmit} className="space-y-3">

              <div className="flex gap-2">
                {(['buy', 'sell'] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => { setSide(s); setQuantity(''); }}
                    className={`flex-1 py-2.5 rounded-lg font-bold text-sm transition-all ${
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

              <div className="flex gap-2">
                {(['limit', 'market'] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setOrderType(t)}
                    className={`flex-1 py-1.5 rounded-md text-xs font-semibold uppercase tracking-wider transition-colors ${
                      orderType === t
                        ? 'bg-blue-500/20 text-blue-400 border border-blue-500/40'
                        : 'bg-white/5 text-[var(--text-muted)] border border-transparent hover:bg-white/10'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>

              {address && (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[var(--text-muted)]">Available</span>
                  <span className="font-mono font-semibold">
                    {side === 'buy'
                      ? `${fmt(usdcBalance, 2)} USDC`
                      : `${fmt(baseCoinBalance, 6)} ${dc(activeSymbol?.baseCoin ?? '')}`}
                  </span>
                </div>
              )}

              {orderType === 'limit' && (
                <div>
                  <label className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">Price (USDC)</label>
                  <div className="mt-1 flex items-center bg-[var(--bg-elevated)] border border-[var(--border-default)] rounded-lg overflow-hidden focus-within:border-blue-500/60 transition-colors">
                    <input
                      type="number" step="any" min="0"
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                      placeholder={String(side === 'buy' ? (bestAsk || '') : (bestBid || '')) || '0.00'}
                      className="flex-1 bg-transparent px-3 py-2 text-sm focus:outline-none min-w-0"
                    />
                    <button
                      type="button" onClick={setBestPrice}
                      className="px-2.5 py-2 text-xs text-blue-400 hover:text-blue-300 border-l border-[var(--border-default)] shrink-0"
                    >
                      Best
                    </button>
                  </div>
                </div>
              )}

              <div>
                <label className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">
                  Amount ({dc(activeSymbol?.baseCoin ?? '')})
                </label>
                <div className="mt-1 flex items-center bg-[var(--bg-elevated)] border border-[var(--border-default)] rounded-lg overflow-hidden focus-within:border-blue-500/60 transition-colors">
                  <input
                    type="number" step="any" min="0"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    placeholder={activeSymbol?.minQuantity ?? '0.00'}
                    className="flex-1 bg-transparent px-3 py-2 text-sm focus:outline-none min-w-0"
                  />
                </div>
                {address && (
                  <div className="flex gap-1 mt-1.5">
                    {[0.25, 0.5, 0.75, 1].map((pct) => (
                      <button
                        key={pct} type="button" onClick={() => handlePct(pct)}
                        className="flex-1 py-1 text-[10px] font-semibold rounded bg-white/5 text-[var(--text-muted)] hover:bg-blue-500/15 hover:text-blue-400 transition-colors"
                      >
                        {pct * 100}%
                      </button>
                    ))}
                  </div>
                )}
                {activeSymbol?.minNotional && (
                  <p className="mt-1 text-[10px] text-[var(--text-muted)]">Min notional: {activeSymbol.minNotional} USDC</p>
                )}
              </div>

              <div className="space-y-1 pt-2 border-t border-[var(--border-subtle)]">
                <div className="flex justify-between text-sm">
                  <span className="text-[var(--text-muted)] text-xs">Est. total</span>
                  <span className="font-semibold font-mono">{estCost ? `${fmt(estCost, 2)} USDC` : '—'}</span>
                </div>
                {estCost > 0 && (
                  <div className="flex justify-between text-xs text-[var(--text-muted)]">
                    <span>Fee ({orderType === 'limit' ? '0.035%' : '0.065%'})</span>
                    <span className="font-mono">{fmt(estCost * (orderType === 'limit' ? 0.00035 : 0.00065), 4)} USDC</span>
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={submitting || !address}
                className={`w-full py-3 rounded-lg font-bold text-sm transition-all ${
                  side === 'buy'
                    ? 'bg-emerald-500 hover:bg-emerald-400 text-black disabled:bg-emerald-500/30 disabled:text-white/50'
                    : 'bg-red-500 hover:bg-red-400 text-black disabled:bg-red-500/30 disabled:text-white/50'
                }`}
              >
                {submitting
                  ? <><Loader2 className="inline w-4 h-4 mr-2 animate-spin" />Awaiting signature…</>
                  : address
                    ? `${side === 'buy' ? 'Buy' : 'Sell'} ${dc(activeSymbol?.baseCoin ?? '')}`
                    : 'Connect wallet to trade'}
              </button>

              <AnimatePresence>
                {result && (
                  <motion.div
                    initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                    className={`text-sm rounded-lg px-3 py-2 ${result.ok ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}
                  >
                    {result.message}
                  </motion.div>
                )}
              </AnimatePresence>

              <p className="text-[10px] text-[var(--text-muted)] text-center leading-relaxed">
                Signed by your wallet via EIP-712.<br />Your keys never leave your device.
              </p>
            </form>
          </GlassCard>
        </div>
      </div>
    </div>
  );
}

export default function TradePage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-64 text-[var(--text-muted)]"><Loader2 className="w-6 h-6 animate-spin" /></div>}>
      <TradeInner />
    </Suspense>
  );
}
