import axios from 'axios';

export const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:10000';

export const api = axios.create({
  baseURL: API_URL,
  timeout: 20000,
  headers: { 'Content-Type': 'application/json' },
});

export async function fetcher<T = any>(path: string): Promise<T> {
  const r = await api.get(path);
  return r.data?.data ?? r.data;
}
