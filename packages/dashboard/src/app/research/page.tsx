"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { api, fetcher } from "@/lib/api";
import { GlassCard } from "@/components/GlassCard";
import LightweightCandlestickChart, { CandlePoint } from "@/components/LightweightCandlestickChart";
import { TrendingUp, TrendingDown, Search, Zap, BarChart2, BookOpen, Activity, MessageSquare, Target, Wallet, Clock } from "lucide-react";
import { fetchWithMeta } from "@/lib/api";
import { AgentCycle } from "@/components/AgentCycle";
import { cn } from "@/lib/utils";

const ASSETS = ["BTC", "ETH", "SOL", "BNB", "AVAX", "ARB", "OP", "SUI"];
const INTERVALS = ["1m", "5m", "15m", "1h", "4h", "1d"];

function normalizeKlines(raw: unknown[]): CandlePoint[] {
  if (!raw?.length) return [];
  return raw
    .map((k: unknown) => {
      const arr = Array.isArray(k) ? k : null;
      const obj = !arr && k && typeof k === "object" ? (k as Record<string, unknown>) : null;
      const tsMs = arr ? Number(arr[0]) : Number(obj?.openTime ?? obj?.timestamp ?? 0);
      return {
        time: tsMs ? Math.floor(tsMs / 1000) : 0,
        open: arr ? Number(arr[1]) : Number(obj?.open ?? 0),
        high: arr ? Number(arr[2]) : Number(obj?.high ?? 0),
        low: arr ? Number(arr[3]) : Number(obj?.low ?? 0),
        close: arr ? Number(arr[4]) : Number(obj?.close ?? 0),
        volume: arr ? Number(arr[5]) : Number(obj?.volume ?? 0),
      };
    })
    .filter((k) => k.time > 0 && k.high >= k.low);
}

export default function ResearchPage() {
  const [asset, setAsset] = useState("BTC");
  const [interval, setInterval] = useState("1h");
  const [tab, setTab] = useState<"chart" | "signals" | "orderbook" | "confluence" | "sentiment" | "my-edge">("chart");
  const [walletInput, setWalletInput] = useState("");
  const [walletAddress, setWalletAddress] = useState("");
  const [showAgentCycle, setShowAgentCycle] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);

  const klines = useQuery({
    queryKey: ["klines", asset, interval],
    queryFn: () => fetcher(`/api/market/klines/${asset}?interval=${interval}&limit=80`),
    refetchInterval: 60000,
  });

  const signals = useQuery({
    queryKey: ["signals-asset", asset],
    queryFn: () => fetcher(`/api/signals?asset=${asset}&limit=10`),
    refetchInterval: 30000,
    enabled: tab === "signals",
  });

  const orderbook = useQuery({
    queryKey: ["orderbook", asset],
    queryFn: () => fetcher(`/api/market/orderbook/v${asset}_vUSDC?depth=15`),
    refetchInterval: 10000,
    enabled: tab === "orderbook",
  });

  const confluence = useQuery({
    queryKey: ["confluence", asset],
    queryFn: () => fetcher(`/api/agents/confluence/${asset}`),
    refetchInterval: 60000,
    enabled: tab === "confluence",
  });

  const sentiment = useQuery({
    queryKey: ["sentiment", asset],
    queryFn: () => fetcher(`/api/sentiment/${asset}`),
    refetchInterval: 60000,
    enabled: tab === "sentiment",
  });

  const edgeQuery = useQuery({
    queryKey: ["edge-wallet", walletAddress],
    queryFn: () => fetchWithMeta<any>(`/api/edge/wallet/${walletAddress}`),
    enabled: tab === "my-edge" && /^0x[0-9a-fA-F]{40}$/.test(walletAddress),
    staleTime: 60000,
  });
  const edgeData = (edgeQuery.data as any)?.data ?? {};

  async function runAnalysis() {
    setAnalyzing(true);
    setError(null);
    setResult(null);
    try {
      const r = await api.post(`/api/agents/research/${asset.toUpperCase()}`);
      setResult((r.data?.signal ?? r.data?.data ?? r.data) as Record<string, unknown>);
    } catch (e: unknown) {
      try {
        const r2 = await api.post(`/api/research/${asset.toUpperCase()}`);
        setResult((r2.data?.signal ?? r2.data) as Record<string, unknown>);
      } catch {
        const msg = e instanceof Error ? e.message : "Analysis failed";
        setError(msg);
      }
    } finally {
      setAnalyzing(false);
    }
  }

  const chartData: CandlePoint[] = normalizeKlines(
    Array.isArray(klines.data) ? (klines.data as unknown[]) : []
  );
  const signalList: Array<Record<string, unknown>> = Array.isArray(signals.data)
    ? (signals.data as Array<Record<string, unknown>>)
    : [];
  const obData = orderbook.data as Record<string, unknown> | null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      >
        <h1 className="text-2xl font-black text-[var(--text-primary)] mb-1">Research</h1>
        <p className="text-sm text-[var(--text-muted)]">AI-powered technical analysis & signals</p>
      </motion.div>

      {/* Controls */}
      <GlassCard animate padding="sm">
        <div className="flex flex-wrap items-center gap-3">
          {/* Asset selector */}
          <div className="flex flex-wrap gap-1.5">
            {ASSETS.map((a) => (
              <button
                key={a}
                onClick={() => setAsset(a)}
                className={cn(
                  "px-3 py-1.5 rounded-[var(--radius-sm)] text-xs font-bold transition-all",
                  asset === a
                    ? "bg-[rgba(59,130,246,0.2)] text-[var(--blue)] border border-[rgba(59,130,246,0.3)]"
                    : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-glass-hover)] border border-transparent"
                )}
              >
                {a}
              </button>
            ))}
          </div>

          {/* Interval selector */}
          <div className="flex gap-1">
            {INTERVALS.map((iv) => (
              <button
                key={iv}
                onClick={() => setInterval(iv)}
                className={cn(
                  "px-2.5 py-1 rounded-[var(--radius-sm)] text-xs font-semibold transition-all",
                  interval === iv
                    ? "bg-[rgba(16,185,129,0.2)] text-[var(--green)] border border-[rgba(16,185,129,0.3)]"
                    : "text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-glass-hover)] border border-transparent"
                )}
              >
                {iv}
              </button>
            ))}
          </div>

          {/* Analyze button */}
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={runAnalysis}
            disabled={analyzing}
            className="ml-auto flex items-center gap-2 px-4 py-2 rounded-[var(--radius-md)] text-sm font-bold text-white disabled:opacity-60"
            style={{ background: "var(--grad-brand)" }}
          >
            <Zap className="w-4 h-4" />
            {analyzing ? "Analyzing..." : "AI Analysis"}
          </motion.button>
        </div>
      </GlassCard>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2">
        {(["chart", "signals", "orderbook", "confluence", "sentiment", "my-edge"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "flex items-center gap-1.5 px-4 py-2 rounded-[var(--radius-md)] text-sm font-semibold transition-all border",
              tab === t
                ? "bg-[rgba(59,130,246,0.15)] text-[var(--blue)] border-[rgba(59,130,246,0.3)]"
                : "text-[var(--text-muted)] border-[var(--glass-border)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-glass-hover)]"
            )}
          >
            {t === "chart" && <BarChart2 className="w-4 h-4" />}
            {t === "signals" && <TrendingUp className="w-4 h-4" />}
            {t === "orderbook" && <BookOpen className="w-4 h-4" />}
            {t === "confluence" && <Activity className="w-4 h-4" />}
            {t === "sentiment" && <MessageSquare className="w-4 h-4" />}
            {t === "my-edge" && <Target className="w-4 h-4" />}
            {t === "my-edge" ? "My Edge" : t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* Main content */}
      <AnimatePresence mode="wait">
        {tab === "chart" && (
          <motion.div
            key="chart"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
            className="space-y-4"
          >
            <GlassCard padding="sm">
              <div className="flex items-center justify-between mb-3 px-2">
                <h2 className="font-bold text-[var(--text-primary)]">
                  {asset}/USDT · {interval}
                </h2>
                {klines.isFetching && (
                  <span className="text-xs text-[var(--text-muted)] animate-pulse">Updating...</span>
                )}
              </div>
              {chartData.length > 0 ? (
                <LightweightCandlestickChart data={chartData} height={380} />
              ) : (
                <div className="h-[380px] flex items-center justify-center text-[var(--text-muted)] text-sm">
                  {klines.isLoading ? "Loading chart data..." : "No chart data available"}
                </div>
              )}
            </GlassCard>

            {/* AI Analysis result */}
            <AnimatePresence>
              {(result || error) && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                >
                  {error ? (
                    <GlassCard glow="red" padding="md">
                      <p className="text-sm text-[var(--red)]">{error}</p>
                    </GlassCard>
                  ) : result && (
                    <GlassCard
                      glow={(result.direction as string) === "long" ? "green" : (result.direction as string) === "short" ? "red" : "blue"}
                      padding="md"
                    >
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="font-bold text-[var(--text-primary)]">AI Analysis: {asset}</h3>
                        <span
                          className={cn(
                            "px-3 py-1 rounded-full text-xs font-bold",
                            (result.direction as string) === "long" ? "bg-[var(--green-soft)] text-[var(--green)]" :
                            (result.direction as string) === "short" ? "bg-[var(--red-soft)] text-[var(--red)]" :
                            "bg-[var(--blue-soft)] text-[var(--blue)]"
                          )}
                        >
                          {String(result.direction ?? "neutral").toUpperCase()}
                        </span>
                      </div>

                      {result.confidence != null && (
                        <div className="mb-4">
                          <div className="flex justify-between text-xs text-[var(--text-muted)] mb-1">
                            <span>Confidence</span>
                            <span>{String(result.confidence)}%</span>
                          </div>
                          <div className="h-2 rounded-full bg-[var(--border-subtle)] overflow-hidden">
                            <motion.div
                              className={cn(
                                "h-full rounded-full",
                                (result.direction as string) === "long" ? "bg-[var(--green)]" :
                                (result.direction as string) === "short" ? "bg-[var(--red)]" : "bg-[var(--blue)]"
                              )}
                              initial={{ width: 0 }}
                              animate={{ width: `${Number(result.confidence ?? 0)}%` }}
                              transition={{ duration: 0.8 }}
                            />
                          </div>
                        </div>
                      )}

                      {/* Price targets */}
                      {(result.entry != null || result.tp != null || result.sl != null) && (
                        <div className="grid grid-cols-3 gap-3 mb-4">
                          {result.entry != null && (
                            <div className="text-center p-2 rounded-[var(--radius-sm)] bg-[var(--bg-glass)]">
                              <div className="text-xs text-[var(--text-muted)] mb-1">Entry</div>
                              <div className="text-sm font-bold text-[var(--text-primary)]">${String(result.entry ?? "")}</div>
                            </div>
                          )}
                          {result.tp != null && (
                            <div className="text-center p-2 rounded-[var(--radius-sm)] bg-[var(--green-soft)]">
                              <div className="text-xs text-[var(--green)] mb-1">Take Profit</div>
                              <div className="text-sm font-bold text-[var(--green)]">${String(result.tp ?? "")}</div>
                            </div>
                          )}
                          {result.sl != null && (
                            <div className="text-center p-2 rounded-[var(--radius-sm)] bg-[var(--red-soft)]">
                              <div className="text-xs text-[var(--red)] mb-1">Stop Loss</div>
                              <div className="text-sm font-bold text-[var(--red)]">${String(result.sl ?? "")}</div>
                            </div>
                          )}
                        </div>
                      )}

                      {result.reason != null && (
                        <p className="text-sm text-[var(--text-secondary)]">{String(result.reason)}</p>
                      )}
                    </GlassCard>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}

        {tab === "signals" && (
          <motion.div
            key="signals"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
          >
            <GlassCard padding="md">
              <h2 className="font-bold text-[var(--text-primary)] mb-4">Signals for {asset}</h2>
              {signalList.length === 0 ? (
                <p className="text-sm text-[var(--text-muted)] text-center py-8">
                  {signals.isLoading ? "Loading signals..." : "No signals found for this asset."}
                </p>
              ) : (
                <div className="space-y-3">
                  {signalList.map((s, i) => (
                    <div key={i} className="flex items-center justify-between p-3 rounded-[var(--radius-md)] bg-[var(--bg-glass)] border border-[var(--glass-border)]">
                      <div>
                        <span className="text-sm font-bold text-[var(--text-primary)]">{String(s.asset ?? s.symbol ?? asset)}</span>
                        {s.reason != null && <p className="text-xs text-[var(--text-secondary)] mt-0.5">{String(s.reason)}</p>}
                      </div>
                      <span
                        className={cn(
                          "px-2 py-1 rounded-full text-xs font-bold",
                          String(s.direction) === "long" ? "bg-[var(--green-soft)] text-[var(--green)]" :
                          String(s.direction) === "short" ? "bg-[var(--red-soft)] text-[var(--red)]" :
                          "bg-[var(--blue-soft)] text-[var(--blue)]"
                        )}
                      >
                        {String(s.direction ?? "neutral").toUpperCase()}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </GlassCard>
          </motion.div>
        )}

        {tab === "orderbook" && (
          <motion.div
            key="orderbook"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
          >
            <GlassCard padding="md">
              <h2 className="font-bold text-[var(--text-primary)] mb-4">Order Book: {asset}</h2>
              {!obData ? (
                <p className="text-sm text-[var(--text-muted)] text-center py-8">
                  {orderbook.isLoading ? "Loading orderbook..." : "Orderbook data unavailable"}
                </p>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h3 className="text-sm font-semibold text-[var(--green)] mb-2">Bids</h3>
                    <div className="space-y-1">
                      {(Array.isArray(obData.bids) ? obData.bids as Array<[string, string]> : []).slice(0, 10).map((bid, i) => (
                        <div key={i} className="flex justify-between text-xs font-mono">
                          <span className="text-[var(--green)]">{Number(bid[0]).toLocaleString()}</span>
                          <span className="text-[var(--text-muted)]">{Number(bid[1]).toFixed(4)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-[var(--red)] mb-2">Asks</h3>
                    <div className="space-y-1">
                      {(Array.isArray(obData.asks) ? obData.asks as Array<[string, string]> : []).slice(0, 10).map((ask, i) => (
                        <div key={i} className="flex justify-between text-xs font-mono">
                          <span className="text-[var(--red)]">{Number(ask[0]).toLocaleString()}</span>
                          <span className="text-[var(--text-muted)]">{Number(ask[1]).toFixed(4)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </GlassCard>
          </motion.div>
        )}

        {tab === "confluence" && (
          <motion.div key="confluence" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
            {confluence.isLoading && <div className="text-center py-8 text-[var(--text-muted)]">Analyzing {asset} across 6 timeframes…</div>}
            {confluence.data && (() => {
              const d = (confluence.data as any)?.data ?? confluence.data ?? {};
              const tfs: any[] = Array.isArray(d.timeframes) ? d.timeframes : [];
              const dirColor = d.overall_direction?.startsWith("STRONG") ? (d.overall_direction.includes("LONG") ? "var(--green)" : "var(--red)") : d.overall_direction === "LONG" ? "var(--green)" : d.overall_direction === "SHORT" ? "var(--red)" : "var(--orange)";
              return (
                <div className="space-y-4">
                  <GlassCard padding="md">
                    <div className="flex items-center justify-between flex-wrap gap-4">
                      <div>
                        <div className="text-xs text-[var(--text-muted)] font-semibold mb-1">OVERALL DIRECTION</div>
                        <div className="text-2xl font-black" style={{ color: dirColor }}>{d.overall_direction}</div>
                        <div className="text-sm text-[var(--text-muted)] mt-1">Score: {d.score?.toFixed(2)} | Strength: {(d.strength * 100).toFixed(0)}%</div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs text-[var(--text-muted)] font-semibold mb-1">RECOMMENDATION</div>
                        <div className="text-sm font-bold text-[var(--text-primary)]">{d.recommendation}</div>
                        <div className="text-xs text-[var(--text-muted)] mt-1">Timeframes aligned: {d.aligned_timeframes}/{tfs.length}</div>
                      </div>
                    </div>
                  </GlassCard>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {tfs.map((tf: any) => {
                      const c = tf.trend === "up" ? "var(--green)" : tf.trend === "down" ? "var(--red)" : "var(--text-muted)";
                      return (
                        <GlassCard key={tf.timeframe} padding="sm">
                          <div className="text-xs text-[var(--text-muted)] font-semibold mb-1">{tf.timeframe}</div>
                          <div className="font-bold" style={{ color: c }}>{tf.trend?.toUpperCase()}</div>
                          <div className="text-xs text-[var(--text-muted)] mt-1">
                            RSI: {tf.rsi?.toFixed(1)} | EMA {tf.price_vs_ema20 > 0 ? "↑" : "↓"}
                          </div>
                          <div className="text-xs text-[var(--text-muted)]">Score: {tf.score?.toFixed(2)}</div>
                        </GlassCard>
                      );
                    })}
                  </div>
                </div>
              );
            })()}
          </motion.div>
        )}

        {tab === "sentiment" && (
          <motion.div key="sentiment" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
            {sentiment.isLoading && <div className="text-center py-8 text-[var(--text-muted)]">Fetching social sentiment for {asset}…</div>}
            {sentiment.data && (() => {
              const d = (sentiment.data as any)?.data ?? sentiment.data ?? {};
              const sentScore = Number(d.sentiment_score ?? 0);
              const sentColor = sentScore > 0.2 ? "var(--green)" : sentScore < -0.2 ? "var(--red)" : "var(--orange)";
              const sentLabel = sentScore > 0.5 ? "Very Bullish" : sentScore > 0.2 ? "Bullish" : sentScore < -0.5 ? "Very Bearish" : sentScore < -0.2 ? "Bearish" : "Neutral";
              return (
                <div className="space-y-4">
                  <GlassCard padding="md">
                    <div className="flex items-center justify-between flex-wrap gap-4 mb-4">
                      <div>
                        <div className="text-xs text-[var(--text-muted)] font-semibold mb-1">SOCIAL SENTIMENT · {asset}</div>
                        <div className="text-3xl font-black" style={{ color: sentColor }}>{sentLabel}</div>
                        <div className="text-sm text-[var(--text-muted)] mt-1">
                          Score: {sentScore.toFixed(3)} | Bullish: {d.bullish_count} | Bearish: {d.bearish_count}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs text-[var(--text-muted)]">Source: {d.source}</div>
                        <div className="text-xs text-[var(--text-muted)]">{d.total_articles} articles analyzed</div>
                      </div>
                    </div>
                    {/* Sentiment bar */}
                    <div className="w-full h-3 rounded-full bg-[var(--surface-2)] overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${Math.round((sentScore + 1) / 2 * 100)}%`, background: sentColor }}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-[var(--text-muted)] mt-1">
                      <span>Very Bearish</span><span>Neutral</span><span>Very Bullish</span>
                    </div>
                  </GlassCard>
                  {Array.isArray(d.articles) && d.articles.length > 0 && (
                    <GlassCard padding="md">
                      <h3 className="text-sm font-bold text-[var(--text-primary)] mb-3">Recent News</h3>
                      <div className="space-y-2">
                        {d.articles.slice(0, 6).map((a: any, i: number) => (
                          <div key={i} className="flex items-start gap-2 py-2 border-b border-[var(--border)] last:border-0">
                            <span className={`text-xs font-bold px-1.5 py-0.5 rounded flex-shrink-0 ${a.sentiment === "bullish" ? "bg-[var(--green)]20 text-[var(--green)]" : a.sentiment === "bearish" ? "bg-[var(--red)]20 text-[var(--red)]" : "bg-[var(--surface-2)] text-[var(--text-muted)]"}`}>{a.sentiment ?? "neutral"}</span>
                            <a href={a.url} target="_blank" rel="noopener noreferrer" className="text-xs text-[var(--text-primary)] hover:text-[var(--blue)] line-clamp-2">{a.title}</a>
                          </div>
                        ))}
                      </div>
                    </GlassCard>
                  )}
                </div>
              );
            })()}
          </motion.div>
        )}
      </AnimatePresence>

      {/* My Edge Tab */}
      <AnimatePresence>
        {tab === "my-edge" && (
          <motion.div
            key="my-edge"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
            className="space-y-4"
          >
            {/* Wallet input */}
            <GlassCard padding="md">
              <div className="flex items-center gap-2 mb-1">
                <Wallet className="w-4 h-4 text-[var(--text-muted)]" />
                <span className="text-sm font-bold text-[var(--text-primary)]">My Edge Analysis</span>
              </div>
              <p className="text-xs text-[var(--text-muted)] mb-4">Enter your EVM wallet address to analyze your trading performance pattern</p>
              <div className="flex gap-2">
                <input
                  value={walletInput}
                  onChange={(e) => setWalletInput(e.target.value)}
                  placeholder="0x..."
                  className="flex-1 bg-[var(--surface)] border border-[var(--glass-border)] rounded-[var(--radius-sm)] px-3 py-2 text-sm font-mono text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[rgba(59,130,246,0.5)]"
                  onKeyDown={(e) => { if (e.key === "Enter") setWalletAddress(walletInput.trim()); }}
                />
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setWalletAddress(walletInput.trim())}
                  disabled={!/^0x[0-9a-fA-F]{40}$/.test(walletInput.trim())}
                  className="px-4 py-2 rounded-[var(--radius-sm)] text-sm font-bold text-white disabled:opacity-40 flex-shrink-0"
                  style={{ background: "var(--grad-brand)" }}
                >
                  Analyze
                </motion.button>
              </div>
              {walletInput.trim().length > 2 && !/^0x[0-9a-fA-F]{40}$/.test(walletInput.trim()) && (
                <p className="text-xs text-[var(--red)] mt-1.5">Invalid EVM address format</p>
              )}
            </GlassCard>

            {/* Edge results */}
            <AnimatePresence>
              {edgeQuery.isLoading && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <GlassCard padding="md">
                    <div className="flex items-center gap-3 text-[var(--text-muted)]">
                      <div className="w-4 h-4 border-2 border-[var(--blue)] border-t-transparent rounded-full animate-spin" />
                      <span className="text-sm">Analyzing wallet edge…</span>
                    </div>
                  </GlassCard>
                </motion.div>
              )}

              {!edgeQuery.isLoading && edgeData.address && edgeData.source === 'empty' && (
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                  <GlassCard padding="md">
                    <p className="text-sm text-[var(--text-muted)] text-center py-2">No filled trades found for this wallet yet.</p>
                  </GlassCard>
                </motion.div>
              )}

              {!edgeQuery.isLoading && edgeData.address && edgeData.source !== 'empty' && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="space-y-4"
                >
                  {/* Summary stats */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <GlassCard padding="sm">
                      <div className="text-xs text-[var(--text-muted)] mb-1">Total Trades</div>
                      <div className="text-2xl font-black text-[var(--text-primary)]">{edgeData.total_trades ?? 0}</div>
                    </GlassCard>
                    <GlassCard padding="sm">
                      <div className="flex items-center gap-1 text-xs text-[var(--text-muted)] mb-1">
                        <Clock className="w-3 h-3" /> Peak Hour UTC
                      </div>
                      <div className="text-2xl font-black text-[var(--blue)]">{edgeData.peak_hour_utc != null ? `${edgeData.peak_hour_utc}:00` : "–"}</div>
                    </GlassCard>
                    <GlassCard padding="sm" className="col-span-2 sm:col-span-1">
                      <div className="text-xs text-[var(--text-muted)] mb-1">Markets Traded</div>
                      <div className="text-2xl font-black text-[var(--text-primary)]">{Object.keys(edgeData.markets ?? {}).length}</div>
                    </GlassCard>
                  </div>

                  {/* AI Summary */}
                  {edgeData.ai_summary && (
                    <GlassCard glow="blue" padding="md">
                      <div className="text-xs font-bold text-[var(--blue)] uppercase tracking-wider mb-2">AI Edge Summary</div>
                      <p className="text-sm text-[var(--text-primary)] leading-relaxed">{edgeData.ai_summary}</p>
                    </GlassCard>
                  )}

                  {/* Markets breakdown */}
                  {edgeData.markets && Object.keys(edgeData.markets).length > 0 && (
                    <GlassCard padding="md">
                      <div className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider mb-3">Markets Breakdown</div>
                      <div className="space-y-2">
                        {Object.entries(edgeData.markets as Record<string, { count: number; pnl?: number }>)
                          .sort(([, a], [, b]) => b.count - a.count)
                          .map(([market, stats]) => (
                            <div key={market} className="flex items-center justify-between py-1.5 border-b border-[var(--border)] last:border-0">
                              <span className="text-sm font-mono font-bold text-[var(--text-primary)]">{market}</span>
                              <div className="flex items-center gap-3">
                                <span className="text-xs text-[var(--text-muted)]">{stats.count} trades</span>
                                {stats.pnl != null && (
                                  <span className={cn("text-xs font-bold", stats.pnl >= 0 ? "text-[var(--green)]" : "text-[var(--red)]")}>
                                    {stats.pnl >= 0 ? "+" : ""}{stats.pnl.toFixed(2)}%
                                  </span>
                                )}
                              </div>
                            </div>
                          ))}
                      </div>
                    </GlassCard>
                  )}

                  {/* Run full analysis */}
                  <motion.button
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => setShowAgentCycle(true)}
                    className="w-full py-3 rounded-[var(--radius-md)] text-sm font-bold text-white flex items-center justify-center gap-2"
                    style={{ background: "var(--grad-brand)" }}
                  >
                    <Zap className="w-4 h-4" />
                    Run Full AI Analysis
                  </motion.button>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Agent Cycle Modal */}
      <AgentCycle isOpen={showAgentCycle} onClose={() => setShowAgentCycle(false)} asset={asset} />
    </div>
  );
}

