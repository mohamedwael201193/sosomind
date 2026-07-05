import axios, { AxiosInstance, AxiosError } from 'axios';
import * as fs from 'fs';
import * as path from 'path';

// SoSoValue OpenAPI client - fully aligned with https://sosovalue-1.gitbook.io/sosovalue-api-doc
// All responses are wrapped: { code, message, data }. We auto-unwrap.

// ===================== Rate-limit semaphore =====================
class Semaphore {
  private slots: number;
  private queue: Array<() => void> = [];
  constructor(max: number) { this.slots = max; }
  acquire(): Promise<void> {
    if (this.slots > 0) { this.slots--; return Promise.resolve(); }
    return new Promise((resolve) => this.queue.push(resolve));
  }
  release(): void {
    if (this.queue.length > 0) { const next = this.queue.shift()!; next(); }
    else this.slots++;
  }
}
const sosoSem = new Semaphore(10);
const INTER_REQUEST_MS = 100;

// ===================== Rotating file logger =====================
const LOG_DIR = path.join(process.cwd(), 'logs');
const LOG_FILE = path.join(LOG_DIR, 'sosovalue-api.log');
const MAX_LOG_BYTES = 5 * 1024 * 1024;
const MAX_LOG_COPIES = 3;
function rotateLogs(): void {
  try {
    if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });
    if (!fs.existsSync(LOG_FILE)) return;
    const stat = fs.statSync(LOG_FILE);
    if (stat.size < MAX_LOG_BYTES) return;
    for (let i = MAX_LOG_COPIES - 1; i >= 1; i--) {
      const src = `${LOG_FILE}.${i}`;
      const dst = `${LOG_FILE}.${i + 1}`;
      if (fs.existsSync(src)) fs.renameSync(src, dst);
    }
    fs.renameSync(LOG_FILE, `${LOG_FILE}.1`);
  } catch {}
}
function apiLog(method: string, url: string, status: number, ms: number, error?: string): void {
  try {
    rotateLogs();
    if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });
    const line = JSON.stringify({ ts: new Date().toISOString(), method, url, status, ms, error }) + '\n';
    fs.appendFileSync(LOG_FILE, line, 'utf8');
  } catch {}
}

// ===================== Circuit breaker state =====================
let cbFailures = 0;
let cbOpenUntil = 0;
let cbLastSuccess: Date | null = null;
let activeKeyLabel: string | null = null;
let lastFailureKind: 'rate_limit' | 'error' | null = null;
let configuredKeyCount = 0;
const CB_THRESHOLD = 5;
const CB_OPEN_MS = 60_000;
const responseCache = new Map<string, { data: any; at: number }>();
const CACHE_FALLBACK_MS = 60_000;

function isRateLimitError(err: unknown): boolean {
  const ax = err as AxiosError & { message?: string };
  const status = ax?.response?.status;
  if (status === 429) return true;
  const body = ax?.response?.data as { code?: number; message?: string } | undefined;
  if (body?.code === 402901) return true;
  const msg = String(ax?.message ?? err ?? '');
  return /402901|rate limit|too many requests/i.test(msg);
}

function shouldFailoverToNextKey(err: unknown): boolean {
  if (isRateLimitError(err)) return true;
  const status = (err as AxiosError)?.response?.status;
  if (status === 401 || status === 403) return true;
  const msg = String((err as Error)?.message ?? err ?? '');
  return /invalid.*key|unauthorized|forbidden|402901/i.test(msg);
}

function recordSuccess(keyLabel: string): void {
  cbFailures = 0;
  cbOpenUntil = 0;
  cbLastSuccess = new Date();
  activeKeyLabel = keyLabel;
  lastFailureKind = null;
}

function recordFailure(kind: 'rate_limit' | 'error'): void {
  lastFailureKind = kind;
  // Rate limits on primary should not open circuit — fallback key may still work
  if (kind === 'rate_limit') return;
  cbFailures++;
  if (cbFailures >= CB_THRESHOLD) cbOpenUntil = Date.now() + CB_OPEN_MS;
}

function isCircuitOpen(): boolean { return Date.now() < cbOpenUntil; }

// ===================== Health export =====================
export function getSoSoValueHealth(): {
  status: 'ok' | 'degraded' | 'down';
  lastSuccess: Date | null;
  errorRate: number;
  activeKey: string | null;
  lastError: 'rate_limit' | 'error' | null;
  keysConfigured: number;
  fallbackConfigured: boolean;
} {
  const recentSuccess =
    cbLastSuccess != null && Date.now() - cbLastSuccess.getTime() < 300_000;
  const hasBackupKeys = configuredKeyCount > 1;

  let status: 'ok' | 'degraded' | 'down';
  if (recentSuccess) {
    // Any configured key (primary or fallback) served a request successfully —
    // the integration is live and functioning from the user's perspective.
    status = 'ok';
  } else if (isCircuitOpen()) {
    status = hasBackupKeys ? 'degraded' : 'down';
  } else if (cbFailures === 0) {
    // No failures recorded — key is healthy even if no traffic has hit it recently
    status = 'ok';
  } else if (cbFailures <= 2 || lastFailureKind === 'rate_limit') {
    status = 'degraded';
  } else {
    status = hasBackupKeys ? 'degraded' : 'down';
  }

  const denom = cbFailures + (cbLastSuccess ? 1 : 0);
  const errorRate = denom > 0 ? cbFailures / denom : cbFailures > 0 ? 1 : 0;
  return {
    status,
    lastSuccess: cbLastSuccess,
    errorRate: Math.min(1, errorRate),
    activeKey: activeKeyLabel,
    lastError: lastFailureKind,
    keysConfigured: configuredKeyCount,
    fallbackConfigured: hasBackupKeys,
  };
}

// ===================== Retry helper =====================
async function withRetry<T>(fn: () => Promise<T>, attempts = 3, delaysMs = [200, 500, 1000]): Promise<T> {
  for (let i = 0; i < attempts; i++) {
    try {
      const result = await fn();
      return result;
    } catch (err) {
      const status = (err as AxiosError)?.response?.status;
      if (i === attempts - 1 || ![429, 502, 503].includes(status ?? 0)) throw err;
      await new Promise((r) => setTimeout(r, delaysMs[i] ?? 1000));
    }
  }
  throw new Error('withRetry: exhausted');
}

let symbolToIdCache: Map<string, string> | null = null;
let cacheLoadedAt = 0;
const CACHE_TTL_MS = 60 * 60 * 1000;

export class SoSoValueClient {
  private readonly baseURL = process.env.SOSO_BASE_URL || 'https://openapi.sosovalue.com/openapi/v1';
  private readonly keyClients: Array<{ label: string; client: AxiosInstance }>;

  constructor(keys: Array<{ label: string; key: string }>) {
    const seen = new Set<string>();
    const usable = keys.filter((k) => {
      const trimmed = k.key?.trim();
      if (!trimmed || seen.has(trimmed)) return false;
      seen.add(trimmed);
      return true;
    });
    configuredKeyCount = usable.length;
    this.keyClients = usable.map(({ label, key }) => ({
      label,
      client: axios.create({
        baseURL: this.baseURL,
        headers: {
          'x-soso-api-key': key.trim(),
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        timeout: 20000,
      }),
    }));
  }

  private unwrap<T>(data: any): T {
    if (data && typeof data === 'object' && 'code' in data && 'data' in data) {
      if (data.code === 402901) {
        const e = new Error(`SoSoValue 402901: ${data.message || 'Rate limit exceeded'}`) as AxiosError;
        (e as any).response = { status: 429, data };
        throw e;
      }
      if (data.code !== 0 && data.code !== 200) {
        throw new Error(`SoSoValue ${data.code}: ${data.message || 'error'}`);
      }
      return data.data as T;
    }
    return data as T;
  }

  // Rate-limited, retried, logged, circuit-broken request wrapper with key failover
  private async request<T>(method: 'get' | 'post', url: string, config?: any, cacheKey?: string): Promise<T> {
    if (isCircuitOpen() && cacheKey && responseCache.has(cacheKey)) {
      const cached = responseCache.get(cacheKey)!;
      if (Date.now() - cached.at < CACHE_FALLBACK_MS * 60) return cached.data as T;
    }
    if (!this.keyClients.length) {
      throw new Error('SoSoValue: no API keys configured (SOSO_API_KEY)');
    }

    await sosoSem.acquire();
    const t0 = Date.now();
    let lastErr: unknown;

    try {
      let sawRateLimit = false;
      for (let i = 0; i < this.keyClients.length; i++) {
        const { label, client } = this.keyClients[i];
        const hasNextKey = i < this.keyClients.length - 1;
        try {
          const result = await withRetry(async () => {
            const r = method === 'get'
              ? await client.get(url, config)
              : await client.post(url, config);
            return this.unwrap<T>(r.data);
          });
          const ms = Date.now() - t0;
          apiLog(method.toUpperCase(), url, 200, ms, label !== 'primary' ? `key:${label}` : undefined);
          recordSuccess(label);
          if (cacheKey) responseCache.set(cacheKey, { data: result, at: Date.now() });
          await new Promise((r) => setTimeout(r, INTER_REQUEST_MS));
          return result;
        } catch (err: unknown) {
          lastErr = err;
          const ms = Date.now() - t0;
          const status = (err as AxiosError)?.response?.status ?? 0;
          apiLog(method.toUpperCase(), url, status, ms, `${label}: ${(err as Error)?.message || err}`);
          if (isRateLimitError(err)) sawRateLimit = true;
          if (shouldFailoverToNextKey(err) && hasNextKey) continue;
          if (cacheKey && responseCache.has(cacheKey)) {
            return responseCache.get(cacheKey)!.data as T;
          }
        }
      }
      recordFailure(sawRateLimit ? 'rate_limit' : 'error');
      throw lastErr ?? new Error('SoSoValue request failed');
    } finally {
      sosoSem.release();
    }
  }

  // Resolve a token symbol (BTC, ETH, SOL...) to its numeric currency_id.
  async resolveCurrencyId(symbol: string): Promise<string> {
    const sym = symbol.trim().toLowerCase();
    if (!symbolToIdCache || Date.now() - cacheLoadedAt > CACHE_TTL_MS) {
      const list = await this.getCurrencies();
      symbolToIdCache = new Map();
      for (const c of list) {
        if (c?.symbol && c?.currency_id) symbolToIdCache.set(String(c.symbol).toLowerCase(), String(c.currency_id));
      }
      cacheLoadedAt = Date.now();
    }
    const id = symbolToIdCache.get(sym);
    if (!id) throw new Error(`Unknown SoSoValue symbol: ${symbol}`);
    return id;
  }

  // ============ MODULE 1: Currency & Pairs ============
  async getCurrencies(): Promise<any[]> {
    return this.request<any[]>('get', '/currencies', undefined, 'currencies');
  }
  async getCurrencyInfo(currencyIdOrSymbol: string): Promise<any> {
    const id = /^\d+$/.test(currencyIdOrSymbol) ? currencyIdOrSymbol : await this.resolveCurrencyId(currencyIdOrSymbol);
    return this.request<any>('get', `/currencies/${id}`, undefined, `currency:${id}`);
  }
  async getMarketSnapshot(symbol: string): Promise<any> {
    const id = await this.resolveCurrencyId(symbol);
    return this.request<any>('get', `/currencies/${id}/market-snapshot`, undefined, `snapshot:${id}`);
  }
  async getTokenEconomics(symbol: string): Promise<any> {
    const id = await this.resolveCurrencyId(symbol);
    return this.request<any>('get', `/currencies/${id}/token-economics`, undefined, `economics:${id}`);
  }
  async getKlines(symbol: string, params: { start_time?: number; end_time?: number; limit?: number } = {}): Promise<any[]> {
    const id = await this.resolveCurrencyId(symbol);
    return this.request<any[]>('get', `/currencies/${id}/klines`, { params: { limit: 100, ...params } });
  }
  async getSupply(symbol: string, params: { start_time?: number; end_time?: number; limit?: number } = {}): Promise<any[]> {
    const id = await this.resolveCurrencyId(symbol);
    return this.request<any[]>('get', `/currencies/${id}/supply`, { params: { limit: 100, ...params } });
  }
  async getPairs(symbol: string, page = 1, page_size = 50): Promise<any> {
    const id = await this.resolveCurrencyId(symbol);
    return this.request<any>('get', `/currencies/${id}/pairs`, { params: { page, page_size } });
  }
  async getSectorSpotlight(): Promise<any> {
    return this.request<any>('get', '/currencies/sector-spotlight', undefined, 'sector-spotlight');
  }
  async getCurrencyFundraising(symbol: string): Promise<any> {
    const id = await this.resolveCurrencyId(symbol);
    return this.request<any>('get', `/currencies/${id}/fundraising`, undefined, `fundraising:${id}`);
  }

  // ============ MODULE 2: ETF ============
  async getETFSummaryHistory(symbol: string, country_code = 'US', extra: { start_date?: string; end_date?: string; limit?: number } = {}): Promise<any[]> {
    return this.request<any[]>('get', '/etfs/summary-history', { params: { symbol, country_code, ...extra } });
  }
  async getETFList(symbol: string, country_code = 'US'): Promise<any[]> {
    return this.request<any[]>('get', '/etfs', { params: { symbol, country_code } }, `etf-list:${symbol}:${country_code}`);
  }
  async getETFMarketSnapshot(ticker: string): Promise<any> {
    return this.request<any>('get', `/etfs/${ticker}/market-snapshot`, undefined, `etf-snap:${ticker}`);
  }
  async getETFHistory(ticker: string, extra: { start_date?: string; end_date?: string; limit?: number } = {}): Promise<any[]> {
    return this.request<any[]>('get', `/etfs/${ticker}/history`, { params: extra });
  }

  // ============ MODULE 3: SoSoValue Index ============
  async getIndices(): Promise<any[]> {
    return this.request<any[]>('get', '/indices', undefined, 'indices');
  }
  async getIndexConstituents(ticker: string): Promise<any[]> {
    return this.request<any[]>('get', `/indices/${ticker}/constituents`, undefined, `idx-cons:${ticker}`);
  }
  async getIndexMarketSnapshot(ticker: string): Promise<any> {
    return this.request<any>('get', `/indices/${ticker}/market-snapshot`, undefined, `idx-snap:${ticker}`);
  }
  async getIndexKlines(ticker: string, extra: { start_time?: number; end_time?: number; limit?: number } = {}): Promise<any[]> {
    return this.request<any[]>('get', `/indices/${ticker}/klines`, { params: extra });
  }

  // ============ MODULE 4: Crypto Stocks ============
  async getCryptoStockList(): Promise<any[]> {
    return this.request<any[]>('get', '/crypto-stocks', undefined, 'crypto-stocks');
  }
  async getCryptoStockSnapshot(ticker: string): Promise<any> {
    return this.request<any>('get', `/crypto-stocks/${ticker}/market-snapshot`, undefined, `cs-snap:${ticker}`);
  }
  async getCryptoStockMarketCap(ticker: string, extra: { start_date?: string; end_date?: string; limit?: number } = {}): Promise<any[]> {
    return this.request<any[]>('get', `/crypto-stocks/${ticker}/market-cap`, { params: extra });
  }
  async getCryptoStockKlines(ticker: string, extra: { start_time?: number; end_time?: number; limit?: number } = {}): Promise<any[]> {
    return this.request<any[]>('get', `/crypto-stocks/${ticker}/klines`, { params: extra });
  }
  async getCryptoStockSectors(): Promise<any[]> {
    return this.request<any[]>('get', '/crypto-stocks/sector', undefined, 'cs-sectors');
  }
  async getCryptoSectorIndex(sector_name: string, extra: { start_date?: string; end_date?: string; limit?: number } = {}): Promise<any[]> {
    return this.request<any[]>('get', `/crypto-stocks/sector/${sector_name}/index`, { params: extra });
  }

  // ============ MODULE 5: BTC Treasuries ============
  async getBTCTreasuries(): Promise<any[]> {
    return this.request<any[]>('get', '/btc-treasuries', undefined, 'btc-treasuries');
  }
  async getBTCPurchaseHistory(ticker: string, extra: { start_date?: string; end_date?: string; limit?: number } = {}): Promise<any[]> {
    return this.request<any[]>('get', `/btc-treasuries/${ticker}/purchase-history`, { params: extra });
  }

  // ============ MODULE 6: Feeds / News ============
  async getNewsFeed(extra: { category?: string; language?: string; currency_id?: string; project_id?: string; page?: number; page_size?: number; start_time?: number; end_time?: number } = {}): Promise<any> {
    return this.request<any>('get', '/news', { params: { page: 1, page_size: 20, ...extra } });
  }
  async getHotNews(extra: { page?: number; page_size?: number; language?: string; start_time?: number; end_time?: number } = {}): Promise<any> {
    return this.request<any>('get', '/news/hot', { params: { page: 1, page_size: 20, ...extra } }, 'news-hot');
  }
  async getFeaturedNews(page = 1, page_size = 20, language?: string): Promise<any> {
    return this.request<any>('get', '/news/featured', { params: { page, page_size, ...(language ? { language } : {}) } });
  }
  async searchNews(keyword: string, extra: { page?: number; page_size?: number; category?: number; sort?: string } = {}): Promise<any> {
    return this.request<any>('get', '/news/search', { params: { keyword, page: 1, page_size: 20, ...extra } });
  }

  // ============ MODULE 7: Fundraising ============
  async getFundraisingProjects(extra: { page?: number; page_size?: number } = {}): Promise<any> {
    return this.request<any>('get', '/fundraising/projects', { params: { page: 1, page_size: 50, ...extra } }, 'fundraising-projects');
  }
  async getFundraisingProjectDetail(project_id: string): Promise<any> {
    return this.request<any>('get', `/fundraising/projects/${project_id}`);
  }

  // ============ MODULE 8: Macro ============
  async getMacroEvents(): Promise<any[]> {
    return this.request<any[]>('get', '/macro/events', undefined, 'macro-events');
  }
  async getMacroHistory(event: string, extra: { start_date?: string; end_date?: string; limit?: number } = {}): Promise<any[]> {
    return this.request<any[]>('get', `/macro/events/${encodeURIComponent(event)}/history`, { params: extra });
  }

  // ============ MODULE 9: Analysis Charts ============
  async getAnalysisCharts(): Promise<any[]> {
    return this.request<any[]>('get', '/analyses', undefined, 'analyses');
  }
  async getAnalysisChartData(chart_name: string, extra: { start_time?: number; end_time?: number; limit?: number } = {}): Promise<any[]> {
    return this.request<any[]>('get', `/analyses/${chart_name}`, { params: extra }, `analysis:${chart_name}`);
  }

  // ============ Multi-source synthesis ============
  async getFullMarketIntelligence(symbol: string): Promise<any> {
    const safe = async <T>(p: Promise<T>): Promise<T | null> => p.catch(() => null);
    const sym = symbol.toUpperCase();
    const etfList = await safe(this.getETFList(sym, 'US'));
    const firstEtf = Array.isArray(etfList) && etfList[0]?.ticker ? etfList[0].ticker : null;
    const [snapshot, economics, hotNews, searchNewsRes, sectors, etfHistory, macros, analyses] = await Promise.all([
      safe(this.getMarketSnapshot(sym)),
      safe(this.getTokenEconomics(sym)),
      safe(this.getHotNews({ page_size: 5 })),
      safe(this.searchNews(sym, { page_size: 8 })),
      safe(this.getSectorSpotlight()),
      firstEtf ? safe(this.getETFHistory(firstEtf, { limit: 7 })) : Promise.resolve(null),
      safe(this.getMacroEvents()),
      safe(this.getAnalysisCharts()),
    ]);
    return { symbol: sym, snapshot, economics, hotNews, searchNews: searchNewsRes, sectors, etfList, etfHistory, macros, analyses };
  }
}

/** Collect up to 3 SoSoValue API keys (deduped). Order = failover priority. */
export function collectSoSoApiKeys(): Array<{ label: string; key: string }> {
  const listEnv = process.env.SOSO_API_KEYS?.split(',').map((k) => k.trim()).filter(Boolean);
  if (listEnv?.length) {
    return listEnv.map((key, i) => ({ label: i === 0 ? 'primary' : `fallback_${i}`, key }));
  }

  const keys: Array<{ label: string; key: string }> = [];
  const add = (label: string, value: string | undefined) => {
    const k = value?.trim();
    if (!k) return;
    if (keys.some((x) => x.key === k)) return;
    keys.push({ label, key: k });
  };
  add('primary', process.env.SOSO_API_KEY);
  add('fallback', process.env.SOSO_API_KEY_FALLBACK);
  add('fallback_2', process.env.SOSO_API_KEY_FALLBACK_2);
  return keys;
}

function buildSoSoValueClient(): SoSoValueClient {
  return new SoSoValueClient(collectSoSoApiKeys());
}

export const sosovalue = buildSoSoValueClient();

/** Lightweight live probe — single /macro/events call (no currency resolve). */
export async function probeSoSoValueConnection(): Promise<ReturnType<typeof getSoSoValueHealth>> {
  try {
    await sosovalue.getMacroEvents();
  } catch {
    /* recordSuccess/Failure updated inside client */
  }
  return getSoSoValueHealth();
}
