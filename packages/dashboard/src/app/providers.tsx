'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { lazy, Suspense, useState } from 'react';
import { ThemeProvider } from '../context/ThemeContext';

const WalletProvider = lazy(() =>
  import('../context/WalletContext').then((m) => ({ default: m.WalletProvider })),
);

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 30_000, refetchOnWindowFocus: false, retry: 1 },
        },
      }),
  );

  return (
    <ThemeProvider>
      <QueryClientProvider client={client}>
        <Suspense fallback={null}>
          <WalletProvider>{children}</WalletProvider>
        </Suspense>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
