"use client";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useWallet } from "@/context/WalletContext";
import { GlassCard } from "@/components/GlassCard";
import {
  Wallet, Copy, Check, LogOut, Link, User, Shield,
  TrendingUp, Zap, Clock, FileText, Download,
} from "lucide-react";
import { cn } from "@/lib/utils";

export default function ProfilePage() {
  const { address, profile, disconnect, generateLinkCode } = useWallet();
  const [copied, setCopied] = useState(false);
  const [linkCode, setLinkCode] = useState<string | null>(null);
  const [generatingCode, setGeneratingCode] = useState(false);
  const [taxYear, setTaxYear] = useState(new Date().getFullYear() - 1);
  const [taxLoading, setTaxLoading] = useState(false);
  const [taxError, setTaxError] = useState<string | null>(null);

  async function copyAddress() {
    if (!address) return;
    await navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleGenerateCode() {
    setGeneratingCode(true);
    try {
      const code = await generateLinkCode();
      setLinkCode(code);
    } catch {
      // ignore
    } finally {
      setGeneratingCode(false);
    }
  }

  async function handleTaxExport(format: "json" | "csv") {
    setTaxLoading(true);
    setTaxError(null);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:10000"}/api/tax/report?user_id=${address}&year=${taxYear}${format === "csv" ? "&format=csv" : ""}`);
      if (!res.ok) throw new Error(`Server error ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `tax_report_${taxYear}.${format}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setTaxError(e instanceof Error ? e.message : "Export failed");
    } finally {
      setTaxLoading(false);
    }
  }

  if (!address) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <div className="w-16 h-16 rounded-full bg-[var(--blue-soft)] flex items-center justify-center mb-4">
          <User className="w-8 h-8 text-[var(--blue)]" />
        </div>
        <h2 className="text-xl font-bold text-[var(--text-primary)] mb-2">Not connected</h2>
        <p className="text-sm text-[var(--text-muted)]">Connect your wallet to view your profile</p>
      </div>
    );
  }

  const displayName = profile?.display_name ?? `${address.slice(0, 6)}...${address.slice(-4)}`;
  const avatarText = (profile?.display_name ?? address).slice(0, 2).toUpperCase();

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      >
        <h1 className="text-2xl font-black text-[var(--text-primary)] mb-1">Profile</h1>
        <p className="text-sm text-[var(--text-muted)]">Manage your account and integrations</p>
      </motion.div>

      {/* Avatar + Identity Card */}
      <GlassCard animate padding="lg">
        <div className="flex items-start gap-5">
          {/* Avatar */}
          <div
            className="w-16 h-16 rounded-[var(--radius-lg)] flex items-center justify-center text-xl font-black text-white flex-shrink-0"
            style={{ background: "linear-gradient(135deg, var(--blue), var(--purple))" }}
          >
            {avatarText}
          </div>

          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-bold text-[var(--text-primary)] mb-1">{displayName}</h2>

            {/* Wallet address */}
            <div className="flex items-center gap-2">
              <span className="text-sm font-mono text-[var(--text-secondary)] truncate">{address}</span>
              <button
                onClick={copyAddress}
                className="flex-shrink-0 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
              >
                {copied ? <Check className="w-4 h-4 text-[var(--green)]" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>

            {profile?.telegram_chat_id && (
              <div className="flex items-center gap-1.5 mt-2 text-xs text-[var(--green)]">
                <Link className="w-3 h-3" />
                Telegram linked
              </div>
            )}
          </div>

          <button
            onClick={disconnect}
            className="flex items-center gap-2 px-3 py-2 rounded-[var(--radius-md)] text-sm text-[var(--red)] border border-[var(--red)]/20 hover:bg-[var(--red-soft)] transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Disconnect
          </button>
        </div>
      </GlassCard>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { icon: TrendingUp, label: "Win Rate", value: "—", color: "var(--green)" },
          { icon: Zap, label: "Total Signals", value: "—", color: "var(--blue)" },
          { icon: Clock, label: "Member Since", value: profile?.created_at ? new Date(profile.created_at).toLocaleDateString() : "—", color: "var(--purple)" },
        ].map((stat) => {
          const Icon = stat.icon;
          return (
            <GlassCard key={stat.label} animate padding="md">
              <div className="w-8 h-8 rounded-[var(--radius-sm)] flex items-center justify-center mb-3" style={{ background: `${stat.color}20`, color: stat.color }}>
                <Icon className="w-4 h-4" />
              </div>
              <div className="text-xl font-black text-[var(--text-primary)]">{stat.value}</div>
              <div className="text-xs text-[var(--text-muted)] mt-0.5">{stat.label}</div>
            </GlassCard>
          );
        })}
      </div>

      {/* Telegram Link */}
      <GlassCard animate padding="md">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-[var(--radius-md)] bg-[var(--blue-soft)] flex items-center justify-center flex-shrink-0">
            <Shield className="w-5 h-5 text-[var(--blue)]" />
          </div>
          <div className="flex-1">
            <h3 className="font-bold text-[var(--text-primary)] mb-1">Telegram Notifications</h3>
            <p className="text-sm text-[var(--text-secondary)] mb-4">
              Link your Telegram account to receive real-time signal alerts and portfolio updates.
            </p>

            <AnimatePresence>
              {linkCode ? (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="p-4 rounded-[var(--radius-md)] bg-[var(--blue-soft)] border border-[rgba(59,130,246,0.3)]"
                >
                  <p className="text-sm text-[var(--blue)] mb-2">Send this code to <strong>@SosoMindBot</strong>:</p>
                  <div className="flex items-center gap-2">
                    <code className="text-lg font-mono font-bold text-[var(--text-primary)] tracking-widest">{linkCode}</code>
                    <button
                      onClick={() => { navigator.clipboard.writeText(linkCode); }}
                      className="text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                  </div>
                  <p className="text-xs text-[var(--text-muted)] mt-2">This code expires in 10 minutes.</p>
                </motion.div>
              ) : (
                <button
                  onClick={handleGenerateCode}
                  disabled={generatingCode || !!profile?.telegram_chat_id}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-[var(--radius-md)] text-sm font-bold transition-all",
                    profile?.telegram_chat_id
                      ? "bg-[var(--green-soft)] text-[var(--green)] cursor-default"
                      : "text-white disabled:opacity-60"
                  )}
                  style={!profile?.telegram_chat_id ? { background: "var(--grad-brand)" } : {}}
                >
                  {profile?.telegram_chat_id ? (
                    <><Check className="w-4 h-4" /> Telegram Linked</>
                  ) : (
                    <><Link className="w-4 h-4" /> {generatingCode ? "Generating..." : "Generate Link Code"}</>
                  )}
                </button>
              )}
            </AnimatePresence>
          </div>
        </div>
      </GlassCard>

      {/* Tax Report */}
      <GlassCard animate padding="md">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-[var(--radius-md)] bg-[var(--orange)]20 flex items-center justify-center flex-shrink-0">
            <FileText className="w-5 h-5 text-[var(--orange)]" />
          </div>
          <div className="flex-1">
            <h3 className="font-bold text-[var(--text-primary)] mb-1">Tax Report</h3>
            <p className="text-sm text-[var(--text-secondary)] mb-4">
              Export your capital gains report for any tax year. Short-term and long-term gains included.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <select
                value={taxYear}
                onChange={e => setTaxYear(Number(e.target.value))}
                className="px-3 py-2 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text-primary)] text-sm focus:outline-none"
              >
                {[2025, 2024, 2023, 2022].map(y => <option key={y}>{y}</option>)}
              </select>
              <button
                onClick={() => handleTaxExport("csv")}
                disabled={taxLoading}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--green)] text-white text-sm font-semibold hover:opacity-90 disabled:opacity-50"
              >
                <Download className="w-4 h-4" /> {taxLoading ? "Exporting…" : "Export CSV"}
              </button>
              <button
                onClick={() => handleTaxExport("json")}
                disabled={taxLoading}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--surface-2)] text-[var(--text-primary)] text-sm font-semibold hover:opacity-80 disabled:opacity-50 border border-[var(--border)]"
              >
                <Download className="w-4 h-4" /> Export JSON
              </button>
            </div>
            {taxError && <div className="mt-2 text-xs text-[var(--red)]">{taxError}</div>}
          </div>
        </div>
      </GlassCard>
    </div>
  );
}
