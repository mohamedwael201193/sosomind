/**
 * SoSoMind environment profiles — single source of truth for testnet/mainnet.
 * Reference: 02_SODEX_MASTER_REFERENCE.md §8, WAVE3 §6.1
 */
import type { Request } from 'express';

export type EnvironmentId =
  | 'local'
  | 'testnet'
  | 'mainnet-readonly'
  | 'mainnet-limited'
  | 'mainnet';

/** User-facing selector in dashboard Settings */
export type EnvironmentSelector = 'testnet' | 'mainnet';

export interface EnvironmentProfile {
  id: EnvironmentId;
  label: string;
  chainId: number;
  isTestnet: boolean;
  writesAllowed: boolean;
  spotRest: string;
  perpsRest: string;
  spotWs: string;
  perpsWs: string;
  valueChainRpc: string;
  valueChainWs: string;
  explorer: string;
  sodexAppUrl: string;
  minDepositUsd: number;
  maxNotionalUsd: number;
  faucetAvailable: boolean;
  depositCopy: string;
  telegramExecution: boolean;
}

const TESTNET_GATEWAY = process.env.SODEX_TESTNET_URL || 'https://testnet-gw.sodex.dev/api/v1';
const MAINNET_GATEWAY = process.env.SODEX_MAINNET_URL || 'https://mainnet-gw.sodex.dev/api/v1';

function gwBase(url: string, scope: 'spot' | 'perps') {
  const root = url.replace(/\/$/, '');
  return `${root}/${scope}`;
}

function buildProfile(
  id: EnvironmentId,
  overrides: Partial<EnvironmentProfile> & Pick<EnvironmentProfile, 'label' | 'chainId' | 'isTestnet' | 'writesAllowed'>,
): EnvironmentProfile {
  const isTestnet = overrides.isTestnet;
  const gateway = isTestnet ? TESTNET_GATEWAY : MAINNET_GATEWAY;
  const host = isTestnet ? 'testnet-gw.sodex.dev' : 'mainnet-gw.sodex.dev';
  return {
    id,
    label: overrides.label,
    chainId: overrides.chainId,
    isTestnet,
    writesAllowed: overrides.writesAllowed,
    spotRest: overrides.spotRest ?? gwBase(gateway, 'spot'),
    perpsRest: overrides.perpsRest ?? gwBase(gateway, 'perps'),
    spotWs: overrides.spotWs ?? `wss://${host}/ws/spot`,
    perpsWs: overrides.perpsWs ?? `wss://${host}/ws/perps`,
    valueChainRpc: overrides.valueChainRpc ?? (isTestnet
      ? 'https://testnet-v2.valuechain.xyz'
      : 'https://mainnet.valuechain.xyz'),
    valueChainWs: overrides.valueChainWs ?? (isTestnet
      ? 'wss://testnet-v2-ws.valuechain.xyz'
      : 'wss://mainnet-ws.valuechain.xyz'),
    explorer: overrides.explorer ?? (isTestnet
      ? 'https://test-scan.valuechain.xyz'
      : 'https://main-scan.valuechain.xyz'),
    sodexAppUrl: overrides.sodexAppUrl ?? (isTestnet
      ? 'https://testnet.sodex.com'
      : 'https://sodex.com'),
    minDepositUsd: overrides.minDepositUsd ?? 5,
    maxNotionalUsd: overrides.maxNotionalUsd ?? parseFloat(process.env.TRADING_MAX_NOTIONAL_USD || '100'),
    faucetAvailable: overrides.faucetAvailable ?? isTestnet,
    depositCopy: overrides.depositCopy ?? (isTestnet
      ? 'Use the testnet faucet, then transfer from EVM-Funding to Spot on SoDEX.'
      : 'Deposit supported assets via SoDEX. Wrong network or token can permanently lose funds.'),
    telegramExecution: overrides.telegramExecution ?? isTestnet,
  };
}

export const ENVIRONMENT_PROFILES: Record<EnvironmentId, EnvironmentProfile> = {
  local: buildProfile('local', {
    label: 'Local',
    chainId: parseInt(process.env.SODEX_CHAIN_ID || '138565', 10),
    isTestnet: (process.env.SODEX_CHAIN_ID || '138565') === '138565',
    writesAllowed: process.env.DRY_RUN !== 'true',
  }),
  testnet: buildProfile('testnet', {
    label: 'SoDEX Testnet',
    chainId: 138565,
    isTestnet: true,
    writesAllowed: true,
  }),
  'mainnet-readonly': buildProfile('mainnet-readonly', {
    label: 'Mainnet (read-only)',
    chainId: 286623,
    isTestnet: false,
    writesAllowed: false,
  }),
  'mainnet-limited': buildProfile('mainnet-limited', {
    label: 'Mainnet (limited beta)',
    chainId: 286623,
    isTestnet: false,
    writesAllowed: true,
    maxNotionalUsd: parseFloat(process.env.TRADING_MAX_NOTIONAL_USD || '100'),
  }),
  mainnet: buildProfile('mainnet', {
    label: 'Mainnet',
    chainId: 286623,
    isTestnet: false,
    writesAllowed: true,
    maxNotionalUsd: parseFloat(process.env.TRADING_MAX_NOTIONAL_USD || '500'),
  }),
};

export function getDefaultProfileId(): EnvironmentId {
  const raw = (process.env.SOSOMIND_DEFAULT_PROFILE || '').trim();
  if (raw && raw in ENVIRONMENT_PROFILES) return raw as EnvironmentId;
  const chainId = parseInt(process.env.SODEX_CHAIN_ID || '138565', 10);
  if (chainId === 286623) {
    return process.env.TRADING_ENABLED === 'false' ? 'mainnet-readonly' : 'mainnet-limited';
  }
  return 'testnet';
}

export function getProfile(id?: string | null): EnvironmentProfile {
  if (id && id in ENVIRONMENT_PROFILES) return ENVIRONMENT_PROFILES[id as EnvironmentId];
  return ENVIRONMENT_PROFILES[getDefaultProfileId()];
}

/** Map dashboard selector + optional profile hint to a concrete profile. */
export function resolveProfileFromSelector(
  selector: EnvironmentSelector,
  hint?: string | null,
): EnvironmentProfile {
  if (selector === 'testnet') return ENVIRONMENT_PROFILES.testnet;
  if (hint && hint in ENVIRONMENT_PROFILES && !hint.startsWith('testnet')) {
    return ENVIRONMENT_PROFILES[hint as EnvironmentId];
  }
  return ENVIRONMENT_PROFILES[getDefaultProfileId()];
}

export function resolveProfileFromRequest(req: Request): EnvironmentProfile {
  const header = (req.headers['x-sosomind-environment'] as string | undefined)?.trim().toLowerCase();
  if (header === 'testnet') return ENVIRONMENT_PROFILES.testnet;
  if (header === 'mainnet') return resolveProfileFromSelector('mainnet');
  if (header && header in ENVIRONMENT_PROFILES) return ENVIRONMENT_PROFILES[header as EnvironmentId];
  return getProfile();
}

export function parseAllowlist(): Set<string> {
  const raw = process.env.TRADING_ALLOWLIST || '';
  return new Set(
    raw.split(',').map((a) => a.trim().toLowerCase()).filter((a) => /^0x[0-9a-f]{40}$/.test(a)),
  );
}

export function isTradingKillSwitchActive(): boolean {
  return process.env.KILL_SWITCH_TRADING === 'true';
}

export function isWalletAllowlisted(address: string): boolean {
  const list = parseAllowlist();
  if (list.size === 0) return true;
  return list.has(address.toLowerCase());
}

export function publicProfileSummary(p: EnvironmentProfile) {
  return {
    id: p.id,
    label: p.label,
    chainId: p.chainId,
    isTestnet: p.isTestnet,
    writesAllowed: p.writesAllowed,
    spotRest: p.spotRest,
    perpsRest: p.perpsRest,
    spotWs: p.spotWs,
    perpsWs: p.perpsWs,
    valueChainRpc: p.valueChainRpc,
    explorer: p.explorer,
    sodexAppUrl: p.sodexAppUrl,
    minDepositUsd: p.minDepositUsd,
    maxNotionalUsd: p.maxNotionalUsd,
    faucetAvailable: p.faucetAvailable,
    depositCopy: p.depositCopy,
  };
}
