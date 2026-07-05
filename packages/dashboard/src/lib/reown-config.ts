'use client';

import { createAppKit } from '@reown/appkit/react';
import { EthersAdapter } from '@reown/appkit-adapter-ethers';
import { defineChain, mainnet } from '@reown/appkit/networks';

import { REOWN_PROJECT_ID as ENV_REOWN_PROJECT_ID, APP_ORIGIN, DEFAULT_ENVIRONMENT } from './env';

export const REOWN_PROJECT_ID = ENV_REOWN_PROJECT_ID;

/** SoDEX / ValueChain testnet — chainId 138565 */
export const valueChainTestnet = defineChain({
  id: 138565,
  chainNamespace: 'eip155',
  caipNetworkId: 'eip155:138565',
  name: 'ValueChain Testnet',
  nativeCurrency: { name: 'SOSO', symbol: 'SOSO', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://testnet-v2.valuechain.xyz'] },
  },
  blockExplorers: {
    default: { name: 'ValueChain Scan', url: 'https://test-scan.valuechain.xyz' },
  },
});

/** SoDEX / ValueChain mainnet — chainId 286623 */
export const valueChainMainnet = defineChain({
  id: 286623,
  chainNamespace: 'eip155',
  caipNetworkId: 'eip155:286623',
  name: 'ValueChain',
  nativeCurrency: { name: 'SOSO', symbol: 'SOSO', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://mainnet.valuechain.xyz'] },
  },
  blockExplorers: {
    default: { name: 'ValueChain Scan', url: 'https://main-scan.valuechain.xyz' },
  },
});

export const defaultNetwork = DEFAULT_ENVIRONMENT === 'testnet' ? valueChainTestnet : valueChainMainnet;

const metadata = {
  name: 'SoSoMind',
  description: 'The Trustworthy Agentic Trading Loop — SoSoValue intelligence + SoDEX execution',
  url: APP_ORIGIN,
  icons: [`${APP_ORIGIN}/logo.png`],
};

let initialized = false;

/** Call once on client before AppKit hooks run */
export function ensureReownAppKit() {
  if (initialized || typeof window === 'undefined') return;
  initialized = true;

  createAppKit({
    adapters: [new EthersAdapter()],
    networks: [valueChainMainnet, valueChainTestnet, mainnet],
    defaultNetwork,
    metadata,
    projectId: REOWN_PROJECT_ID,
    features: {
      analytics: true,
      email: false,
      socials: false,
    },
    themeMode: 'dark',
    themeVariables: {
      '--w3m-accent': '#10b981',
    },
  });
}
