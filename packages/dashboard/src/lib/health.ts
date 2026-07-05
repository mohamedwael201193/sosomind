import { API_URL } from './env';

export type ServiceStatus = 'up' | 'down' | 'warn' | 'loading';

export interface HealthSnapshot {
  api: ServiceStatus;
  ws: ServiceStatus;
  soso: ServiceStatus;
  sodex: ServiceStatus;
  wsConnections: number;
  updatedAt: Date | null;
}

async function fetchWithRetry(url: string, attempts = 3, timeoutMs = 12_000): Promise<Response> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
      if (r.ok || r.status < 500) return r;
      lastErr = new Error(`HTTP ${r.status}`);
    } catch (e) {
      lastErr = e;
      if (i < attempts - 1) {
        await new Promise((res) => setTimeout(res, 800 * (i + 1)));
      }
    }
  }
  throw lastErr;
}

export async function fetchLiveHealth(): Promise<HealthSnapshot> {
  try {
    const r = await fetchWithRetry(`${API_URL}/api/health/live`);
    const json = await r.json();
    const ws = json?.services?.websocket;
    const sv = json?.services?.sosovalue?.status;
    const sd = json?.services?.sodex?.status;
    return {
      api: r.ok ? 'up' : 'down',
      ws: ws?.status === 'ok' || ws?.status === 'running' ? 'up' : ws?.status === 'degraded' ? 'warn' : 'down',
      wsConnections: ws?.connections ?? 0,
      soso: sv === 'down' ? 'down' : sv === 'degraded' ? 'warn' : 'up',
      sodex: sd === 'ok' ? 'up' : sd === 'down' ? 'down' : 'warn',
      updatedAt: new Date(),
    };
  } catch {
    return {
      api: 'down',
      ws: 'down',
      soso: 'down',
      sodex: 'down',
      wsConnections: 0,
      updatedAt: new Date(),
    };
  }
}
