'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import dynamic from 'next/dynamic';
import { useState } from 'react';
import { ThemeProvider } from '../context/ThemeContext';

/** Reown AppKit must not SSR — avoids Solana/Coinbase optional deps at build time */
const WalletProvider = dynamic(
  () => import('../context/WalletContext').then((m) => m.WalletProvider),
  { ssr: false },
);

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(() => new QueryClient({
    defaultOptions: { queries: { staleTime: 30_000, refetchOnWindowFocus: false, retry: 1 } },
  }));
  return (
    <ThemeProvider>
      <QueryClientProvider client={client}>
        <WalletProvider>
          {children}
        </WalletProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
