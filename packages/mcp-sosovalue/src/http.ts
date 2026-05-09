import axios, { AxiosInstance } from 'axios';

const API_KEY = process.env.SOSO_API_KEY || '';
const BASE_URL = process.env.SOSO_BASE_URL || 'https://openapi.sosovalue.com/openapi/v1';

if (!API_KEY) {
  console.error('[sosovalue-mcp] SOSO_API_KEY not set');
}

export const http: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  timeout: 20000,
  headers: { 'x-soso-api-key': API_KEY, 'Content-Type': 'application/json' },
});

export async function get<T = any>(path: string, params?: Record<string, any>): Promise<T> {
  const r = await http.get(path, { params });
  return r.data?.data ?? r.data;
}
