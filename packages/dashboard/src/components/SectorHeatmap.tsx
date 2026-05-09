"use client";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface Sector {
  name: string;
  change_pct_24h?: number;
  market_cap?: number;
  [key: string]: unknown;
}

interface SectorHeatmapProps {
  sectors: Sector[];
  compact?: boolean;
}

function getColor(change: number): string {
  if (change >= 5) return "rgba(16,185,129,0.7)";
  if (change >= 2) return "rgba(16,185,129,0.45)";
  if (change >= 0) return "rgba(16,185,129,0.25)";
  if (change >= -2) return "rgba(239,68,68,0.25)";
  if (change >= -5) return "rgba(239,68,68,0.45)";
  return "rgba(239,68,68,0.7)";
}

function getTextColor(change: number): string {
  return change >= 0 ? "var(--green)" : "var(--red)";
}

export function SectorHeatmap({ sectors, compact = false }: SectorHeatmapProps) {
  if (!sectors || sectors.length === 0) {
    return (
      <div className="text-center py-8 text-[var(--text-muted)] text-sm">
        No sector data available
      </div>
    );
  }

  return (
    <div
      className={cn(
        "grid gap-2",
        compact ? "grid-cols-3" : "grid-cols-2 md:grid-cols-3"
      )}
    >
      {sectors.map((sector, i) => {
        const change = sector.change_pct_24h ?? 0;
        return (
          <motion.div
            key={sector.name}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.05, duration: 0.3 }}
            className="rounded-[var(--radius-md)] p-3 border border-[var(--glass-border)] cursor-default hover:border-[var(--glass-border-strong)] transition-colors"
            style={{ background: getColor(change) }}
          >
            <div className="text-xs font-semibold text-[var(--text-primary)] truncate">
              {sector.name}
            </div>
            <div
              className="text-sm font-bold mt-0.5"
              style={{ color: getTextColor(change) }}
            >
              {change >= 0 ? "+" : ""}{change.toFixed(2)}%
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
