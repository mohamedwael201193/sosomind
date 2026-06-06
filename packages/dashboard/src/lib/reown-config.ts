'use client';

import { createAppKit } from '@reown/appkit/react';
import { EthersAdapter } from '@reown/appkit-adapter-ethers';
import { defineChain, mainnet } from '@reown/appkit/networks';

export const REOWN_PROJECT_ID =
  process.env.NEXT_PUBLIC_REOWN_PROJECT_ID ?? 'a17ffd4eb6bf1a81fcc0fe5e40c1b3b9';

/** SoDEX / ValueChain testnet — chainId 138565 */
export const valueChainTestnet = defineChain({
  id: 138565,
  chainNamespace: 'eip155',
  caipNetworkId: 'eip155:138565',
  name: 'ValueChain Testnet',
  nativeCurrency: { name: 'SOSO', symbol: 'SOSO', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://testnet.valuechain.xyz'] },
  },
  blockExplorers: {
    default: { name: 'ValueChain Scan', url: 'https://testnet-scan.valuechain.xyz' },
  },
});

const metadata = {
  name: 'SoSoMind',
  description: 'The Trustworthy Agentic Trading Loop — SoSoValue intelligence + SoDEX execution',
  url: 'https://sosomind.vercel.app',
  icons: ['https://sosomind.vercel.app/logo.png'],
};

let initialized = false;

/** Call once on client before AppKit hooks run */
export function ensureReownAppKit() {
  if (initialized || typeof window === 'undefined') return;
  initialized = true;

  createAppKit({
    adapters: [new EthersAdapter()],
    networks: [valueChainTestnet, mainnet],
    defaultNetwork: valueChainTestnet,
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
