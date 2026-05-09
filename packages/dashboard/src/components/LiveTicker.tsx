"use client";
import { useEffect, useRef, useState } from "react";
import { useWebSocket } from "@/lib/websocket";
import { TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface TickerItem {
  symbol: string;
  price: number;
  change24h: number;
}

const DEFAULT_ITEMS: TickerItem[] = [
  { symbol: "BTC", price: 0, change24h: 0 },
  { symbol: "ETH", price: 0, change24h: 0 },
  { symbol: "SOL", price: 0, change24h: 0 },
  { symbol: "BNB", price: 0, change24h: 0 },
  { symbol: "ADA", price: 0, change24h: 0 },
];

export function LiveTicker() {
  const [items, setItems] = useState<TickerItem[]>(DEFAULT_ITEMS);
  const [flashMap, setFlashMap] = useState<Record<string, "green" | "red" | null>>({});
  const prevPrices = useRef<Record<string, number>>({});
  const { lastMessage } = useWebSocket("prices");

  useEffect(() => {
    if (!lastMessage) return;
    try {
      const data = typeof lastMessage === "string" ? JSON.parse(lastMessage) : (lastMessage as { data: unknown }).data;
      if (!data.symbol || data.price == null) return;
      const sym = data.symbol.replace("USDT", "").replace("BUSD", "");
      const newPrice = Number(data.price);
      const prev = prevPrices.current[sym] || 0;
      const flash: "green" | "red" = newPrice >= prev ? "green" : "red";

      setItems((prev2) =>
        prev2.map((item) =>
          item.symbol === sym
            ? { ...item, price: newPrice, change24h: data.change24h ?? item.change24h }
            : item
        )
      );
      setFlashMap((f) => ({ ...f, [sym]: flash }));
      prevPrices.current[sym] = newPrice;
      setTimeout(() => setFlashMap((f) => ({ ...f, [sym]: null })), 500);
    } catch {}
  }, [lastMessage]);

  return (
    <div className="flex items-center gap-4 overflow-x-auto pb-1 scrollbar-hide">
      {items.map((item) => (
        <div
          key={item.symbol}
          className={cn(
            "flex items-center gap-2 px-3 py-2 rounded-[var(--radius-md)] border border-[var(--glass-border)] bg-[var(--bg-card)] backdrop-blur-xl flex-shrink-0 transition-all",
            flashMap[item.symbol] === "green" && "animate-flash-green",
            flashMap[item.symbol] === "red" && "animate-flash-red"
          )}
        >
          <span className="text-sm font-bold text-[var(--text-primary)]">{item.symbol}</span>
          <span className="text-sm font-mono text-[var(--text-secondary)]">
            {item.price > 0 ? `$${item.price.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : "—"}
          </span>
          {item.change24h !== 0 && (
            <span
              className={cn(
                "flex items-center gap-0.5 text-xs font-semibold",
                item.change24h >= 0 ? "text-[var(--green)]" : "text-[var(--red)]"
              )}
            >
              {item.change24h >= 0 ? (
                <TrendingUp className="w-3 h-3" />
              ) : (
                <TrendingDown className="w-3 h-3" />
              )}
              {Math.abs(item.change24h).toFixed(2)}%
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
