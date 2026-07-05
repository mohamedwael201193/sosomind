export type EnvironmentSelector = 'testnet' | 'mainnet';

export const ENV_STORAGE_KEY = 'sosomind_environment';

export function readStoredEnvironment(): EnvironmentSelector {
  if (typeof window === 'undefined') {
    return (import.meta.env.VITE_DEFAULT_ENVIRONMENT as EnvironmentSelector) || 'mainnet';
  }
  const stored = localStorage.getItem(ENV_STORAGE_KEY);
  if (stored === 'testnet' || stored === 'mainnet') return stored;
  const fromEnv = import.meta.env.VITE_DEFAULT_ENVIRONMENT;
  if (fromEnv === 'testnet' || fromEnv === 'mainnet') return fromEnv;
  return 'mainnet';
}

export function chainIdForSelector(selector: EnvironmentSelector): number {
  return selector === 'testnet' ? 138565 : 286623;
}

export interface EnvironmentProfileSummary {
  id: string;
  label: string;
  chainId: number;
  isTestnet: boolean;
  writesAllowed: boolean;
  sodexAppUrl: string;
  minDepositUsd: number;
  maxNotionalUsd: number;
  faucetAvailable: boolean;
  depositCopy: string;
}

export interface EnvironmentConfigResponse {
  active: EnvironmentProfileSummary;
  defaultId: string;
  selectors: Array<{ id: EnvironmentSelector; label: string; chainId: number }>;
  trading: { killSwitch: boolean; allowlistSize: number; dryRun: boolean };
}
