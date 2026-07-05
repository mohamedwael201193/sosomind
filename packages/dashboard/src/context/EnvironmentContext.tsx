'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetcher } from '@/lib/api';
import {
  chainIdForSelector,
  ENV_STORAGE_KEY,
  readStoredEnvironment,
  type EnvironmentConfigResponse,
  type EnvironmentSelector,
} from '@/lib/environment';
import { clearRelayInfoCache } from '@/lib/sodex-client';

interface EnvironmentContextValue {
  selector: EnvironmentSelector;
  chainId: number;
  config: EnvironmentConfigResponse | null;
  isLoading: boolean;
  setSelector: (next: EnvironmentSelector) => void;
}

const EnvironmentContext = createContext<EnvironmentContextValue>({
  selector: 'mainnet',
  chainId: 286623,
  config: null,
  isLoading: true,
  setSelector: () => {},
});

export function EnvironmentProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [selector, setSelectorState] = useState<EnvironmentSelector>(() => readStoredEnvironment());

  const configQuery = useQuery<EnvironmentConfigResponse>({
    queryKey: ['config', 'environment', selector],
    staleTime: 30_000,
    queryFn: async () => {
      const raw = await fetcher('/api/config/environment');
      return raw as EnvironmentConfigResponse;
    },
  });

  const setSelector = useCallback((next: EnvironmentSelector) => {
    setSelectorState(next);
    if (typeof window !== 'undefined') {
      localStorage.setItem(ENV_STORAGE_KEY, next);
    }
    clearRelayInfoCache();
    queryClient.invalidateQueries({ queryKey: ['config'] });
    queryClient.invalidateQueries({ queryKey: ['setup'] });
    queryClient.invalidateQueries({ queryKey: ['sodex'] });
    queryClient.invalidateQueries({ queryKey: ['account'] });
  }, [queryClient]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(ENV_STORAGE_KEY, selector);
  }, [selector]);

  const value = useMemo<EnvironmentContextValue>(() => ({
    selector,
    chainId: chainIdForSelector(selector),
    config: configQuery.data ?? null,
    isLoading: configQuery.isLoading,
    setSelector,
  }), [selector, configQuery.data, configQuery.isLoading, setSelector]);

  return (
    <EnvironmentContext.Provider value={value}>
      {children}
    </EnvironmentContext.Provider>
  );
}

export function useEnvironment() {
  return useContext(EnvironmentContext);
}
