'use client';

import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { ExternalLink, Loader2, RefreshCw, Wallet, CheckCircle2, Circle, AlertTriangle } from 'lucide-react';
import { PageHeader } from '@/components/LoadingSkeleton';
import { ConnectWallet } from '@/components/ConnectWallet';
import { useWallet } from '@/context/WalletContext';
import { useEnvironment } from '@/context/EnvironmentContext';
import { fetchWithMeta } from '@/lib/api';
import { ProductionState } from '@/components/ProductionState';

interface FundingPayload {
  address: string;
  accountID: number;
  tradingEnabled: boolean;
  spotUsdc: number;
  minDepositUsd: number;
  spotFunded: boolean;
  faucetAvailable: boolean;
  depositCopy: string;
  sodexAppUrl: string;
  depositUrl: string;
  portfolioUrl: string;
  nextSteps: string[];
  environment: { label: string; chainId: number; isTestnet: boolean };
}

export default function AccountPage() {
  const { address } = useWallet();
  const { selector, config } = useEnvironment();

  const fundingQuery = useQuery({
    queryKey: ['account', 'funding', selector, address],
    enabled: Boolean(address),
    refetchInterval: 15_000,
    queryFn: async () => {
      const { data } = await fetchWithMeta<FundingPayload>(`/api/account/funding?address=${address}`);
      return data;
    },
  });

  const statusQuery = useQuery({
    queryKey: ['account', 'status', selector, address],
    enabled: Boolean(address),
    refetchInterval: 15_000,
    queryFn: async () => {
      const { data } = await fetchWithMeta<any>(`/api/account/status?address=${address}`);
      return data;
    },
  });

  const data = fundingQuery.data;
  const active = config?.active;

  return (
    <div>
      <PageHeader
        title="Account & Funding"
        subtitle="Live SoDEX account state, funding status, and onboarding steps"
      />

      {!address ? (
        <div className="card" style={{ maxWidth: 480 }}>
          <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 16 }}>
            Connect your wallet to read real account state from SoDEX ({active?.label ?? selector}).
          </p>
          <ConnectWallet variant="full" />
        </div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14, marginBottom: 14 }}>
            <motion.div className="card" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 6 }}>Environment</div>
              <div style={{ fontSize: 16, fontWeight: 700 }}>{data?.environment?.label ?? active?.label ?? selector}</div>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>Chain {data?.environment?.chainId ?? active?.chainId}</div>
            </motion.div>
            <motion.div className="card" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 6 }}>SoDEX Account ID</div>
              <div style={{ fontSize: 16, fontWeight: 700 }}>{data?.accountID ? data.accountID : 'Not activated'}</div>
              <div style={{ fontSize: 12, color: data?.tradingEnabled ? 'var(--green)' : 'var(--muted)', marginTop: 4 }}>
                {data?.tradingEnabled ? 'Trading enabled' : 'Enable trading on SoDEX'}
              </div>
            </motion.div>
            <motion.div className="card" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 6 }}>Spot USDC</div>
              <div style={{ fontSize: 16, fontWeight: 700 }}>${(data?.spotUsdc ?? 0).toFixed(2)}</div>
              <div style={{ fontSize: 12, color: data?.spotFunded ? 'var(--green)' : 'var(--muted)', marginTop: 4 }}>
                Min ${data?.minDepositUsd ?? 5} to trade
              </div>
            </motion.div>
          </div>

          {(fundingQuery.isLoading || statusQuery.isLoading) && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, color: 'var(--muted)', fontSize: 13 }}>
              <Loader2 size={14} className="animate-spin" /> Loading live account data…
            </div>
          )}

          {fundingQuery.isError && (
            <ProductionState
              state="error"
              title="Could not load account"
              message="SoDEX account read failed. Check network selection in Settings and retry."
            />
          )}

          {data && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <motion.div className="card" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                  <Wallet size={16} style={{ color: 'var(--green)' }} />
                  <h3 style={{ fontSize: 14, fontWeight: 700 }}>Funding</h3>
                  <button
                    onClick={() => { fundingQuery.refetch(); statusQuery.refetch(); }}
                    style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)' }}
                    aria-label="Refresh"
                  >
                    <RefreshCw size={14} />
                  </button>
                </div>
                <p style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.6, marginBottom: 14 }}>
                  {data.depositCopy}
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  <a href={data.depositUrl} target="_blank" rel="noopener noreferrer" className="btn btn-primary" style={{ fontSize: 12 }}>
                    {data.faucetAvailable ? 'Open Faucet' : 'Deposit on SoDEX'} <ExternalLink size={12} />
                  </a>
                  <a href={data.portfolioUrl} target="_blank" rel="noopener noreferrer" className="btn btn-ghost" style={{ fontSize: 12 }}>
                    SoDEX Portfolio <ExternalLink size={12} />
                  </a>
                </div>
              </motion.div>

              <motion.div className="card" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                  {data.spotFunded && data.tradingEnabled ? (
                    <CheckCircle2 size={16} style={{ color: 'var(--green)' }} />
                  ) : (
                    <AlertTriangle size={16} style={{ color: 'var(--amber, #f59e0b)' }} />
                  )}
                  <h3 style={{ fontSize: 14, fontWeight: 700 }}>Next steps</h3>
                </div>
                <ol style={{ margin: 0, paddingLeft: 18, fontSize: 13, lineHeight: 1.8 }}>
                  {data.nextSteps.map((step, i) => (
                    <li key={i} style={{ color: 'var(--text)' }}>{step}</li>
                  ))}
                </ol>
              </motion.div>
            </div>
          )}

          {statusQuery.data?.spot?.balances?.length > 0 && (
            <motion.div className="card" style={{ marginTop: 14 }} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Spot balances</h3>
              <div style={{ display: 'grid', gap: 8 }}>
                {(statusQuery.data.spot.balances as any[]).filter((b) => parseFloat(b.total || '0') > 0).map((b) => (
                  <div key={b.coin} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                    <span>{b.coin}</span>
                    <span className="mono">{parseFloat(b.total).toFixed(6)}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </>
      )}
    </div>
  );
}
