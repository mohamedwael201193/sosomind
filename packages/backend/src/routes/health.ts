import { Router } from 'express';
import { probeSoSoValueConnection } from '../clients/sosovalue';
import { getSoDexHealth } from '../clients/sodex';
import { aiProviderStatus, hasAI } from '../clients/ai';
import { supabase } from '../db/supabase';
import { getWsStats } from '../ws/server';

const router = Router();

let sosoProbeCache: { at: number; health: Awaited<ReturnType<typeof probeSoSoValueConnection>> } | null = null;

async function resolveSoSoValueHealth() {
  if (sosoProbeCache && Date.now() - sosoProbeCache.at < 30_000) {
    return sosoProbeCache.health;
  }
  const health = await probeSoSoValueConnection();
  sosoProbeCache = { at: Date.now(), health };
  return health;
}

router.get('/', async (_req, res) => {
  const mem = process.memoryUsage();
  const memUsedMB = Math.round(mem.heapUsed / 1024 / 1024);
  const memTotalMB = Math.round(mem.heapTotal / 1024 / 1024);

  const sosoHealth = await resolveSoSoValueHealth();
  const sodexHealth = getSoDexHealth();
  const aiStatus = aiProviderStatus();

  // Check Supabase connectivity
  let supabaseStatus: 'ok' | 'degraded' | 'down' = 'ok';
  let tablesReady = false;
  try {
    const { error } = await supabase.from('signals').select('id').limit(1);
    if (!error) { supabaseStatus = 'ok'; tablesReady = true; }
    else supabaseStatus = 'degraded';
  } catch {
    supabaseStatus = 'down';
  }

  // Check Telegram bot
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
      activeProvider: aiStatus.find((p: any) => p.available)?.name ?? null,
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
      return { status: ws.running ? 'ok' : 'down', port: ws.port, connections: ws.connections, channels: ws.channels };
    })(),
  };

  // Only core infra failures are "unhealthy". SoSoValue/Binance fallbacks keep the app usable.
  const criticalDown = ['backend', 'supabase', 'sodex', 'websocket'].some(
    (k) => (services as Record<string, { status?: string }>)[k]?.status === 'down',
  );
  const anyDegraded = Object.values(services).some(
    (s: any) => s.status === 'degraded' || s.status === 'down' || s.status === 'unconfigured',
  );
  const overallStatus = criticalDown ? 'unhealthy' : anyDegraded ? 'degraded' : 'healthy';

  res.json({
    status: overallStatus,
    timestamp: new Date().toISOString(),
    uptime: Math.round(process.uptime()),
    version: '1.0.0',
    services,
  });
});

export default router;
