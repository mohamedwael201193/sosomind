"use client";
/**
 * CryptoIcon — Universal token icon using @web3icons/react/dynamic.
 *
 * Handles:
 * - SoDEX testnet prefix stripping: vETH → ETH, vUSDC → USDC, WSOSO → SOSO
 * - Branded variant by default (full-color logos)
 * - Graceful fallback: styled circle with 1-3 letter abbreviation
 * - size/className passthrough
 */
import { Suspense } from "react";
import { TokenIcon } from "@web3icons/react/dynamic";

interface CryptoIconProps {
  symbol: string;
  size?: number;
  variant?: "branded" | "mono" | "background";
  className?: string;
}

/** Normalize SoDEX testnet coin names to real symbols */
function normalize(symbol: string): string {
  if (!symbol) return "";
  const s = symbol.trim().toUpperCase();
  if (s === "WSOSO") return "SOSO";
  if (s.startsWith("V") && s.length > 1) return s.slice(1); // vETH → ETH
  return s;
}

/** Fallback circle with abbreviation */
function FallbackIcon({ symbol, size }: { symbol: string; size: number }) {
  const abbr = symbol.slice(0, 3).toUpperCase();
  // Deterministic hue from symbol chars
  const hue = symbol.split("").reduce((a, c) => a + c.charCodeAt(0), 0) % 360;
  return (
    <span
      aria-label={symbol}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: size,
        height: size,
        borderRadius: "50%",
        background: `oklch(0.45 0.18 ${hue})`,
        color: "#fff",
        fontSize: Math.max(8, size * 0.32),
        fontWeight: 700,
        fontFamily: "var(--font-mono, monospace)",
        letterSpacing: "-0.03em",
        flexShrink: 0,
        lineHeight: 1,
      }}
    >
      {abbr}
    </span>
  );
}

export function CryptoIcon({
  symbol,
  size = 20,
  variant = "branded",
  className,
}: CryptoIconProps) {
  const clean = normalize(symbol);
  if (!clean) return null;

  return (
    <Suspense fallback={<FallbackIcon symbol={clean} size={size} />}>
      <TokenIcon
        symbol={clean}
        size={size}
        variant={variant}
        className={className}
        fallback={<FallbackIcon symbol={clean} size={size} />}
      />
    </Suspense>
  );
}
