'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { WalletProvider } from '../context/WalletContext';
import { ThemeProvider } from '../context/ThemeContext';

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
