'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetcher } from '@/lib/api';
import { useWallet } from '@/context/WalletContext';

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

export function useSetupProgress() {
  const { address, token } = useWallet();

  const accountQuery = useQuery<number>({
    queryKey: ['setup', 'accountid', address],
    enabled: Boolean(address),
    staleTime: 15_000,
    refetchInterval: address ? 15_000 : false,
    queryFn: async () => {
      const j = await fetcher(`/api/sodex/user/${address}/accountid`);
      return Number((j as { accountID?: number })?.accountID ?? 0);
    },
  });

  const balanceQuery = useQuery<{ balances?: Array<{ coin: string; total: string; locked: string }> }>({
    queryKey: ['setup', 'balances', address],
    enabled: Boolean(address),
    staleTime: 12_000,
    refetchInterval: address ? 12_000 : false,
    queryFn: () => fetcher(`/api/sodex/user/${address}/balances`),
  });

  const ordersQuery = useQuery<unknown[]>({
    queryKey: ['setup', 'orders', address],
    enabled: Boolean(address),
    staleTime: 30_000,
    queryFn: () => fetcher(`/api/sodex/user/${address}/orders/history?limit=5`),
  });

  const usdcSpot = useMemo(() => {
    const coin = (balanceQuery.data?.balances ?? []).find((b) => b.coin === 'vUSDC');
    if (!coin) return 0;
    return Math.max(0, parseFloat(coin.total) - parseFloat(coin.locked || '0'));
  }, [balanceQuery.data]);

  const hasTrade = Array.isArray(ordersQuery.data) && ordersQuery.data.length > 0;
  const accountID = accountQuery.data ?? 0;

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
        label: 'ValueChain Testnet',
        done: Boolean(address),
        href: '/profile',
      },
      {
        id: 'enable',
        label: 'Enable trading on SoDEX',
        done: accountID > 0,
        external: 'https://testnet.sodex.com/portfolio',
      },
      {
        id: 'spot',
        label: 'Fund Spot USDC',
        done: usdcSpot >= 5,
        external: 'https://testnet.sodex.com/faucet',
      },
      {
        id: 'trade',
        label: 'Place first trade',
        done: hasTrade,
        href: '/trade',
      },
    ],
    [address, token, accountID, usdcSpot, hasTrade],
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
    isLoading: Boolean(address) && (accountQuery.isLoading || balanceQuery.isLoading),
  };
}
