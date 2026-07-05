/** Client env — Vite uses VITE_* prefix. Legacy NEXT_PUBLIC_* supported at build via define if needed. */
const env = import.meta.env;

export const API_URL =
  (env.VITE_API_URL as string | undefined) ||
  (env.VITE_BACKEND_URL as string | undefined) ||
  'https://sosomind-backend.onrender.com';

export const WS_URL = (env.VITE_WS_URL as string | undefined) || '';

export const REOWN_PROJECT_ID =
  (env.VITE_REOWN_PROJECT_ID as string | undefined) || 'a17ffd4eb6bf1a81fcc0fe5e40c1b3b9';

export const APP_ORIGIN =
  (env.VITE_APP_ORIGIN as string | undefined) || 'https://sosomind.vercel.app';

export const DEFAULT_ENVIRONMENT =
  (env.VITE_DEFAULT_ENVIRONMENT as 'testnet' | 'mainnet' | undefined) || 'mainnet';
