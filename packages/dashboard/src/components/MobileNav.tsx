"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { LayoutDashboard, Zap, PieChart, Target, CandlestickChart } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { href: "/track-record", label: "Record", icon: Target },
  { href: "/signals", label: "Signals", icon: Zap },
  { href: "/trade", label: "Trade", icon: CandlestickChart },
  { href: "/portfolio", label: "Portfolio", icon: PieChart },
  { href: "/dashboard", label: "Home", icon: LayoutDashboard },
];

export function MobileNav() {
  const pathname = usePathname();

  // Hide on standalone pages
  if (pathname === "/" || pathname === "/landing" || pathname?.startsWith("/docs")) return null;

  return (
    <nav className="fixed bottom-0 left-0 right-0 md:hidden z-50 border-t border-[var(--glass-border)] bg-[var(--bg-card)] backdrop-blur-xl">
      <div className="flex items-center justify-around h-16 px-2">
        {items.map((item) => {
          const isActive = pathname === item.href || (item.href !== "/" && pathname?.startsWith(item.href));
          const Icon = item.icon;
          return (
            <Link key={item.href} href={item.href} className="flex-1">
              <motion.div
                whileTap={{ scale: 0.9 }}
                className={cn(
                  "flex flex-col items-center gap-1 py-2 transition-colors",
                  isActive ? "text-[var(--blue)]" : "text-[var(--text-muted)]"
                )}
              >
                <Icon className="w-5 h-5" />
                <span className="text-[10px] font-semibold">{item.label}</span>
              </motion.div>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
