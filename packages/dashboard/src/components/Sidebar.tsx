"use client";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "react-router-dom";
import { Link } from "react-router-dom";
import { LogoMark } from "@/components/Logo";
import { useTheme } from "@/context/ThemeContext";
import { useWallet } from "@/context/WalletContext";
import {
  LayoutDashboard, PieChart, Search, Grid3X3, BarChart3, Bell, Settings,
  ChevronLeft, ChevronRight, Sun, Moon, Zap, Wallet, LogOut, User,
  Waves, ArrowLeftRight, BookOpen, Trophy, Scale, UserCircle2,
  CandlestickChart, Activity, Layers, Newspaper, Code2, Map, FlaskConical,
  Target, ChevronDown, Beaker,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { SetupProgress } from "@/components/SetupProgress";

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: boolean;
  labs?: boolean;
};

type NavSection = {
  label: string;
  items: NavItem[];
  collapsible?: boolean;
};

const navSections: NavSection[] = [
  {
    label: "OVERVIEW",
    items: [
      { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
    ],
  },
  {
    label: "TRADING",
    items: [
      { href: "/trade", label: "Trade", icon: CandlestickChart },
      { href: "/portfolio", label: "Portfolio", icon: PieChart },
      { href: "/perps", label: "Perps", icon: Activity },
    ],
  },
  {
    label: "INTELLIGENCE",
    items: [
      { href: "/signals", label: "Signals", icon: Zap, badge: true },
      { href: "/research", label: "Research", icon: Search },
      { href: "/sectors", label: "SSI Sectors", icon: Grid3X3 },
      { href: "/agents", label: "Market Regime", icon: BarChart3 },
    ],
  },
  {
    label: "ACCOUNT",
    items: [
      { href: "/account", label: "Account & Funding", icon: Wallet },
      { href: "/profile", label: "Profile", icon: User },
      { href: "/settings", label: "Settings", icon: Settings },
    ],
  },
  {
    label: "ADVANCED",
    collapsible: true,
    items: [
      { href: "/track-record", label: "Track Record", icon: Target },
      { href: "/methodology", label: "Methodology", icon: FlaskConical },
      { href: "/status", label: "System Status", icon: Activity },
      { href: "/docs", label: "API Docs", icon: Code2 },
      { href: "/roadmap", label: "Roadmap", icon: Map },
      { href: "/strategies", label: "Strategies", icon: Layers, labs: true },
      { href: "/rebalance", label: "Rebalance", icon: Scale, labs: true },
      { href: "/newsletter", label: "Newsletter", icon: Newspaper, labs: true },
      { href: "/whales", label: "Whales", icon: Waves, labs: true },
      { href: "/arbitrage", label: "Arbitrage", icon: ArrowLeftRight, labs: true },
      { href: "/playbook", label: "Playbook", icon: BookOpen, labs: true },
      { href: "/leaderboard", label: "Leaderboard", icon: Trophy, labs: true },
      { href: "/persona", label: "Persona", icon: UserCircle2, labs: true },
      { href: "/alerts", label: "Alerts", icon: Bell, labs: true },
    ],
  },
];

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const { pathname } = useLocation();
  const { theme, toggle } = useTheme();
  const { address, disconnect, connect, isConnecting } = useWallet();

  return (
    <motion.aside
      animate={{ width: collapsed ? 68 : 240 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className="hidden md:flex flex-col overflow-hidden"
      style={{
        position: "fixed", left: 0, top: 0, height: "100vh", zIndex: 50,
        background: 'var(--bg-sidebar)',
        borderRight: '1px solid var(--glass-border)',
      }}
    >
      <div
        className="h-16 flex items-center px-4 border-b"
        style={{ borderColor: 'var(--glass-border)', flexShrink: 0 }}
      >
        <Link to="/landing" className="flex items-center min-w-0 flex-1 gap-0">
          <LogoMark size={collapsed ? 30 : 34} />
          <AnimatePresence>
            {!collapsed && (
              <motion.div
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -8 }}
                transition={{ duration: 0.2 }}
                className="ml-2.5 flex flex-col min-w-0 overflow-hidden"
              >
                <span
                  className="font-black whitespace-nowrap leading-none"
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: 15,
                    letterSpacing: '-0.04em',
                    color: theme === 'dark' ? '#f1f1f5' : '#111111',
                  }}
                >
                  SoSo<span style={{ color: '#f97316' }}>Mind</span>
                </span>
                <span
                  className="text-[10px] mt-0.5 whitespace-nowrap"
                  style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', letterSpacing: '0.02em' }}
                >
                  Trustworthy Trading OS
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </Link>
      </div>

      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-4 scrollbar-thin">
        {navSections.map((section) => {
          const isAdvanced = section.label === "ADVANCED";
          if (isAdvanced && !advancedOpen && !collapsed) {
            const advancedActive = section.items.some((i) => pathname === i.href || pathname.startsWith(i.href + "/"));
            return (
              <div key={section.label}>
                <button
                  type="button"
                  onClick={() => setAdvancedOpen(true)}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors hover:text-[var(--text-primary)]"
                  style={{ color: advancedActive ? 'var(--accent)' : 'var(--text-muted)' }}
                >
                  <Beaker className="w-3.5 h-3.5" />
                  Advanced
                  <ChevronDown className="w-3 h-3 ml-auto" />
                </button>
              </div>
            );
          }
          if (isAdvanced && collapsed) return null;

          return (
            <div key={section.label}>
              {!collapsed && (
                <div className="flex items-center justify-between px-3 mb-1.5">
                  <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
                    {section.label}
                  </p>
                  {isAdvanced && (
                    <button type="button" onClick={() => setAdvancedOpen(false)} className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                      hide
                    </button>
                  )}
                </div>
              )}
              <ul className="space-y-0.5">
                {section.items.map((item) => {
                  const active = pathname === item.href || pathname.startsWith(item.href + "/");
                  const Icon = item.icon;
                  return (
                    <li key={item.href}>
                      <Link
                        to={item.href}
                        className={cn(
                          "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200",
                          active ? "bg-[var(--accent-soft)] text-[var(--accent)]" : "text-[var(--text-secondary)] hover:bg-[var(--glass-bg)]"
                        )}
                        title={collapsed ? item.label : undefined}
                      >
                        <Icon className={cn("w-4 h-4 flex-shrink-0", active && "text-[var(--accent)]")} />
                        {!collapsed && (
                          <>
                            <span className="truncate flex-1">{item.label}</span>
                            {item.labs && (
                              <span className="text-[9px] px-1.5 py-0.5 rounded font-bold uppercase" style={{ background: 'var(--glass-bg)', color: 'var(--text-muted)' }}>
                                lab
                              </span>
                            )}
                            {item.badge && (
                              <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] flex-shrink-0" />
                            )}
                          </>
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </nav>

      <div className="border-t p-2 space-y-1" style={{ borderColor: 'var(--glass-border)' }}>
        {!collapsed && <SetupProgress variant="compact" className="mb-1" />}
        {!collapsed && address && (
          <div className="px-3 py-2 text-[10px] font-mono truncate" style={{ color: 'var(--text-muted)' }}>
            {address.slice(0, 6)}…{address.slice(-4)}
          </div>
        )}
        <button
          type="button"
          onClick={toggle}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm"
          style={{ color: 'var(--text-secondary)' }}
        >
          {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          {!collapsed && <span>Theme</span>}
        </button>
        {address && (
          <button
            type="button"
            onClick={disconnect}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm"
            style={{ color: 'var(--red)' }}
          >
            <LogOut className="w-4 h-4" />
            {!collapsed && <span>Disconnect</span>}
          </button>
        )}
        {!address && !collapsed && (
          <button
            type="button"
            onClick={() => connect()}
            disabled={isConnecting}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-semibold disabled:opacity-60"
            style={{ color: 'var(--accent)' }}
          >
            <Wallet className="w-4 h-4" />
            {isConnecting ? 'Connecting…' : 'Connect Wallet'}
          </button>
        )}
        <button
          type="button"
          onClick={() => setCollapsed(!collapsed)}
          className="w-full flex items-center justify-center py-2 rounded-xl"
          style={{ color: 'var(--text-muted)' }}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>
    </motion.aside>
  );
}
