"use client";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { fetcher } from "@/lib/api";
import { GlassCard } from "@/components/GlassCard";
import { Activity, CheckCircle, AlertTriangle, XCircle, RefreshCw, Cpu, Database, Bot, Wifi, Zap, TrendingUp } from "lucide-react";

interface ServiceStatus {
  status: "ok" | "degraded" | "down" | "unconfigured";
  [key: string]: any;
}

interface HealthData {
  status: "healthy" | "degraded" | "unhealthy";
  timestamp: string;
  uptime: number;
  version: string;
  services: Record<string, ServiceStatus>;
}

const STATUS_CONFIG = {
  ok: { icon: <CheckCircle className="w-4 h-4" />, color: "var(--green)", label: "Operational" },
  healthy: { icon: <CheckCircle className="w-4 h-4" />, color: "var(--green)", label: "Healthy" },
  degraded: { icon: <AlertTriangle className="w-4 h-4" />, color: "var(--orange)", label: "Degraded" },
  down: { icon: <XCircle className="w-4 h-4" />, color: "var(--red)", label: "Down" },
  unconfigured: { icon: <AlertTriangle className="w-4 h-4" />, color: "var(--text-muted)", label: "Not Configured" },
  unhealthy: { icon: <XCircle className="w-4 h-4" />, color: "var(--red)", label: "Unhealthy" },
};

const SERVICE_ICONS: Record<string, React.ReactNode> = {
  backend: <Cpu className="w-5 h-5" />,
  sosovalue: <TrendingUp className="w-5 h-5" />,
  sodex: <Zap className="w-5 h-5" />,
  ai: <Activity className="w-5 h-5" />,
  supabase: <Database className="w-5 h-5" />,
  telegram: <Bot className="w-5 h-5" />,
  websocket: <Wifi className="w-5 h-5" />,
};

const SERVICE_LABELS: Record<string, string> = {
  backend: "Backend API",
  sosovalue: "SoSoValue Data",
  sodex: "SoDEX Exchange",
  ai: "AI Providers",
  supabase: "Supabase DB",
  telegram: "Telegram Bot",
  websocket: "WebSocket",
};

function StatusChip({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.degraded;
  return (
    <span className="flex items-center gap-1.5 text-xs font-semibold px-2 py-1 rounded-full"
      style={{ color: cfg.color, background: `${cfg.color}18`, border: `1px solid ${cfg.color}30` }}>
      {cfg.icon}
      {cfg.label}
    </span>
  );
}

function formatUptime(seconds: number) {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m ${seconds % 60}s`;
}

export default function StatusPage() {
  const { data, isLoading, refetch, isFetching, dataUpdatedAt } = useQuery<HealthData>({
    queryKey: ["health"],
    queryFn: () => fetcher("/api/health"),
    refetchInterval: 15000,
  });

  const overallCfg = STATUS_CONFIG[(data?.status ?? "degraded") as keyof typeof STATUS_CONFIG];
  const serviceEntries = data ? Object.entries(data.services) : [];
  const criticalDown = serviceEntries.filter(([k, s]) =>
    (k === 'sodex' || k === 'backend' || k === 'websocket') && s.status === 'down',
  );
  const aggregateLabel = !data
    ? 'Checking…'
    : criticalDown.length > 0
      ? 'Unhealthy — trading may be blocked'
      : data.status === 'degraded'
        ? 'Degraded — some services limited'
        : 'All core systems operational';

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-black text-[var(--text-primary)] flex items-center gap-2">
              <Activity className="w-6 h-6 text-[var(--blue)]" /> System Status
            </h1>
            <p className="text-sm text-[var(--text-muted)] mt-0.5">Real-time health of all SosoMind services</p>
          </div>
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-[var(--surface-2)] text-[var(--text-primary)] hover:opacity-80 disabled:opacity-50 transition-opacity"
          >
            <RefreshCw className={`w-4 h-4 ${isFetching ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </motion.div>

      {/* Overall status banner */}
      <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.1 }}>
        <GlassCard className="p-5" style={{ borderColor: overallCfg?.color ? `${overallCfg.color}40` : undefined }}>
          <div className="flex items-center gap-4 flex-wrap">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center"
              style={{ background: `${overallCfg?.color}20`, color: overallCfg?.color }}>
              {isLoading ? <RefreshCw className="w-6 h-6 animate-spin" /> : overallCfg?.icon}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-lg font-bold text-[var(--text-primary)]">
                {isLoading ? "Checking status…" : aggregateLabel}
              </div>
              <div className="text-sm text-[var(--text-muted)]">
                {data ? (
                  <>
                    Uptime: <span className="font-mono text-[var(--text-primary)]">{formatUptime(data.uptime)}</span>
                    {" · "}Version: <span className="font-mono text-[var(--text-primary)]">{data.version}</span>
                    {" · "}Updated: <span className="font-mono">{dataUpdatedAt ? new Date(dataUpdatedAt).toLocaleTimeString() : "—"}</span>
                  </>
                ) : "Fetching…"}
              </div>
            </div>
            {data && <StatusChip status={data.status} />}
          </div>
        </GlassCard>
      </motion.div>

      {/* Service grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {data ? Object.entries(data.services).map(([key, svc], i) => (
          <motion.div key={key}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 + i * 0.05 }}>
            <GlassCard className="p-4 h-full">
              <div className="flex items-start justify-between gap-2 mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                    style={{ background: "var(--surface-2)", color: "var(--text-muted)" }}>
                    {SERVICE_ICONS[key] ?? <Activity className="w-4 h-4" />}
                  </div>
                  <div>
                    <div className="text-sm font-bold text-[var(--text-primary)]">{SERVICE_LABELS[key] ?? key}</div>
                  </div>
                </div>
                <StatusChip status={svc.status} />
              </div>

              {/* Service-specific details */}
              <div className="space-y-1 text-xs text-[var(--text-muted)]">
                {key === "backend" && svc.memory && (
                  <div className="flex justify-between">
                    <span>Memory</span>
                    <span className="font-mono text-[var(--text-primary)]">{svc.memory.usedMB}MB / {svc.memory.totalMB}MB ({svc.memory.percent}%)</span>
                  </div>
                )}
                {key === "sosovalue" && (
                  <>
                    <div className="flex justify-between"><span>Error rate</span><span className="font-mono text-[var(--text-primary)]">{((svc.errorRate ?? 0) * 100).toFixed(1)}%</span></div>
                    <div className="flex justify-between"><span>Modules</span><span className="font-mono text-[var(--text-primary)]">{svc.modulesAvailable}</span></div>
                  </>
                )}
                {key === "sodex" && (
                  <>
                    <div className="flex justify-between"><span>Network</span><span className="font-mono text-[var(--text-primary)] capitalize">{svc.network}</span></div>
                    <div className="flex justify-between"><span>Chain ID</span><span className="font-mono text-[var(--text-primary)]">{svc.chainId}</span></div>
                    {svc.latencyMs != null && <div className="flex justify-between"><span>Latency</span><span className="font-mono text-[var(--text-primary)]">{svc.latencyMs}ms</span></div>}
                  </>
                )}
                {key === "ai" && (
                  <>
                    <div className="flex justify-between"><span>Active provider</span><span className="font-mono text-[var(--text-primary)]">{svc.activeProvider ?? "—"}</span></div>
                    <div className="flex justify-between"><span>Available</span><span className="font-mono text-[var(--text-primary)]">{(svc.providers ?? []).filter((p: any) => p.available).length} / {(svc.providers ?? []).length}</span></div>
                  </>
                )}
                {key === "supabase" && (
                  <div className="flex justify-between"><span>Tables ready</span><span className="font-mono text-[var(--text-primary)]">{svc.tablesReady ? "Yes" : "No"}</span></div>
                )}
                {key === "telegram" && (
                  <div className="flex justify-between"><span>Bot</span><span className="font-mono text-[var(--text-primary)]">{svc.botUsername}</span></div>
                )}
                {key === "websocket" && (
                  <>
                    <div className="flex justify-between"><span>Connections</span><span className="font-mono text-[var(--text-primary)]">{svc.connections ?? 0}</span></div>
                    <div className="flex justify-between"><span>Channels</span><span className="font-mono text-[var(--text-primary)]">{svc.channels && typeof svc.channels === "object" ? Object.keys(svc.channels).length : (svc.channels ?? 0)}</span></div>
                    {svc.channels && typeof svc.channels === "object" && (
                      <div className="flex justify-between"><span>Subscribers</span><span className="font-mono text-[var(--text-primary)]">{Object.values(svc.channels as Record<string, number>).reduce((a, b) => a + b, 0)}</span></div>
                    )}
                  </>
                )}
                {svc.lastSuccess && (
                  <div className="flex justify-between"><span>Last success</span><span className="font-mono text-[var(--text-primary)]">{new Date(svc.lastSuccess).toLocaleTimeString()}</span></div>
                )}
              </div>
            </GlassCard>
          </motion.div>
        )) : Array.from({ length: 7 }).map((_, i) => (
          <motion.div key={i} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.05 }}>
            <GlassCard className="p-4 h-24 animate-pulse" />
          </motion.div>
        ))}
      </div>

      {/* AI providers detail */}
      {data?.services?.ai?.providers && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
          <GlassCard className="p-4">
            <h2 className="text-sm font-bold text-[var(--text-primary)] mb-3 flex items-center gap-2">
              <Zap className="w-4 h-4 text-[var(--purple)]" /> AI Provider Cascade
            </h2>
            <div className="flex flex-wrap gap-2">
              {data.services.ai.providers.map((p: any, i: number) => (
                <div key={p.name} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
                  style={{
                    background: p.available ? "var(--green)18" : "var(--surface-2)",
                    color: p.available ? "var(--green)" : "var(--text-muted)",
                    border: `1px solid ${p.available ? "var(--green)30" : "transparent"}`,
                  }}>
                  <span className="font-mono opacity-50">{i + 1}.</span>
                  {p.name}
                  {p.available ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                </div>
              ))}
            </div>
          </GlassCard>
        </motion.div>
      )}
    </div>
  );
}
