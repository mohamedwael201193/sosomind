'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchWithMeta } from '@/lib/api';
import { useWallet } from '@/context/WalletContext';
import { useEnvironment } from '@/context/EnvironmentContext';

export type SetupStepId =
  | 'connect'
  | 'network'
  | 'enable'
  | 'spot'
  | 'trade';

export interface SetupStep {
  id: SetupStepId;
  label: string;
  done: boolean;
  href?: string;
  external?: string;
}

interface AccountStatus {
  accountID: number;
  tradingEnabled: boolean;
  minDepositUsd?: number;
  spot: { usdcAvailable: number; funded: boolean };
  environment: { label: string; chainId: number; isTestnet: boolean; sodexAppUrl: string; faucetAvailable: boolean; minDepositUsd: number };
}

export function useSetupProgress() {
  const { address, token } = useWallet();
  const { selector, chainId } = useEnvironment();

  const statusQuery = useQuery<AccountStatus>({
    queryKey: ['setup', 'status', selector, address],
    enabled: Boolean(address),
    staleTime: 12_000,
    refetchInterval: address ? 15_000 : false,
    queryFn: async () => {
      const { data } = await fetchWithMeta<AccountStatus>(`/api/account/status?address=${address}`);
      return data;
    },
  });

  const ordersQuery = useQuery<unknown[]>({
    queryKey: ['setup', 'orders', selector, address],
    enabled: Boolean(address),
    staleTime: 30_000,
    queryFn: async () => {
      const rows = await fetchWithMeta<unknown[]>(`/api/sodex/user/${address}/orders/history?limit=5`);
      return Array.isArray(rows.data) ? rows.data : [];
    },
  });

  const env = statusQuery.data?.environment;
  const usdcSpot = statusQuery.data?.spot?.usdcAvailable ?? 0;
  const minDeposit = statusQuery.data?.minDepositUsd ?? env?.minDepositUsd ?? 1;
  const sodexUrl = env?.sodexAppUrl ?? (selector === 'testnet' ? 'https://testnet.sodex.com' : 'https://sodex.com');
  const hasTrade = Array.isArray(ordersQuery.data) && ordersQuery.data.length > 0;
  const accountID = statusQuery.data?.accountID ?? 0;
  const networkLabel = env?.isTestnet ? 'ValueChain Testnet' : 'ValueChain Mainnet';

  const steps: SetupStep[] = useMemo(
    () => [
      {
        id: 'connect',
        label: 'Connect wallet',
        done: Boolean(address && token),
        href: '/profile',
      },
      {
        id: 'network',
        label: networkLabel,
        done: Boolean(address),
        href: '/account',
      },
      {
        id: 'enable',
        label: 'Enable trading on SoDEX',
        done: accountID > 0,
        external: `${sodexUrl}/portfolio`,
      },
      {
        id: 'spot',
        label: 'Fund Spot USDC',
        done: usdcSpot >= minDeposit,
        external: env?.faucetAvailable ? `${sodexUrl}/faucet` : `${sodexUrl}/portfolio`,
      },
      {
        id: 'trade',
        label: 'Place first trade',
        done: hasTrade,
        href: '/trade',
      },
    ],
    [address, token, accountID, usdcSpot, hasTrade, networkLabel, sodexUrl, minDeposit, env?.faucetAvailable],
  );

  const completedCount = steps.filter((s) => s.done).length;
  const isComplete = completedCount === steps.length;
  const nextStep = steps.find((s) => !s.done) ?? null;

  return {
    steps,
    completedCount,
    totalSteps: steps.length,
    isComplete,
    nextStep,
    accountID,
    usdcSpot,
    chainId,
    isLoading: Boolean(address) && statusQuery.isLoading,
  };
}
