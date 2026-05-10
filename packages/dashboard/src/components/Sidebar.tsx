"use client";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { usePathname } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { useTheme } from "@/context/ThemeContext";
import { useWallet } from "@/context/WalletContext";
import {
  LayoutDashboard, PieChart, Search,
  Grid3X3, BarChart3, Bell, Settings, ChevronLeft,
  ChevronRight, Sun, Moon, Zap, Wallet, LogOut, User,
  Waves, ArrowLeftRight, BookOpen, Trophy, Scale, UserCircle2,
  CandlestickChart, Activity,
} from "lucide-react";
import { cn } from "@/lib/utils";

type NavSection = {
  label: string;
  items: { href: string; label: string; icon: React.ComponentType<{ className?: string }>; badge?: boolean; count?: number }[];
};

const navSections: NavSection[] = [
  {
    label: "PAGES",
    items: [
      { href: "/", label: "Dashboard", icon: LayoutDashboard, count: 1 },
      { href: "/signals", label: "Signals", icon: Zap, badge: true, count: 3 },
      { href: "/trade", label: "Trade", icon: CandlestickChart, count: 1 },
      { href: "/portfolio", label: "Portfolio", icon: PieChart, count: 1 },
      { href: "/research", label: "Research", icon: Search, count: 1 },
      { href: "/sectors", label: "Sectors", icon: Grid3X3, count: 1 },
      { href: "/agents", label: "Macro & AI", icon: BarChart3, count: 1 },
      { href: "/whales", label: "Whales", icon: Waves, count: 1 },
      { href: "/arbitrage", label: "Arbitrage", icon: ArrowLeftRight, count: 1 },
    ],
  },
  {
    label: "TOOLS",
    items: [
      { href: "/playbook", label: "Playbook", icon: BookOpen, count: 1 },
      { href: "/leaderboard", label: "Leaderboard", icon: Trophy, count: 1 },
      { href: "/rebalance", label: "Rebalance", icon: Scale, count: 1 },
      { href: "/persona", label: "Persona", icon: UserCircle2, count: 1 },
      { href: "/alerts", label: "Alerts", icon: Bell, badge: true, count: 2 },
    ],
  },
  {
    label: "ACCOUNT",
    items: [
      { href: "/profile", label: "Profile", icon: User, count: 1 },
      { href: "/status", label: "System Status", icon: Activity, count: 1 },
      { href: "/settings", label: "Settings", icon: Settings, count: 1 },
    ],
  },
];

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();
  const { theme, toggle } = useTheme();
  const { address, disconnect } = useWallet();

  return (
    <motion.aside
      animate={{ width: collapsed ? 68 : 240 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className="flex flex-col overflow-hidden"
      style={{
        position: "fixed", left: 0, top: 0, height: "100vh", zIndex: 50,
        background: 'var(--bg-sidebar)',
        borderRight: '1px solid var(--glass-border)',
      }}
    >
      {/* Logo */}
      <div
        className="h-16 flex items-center px-4 border-b"
        style={{ borderColor: 'var(--glass-border)', flexShrink: 0 }}
      >
        <Link href="/landing" className="flex items-center min-w-0 flex-1">
          <div className="flex-shrink-0" style={{ filter: 'drop-shadow(0 2px 12px rgba(249,115,22,0.5))' }}>
            <Image
              src="/logo-mark.png"
              alt="SoSoMind"
              width={36}
              height={36}
              className="rounded-xl object-contain"
              priority
            />
          </div>
          <AnimatePresence>
            {!collapsed && (
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.2 }}
                className="ml-3 flex flex-col min-w-0"
              >
                <span
                  className="font-black text-base whitespace-nowrap leading-tight"
                  style={{ fontFamily: 'var(--font-display)', letterSpacing: '-0.04em', color: 'var(--text-primary)' }}
                >
                  SoSo<span style={{ color: '#f97316' }}>Mind</span>
                </span>
                <span className="text-[10px]" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                  Agentic Finance OS
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </Link>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="ml-auto w-6 h-6 rounded-lg flex items-center justify-center transition-colors flex-shrink-0"
          style={{ background: 'var(--bg-glass)' }}
          onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-glass-hover)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'var(--bg-glass)')}
        >
          {collapsed ? (
            <ChevronRight className="w-3 h-3" style={{ color: 'var(--text-muted)' }} />
          ) : (
            <ChevronLeft className="w-3 h-3" style={{ color: 'var(--text-muted)' }} />
          )}
        </button>
      </div>

      {/* Sectioned Nav */}
      <nav className="flex-1 py-3 px-2 overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
        {navSections.map((section) => (
          <div key={section.label} className="mb-4">
            <AnimatePresence>
              {!collapsed && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="px-3 py-1.5 mb-1"
                >
                  <span
                    className="text-[10px] font-bold tracking-[0.14em] uppercase"
                    style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}
                  >
                    {section.label}
                  </span>
                </motion.div>
              )}
            </AnimatePresence>
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const isActive =
                  pathname === item.href ||
                  (item.href !== "/" && pathname?.startsWith(item.href + "/"));
                const Icon = item.icon;
                return (
                  <Link key={item.href} href={item.href}>
                    <motion.div
                      whileHover={{ x: collapsed ? 0 : 2 }}
                      className="relative flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-all duration-150"
                      style={{
                        background: isActive ? 'rgba(249,115,22,0.15)' : 'transparent',
                        color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
                      }}
                      onMouseEnter={e => {
                        if (!isActive) e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.background = isActive ? 'rgba(249,115,22,0.15)' : 'transparent';
                      }}
                    >
                      {/* Active left bar */}
                      {isActive && (
                        <motion.div
                          layoutId="sidebar-active-bar"
                          className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-6 rounded-full"
                          style={{ background: 'var(--accent)', boxShadow: '0 0 8px rgba(249,115,22,0.6)' }}
                          transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                        />
                      )}
                      <span style={{ color: isActive ? 'var(--accent)' : 'var(--text-secondary)', display: 'flex', flexShrink: 0 }}>
                        <Icon className="w-[18px] h-[18px]" />
                      </span>
                      <AnimatePresence>
                        {!collapsed && (
                          <motion.span
                            initial={{ opacity: 0, width: 0 }}
                            animate={{ opacity: 1, width: "auto" }}
                            exit={{ opacity: 0, width: 0 }}
                            transition={{ duration: 0.2 }}
                            className="text-sm font-medium whitespace-nowrap overflow-hidden flex-1"
                            style={{ color: isActive ? 'var(--accent)' : 'var(--text-secondary)' }}
                          >
                            {item.label}
                          </motion.span>
                        )}
                      </AnimatePresence>
                      {/* Count badge */}
                      {!collapsed && item.count !== undefined && (
                        <span
                          className="ml-auto text-[10px] font-bold min-w-[18px] h-[18px] rounded-full flex items-center justify-center px-1"
                          style={{
                            background: isActive ? 'rgba(249,115,22,0.25)' : 'rgba(255,255,255,0.06)',
                            color: isActive ? 'var(--accent)' : 'var(--text-muted)',
                            fontFamily: 'var(--font-mono)',
                          }}
                        >
                          {item.badge && !isActive ? (
                            <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--accent)' }} />
                          ) : (
                            item.count
                          )}
                        </span>
                      )}
                    </motion.div>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Bottom: Theme + Wallet */}
      <div
        className="p-3 space-y-1"
        style={{ flexShrink: 0, borderTop: '1px solid var(--glass-border)' }}
      >
        <button
          onClick={toggle}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-150"
          style={{ color: 'var(--text-secondary)' }}
          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.04)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
        >
          {theme === "dark" ? (
            <Moon className="w-[18px] h-[18px] flex-shrink-0" />
          ) : (
            <Sun className="w-[18px] h-[18px] flex-shrink-0" />
          )}
          <AnimatePresence>
            {!collapsed && (
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-sm whitespace-nowrap"
              >
                {theme === "dark" ? "Dark Mode" : "Light Mode"}
              </motion.span>
            )}
          </AnimatePresence>
        </button>

        {address && (
          <div className="flex items-center gap-3 px-3 py-2">
            <Wallet className="w-[18px] h-[18px] flex-shrink-0" style={{ color: 'var(--accent)' }} />
            <AnimatePresence>
              {!collapsed && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex items-center gap-2 min-w-0"
                >
                  <span className="text-xs truncate" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                    {address.slice(0, 6)}...{address.slice(-4)}
                  </span>
                  <button
                    onClick={disconnect}
                    className="flex-shrink-0 transition-opacity hover:opacity-80"
                    style={{ color: 'var(--red)' }}
                  >
                    <LogOut className="w-3.5 h-3.5" />
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>
    </motion.aside>
  );
}

