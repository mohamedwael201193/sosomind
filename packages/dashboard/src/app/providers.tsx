'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { lazy, Suspense, useState } from 'react';
import { ThemeProvider } from '../context/ThemeContext';
import { EnvironmentProvider } from '../context/EnvironmentContext';

const WalletProvider = lazy(() =>
  import('../context/WalletContext').then((m) => ({ default: m.WalletProvider })),
);

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60_000,
            gcTime: 5 * 60_000,
            refetchOnWindowFocus: false,
            refetchOnReconnect: true,
            retry: 1,
          },
        },
      }),
  );

  return (
    <ThemeProvider>
      <QueryClientProvider client={client}>
        <EnvironmentProvider>
          <Suspense fallback={null}>
            <WalletProvider>{children}</WalletProvider>
          </Suspense>
        </EnvironmentProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
