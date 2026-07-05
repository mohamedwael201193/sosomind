import axios from 'axios';
import { API_URL } from './env';
import { ENV_STORAGE_KEY, readStoredEnvironment } from './environment';

export { API_URL };

export const api = axios.create({
  baseURL: API_URL,
  timeout: 20000,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const env = typeof window !== 'undefined'
    ? (localStorage.getItem(ENV_STORAGE_KEY) || readStoredEnvironment())
    : readStoredEnvironment();
  config.headers = config.headers ?? {};
  config.headers['X-SoSoMind-Environment'] = env;
  return config;
});

export interface ResponseMeta {
  cachedAt: string;
  ageMs: number;
  isStale: boolean;
  source: 'live' | 'cache' | 'fallback' | 'computed';
  ttlMs: number;
}

/** Backwards-compatible fetcher: unwraps `{data}` and `{data, meta}` envelopes. */
export async function fetcher<T = any>(path: string): Promise<T> {
  const r = await api.get(path);
  return r.data?.data ?? r.data;
}

/** Returns both data and meta when the backend returns a wrapped envelope. */
export async function fetchWithMeta<T = any>(path: string): Promise<{ data: T; meta?: ResponseMeta }> {
  const r = await api.get(path);
  if (r.data && typeof r.data === 'object' && 'meta' in r.data) {
    return { data: (r.data as any).data as T, meta: (r.data as any).meta as ResponseMeta };
  }
  return { data: r.data as T };
}
