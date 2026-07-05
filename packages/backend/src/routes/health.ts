import { Router } from 'express';
import { probeSoSoValueConnection } from '../clients/sosovalue';
import { getSoDexHealth } from '../clients/sodex';
import { aiProviderStatus, hasAI } from '../clients/ai';
import { supabase } from '../db/supabase';
import { getWsStats } from '../ws/server';

const router = Router();

let sosoProbeCache: { at: number; health: Awaited<ReturnType<typeof probeSoSoValueConnection>> } | null = null;

type HealthPayload = {
  status: string;
  timestamp: string;
  uptime: number;
  version: string;
  services: Record<string, unknown>;
};

let cachedFullHealth: { at: number; payload: HealthPayload } | null = null;
let fullRefreshInFlight = false;

async function resolveSoSoValueHealth() {
  if (sosoProbeCache && Date.now() - sosoProbeCache.at < 45_000) {
    return sosoProbeCache.health;
  }
  const health = await probeSoSoValueConnection();
  sosoProbeCache = { at: Date.now(), health };
  return health;
}

async function buildFullHealth(): Promise<HealthPayload> {
  const mem = process.memoryUsage();
  const memUsedMB = Math.round(mem.heapUsed / 1024 / 1024);
  const memTotalMB = Math.round(mem.heapTotal / 1024 / 1024);

  const sosoHealth = await resolveSoSoValueHealth();
  const sodexHealth = getSoDexHealth();
  const aiStatus = aiProviderStatus();

  let supabaseStatus: 'ok' | 'degraded' | 'down' = 'ok';
  let tablesReady = false;
  try {
    const { error } = await supabase.from('signals').select('id').limit(1);
    if (!error) { supabaseStatus = 'ok'; tablesReady = true; }
    else supabaseStatus = 'degraded';
  } catch {
    supabaseStatus = 'down';
  }

  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const telegramConfigured = Boolean(botToken);

  const services = {
    backend: {
      status: 'ok',
      memory: { usedMB: memUsedMB, totalMB: memTotalMB, percent: Math.round((memUsedMB / memTotalMB) * 100) },
    },
    sosovalue: {
      status: sosoHealth.status,
      lastSuccess: sosoHealth.lastSuccess,
      errorRate: sosoHealth.errorRate,
      activeKey: sosoHealth.activeKey,
      lastError: sosoHealth.lastError,
      keysConfigured: sosoHealth.keysConfigured,
      fallbackConfigured: sosoHealth.fallbackConfigured,
      modulesAvailable: 9,
    },
    sodex: {
      status: sodexHealth.status,
      lastSuccess: sodexHealth.lastSuccess,
      latencyMs: sodexHealth.latencyMs,
      chainId: parseInt(process.env.SODEX_CHAIN_ID || '138565', 10),
      network: (process.env.SODEX_CHAIN_ID || '138565') === '138565' ? 'testnet' : 'mainnet',
    },
    ai: {
      status: hasAI() ? 'ok' : 'down',
      providers: aiStatus,
      activeProvider: aiStatus.find((p: { available?: boolean; name?: string }) => p.available)?.name ?? null,
    },
    supabase: {
      status: supabaseStatus,
      tablesReady,
    },
    telegram: {
      status: telegramConfigured ? 'ok' : 'unconfigured',
      botUsername: '@SosoMindbot',
      configured: telegramConfigured,
    },
    websocket: (() => {
      const ws = getWsStats();
      return { status: ws.running ? 'ok' : 'down', port: ws.port, path: ws.path, connections: ws.connections, channels: ws.channels };
    })(),
  };

  const criticalDown = ['backend', 'supabase', 'sodex', 'websocket'].some(
    (k) => (services as Record<string, { status?: string }>)[k]?.status === 'down',
  );
  const anyDegraded = Object.values(services).some(
    (s: { status?: string }) => s.status === 'degraded' || s.status === 'down' || s.status === 'unconfigured',
  );
  const overallStatus = criticalDown ? 'unhealthy' : anyDegraded ? 'degraded' : 'healthy';

  return {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    uptime: Math.round(process.uptime()),
    version: '1.0.0',
    services,
  };
}

function scheduleFullRefresh(force = false) {
  if (fullRefreshInFlight) return;
  const stale = !cachedFullHealth || Date.now() - cachedFullHealth.at > 45_000;
  if (!force && !stale) return;
  fullRefreshInFlight = true;
  buildFullHealth()
    .then((payload) => {
      cachedFullHealth = { at: Date.now(), payload };
    })
    .catch((e) => console.warn('[health] refresh failed:', (e as Error).message))
    .finally(() => { fullRefreshInFlight = false; });
}

/** Ultra-fast liveness — no external probes. Used by dashboard status bar. */
router.get('/live', (_req, res) => {
  const ws = getWsStats();
  const sodexHealth = getSoDexHealth();
  const soso = sosoProbeCache?.health;
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: Math.round(process.uptime()),
    services: {
      backend: { status: 'ok' },
      websocket: {
        status: ws.running ? 'ok' : 'down',
        connections: ws.connections,
        path: ws.path,
      },
      sosovalue: {
        status: soso?.status ?? 'degraded',
        lastSuccess: soso?.lastSuccess ?? null,
      },
      sodex: {
        status: sodexHealth.status,
        latencyMs: sodexHealth.latencyMs,
      },
    },
  });
  scheduleFullRefresh();
});

router.get('/', async (_req, res) => {
  if (!cachedFullHealth) {
    try {
      const payload = await buildFullHealth();
      cachedFullHealth = { at: Date.now(), payload };
      return res.json(payload);
    } catch (e) {
      return res.status(503).json({ status: 'unhealthy', error: (e as Error).message });
    }
  }

  scheduleFullRefresh();
  res.json(cachedFullHealth.payload);
});

export default router;
