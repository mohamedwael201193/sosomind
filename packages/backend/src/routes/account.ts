import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler, validate, cached } from '../utils/http.js';
import { wrapMeta } from '../utils/responseMeta.js';
import { getSodexClientFromRequest } from '../clients/sodex.js';
import { resolveProfileFromRequest, publicProfileSummary } from '../config/environment.js';

const router = Router();
const addressSchema = z.object({ address: z.string().regex(/^0x[0-9a-fA-F]{40}$/) });

function parseUsdcAvailable(balances: Array<{ coin?: string; total?: string; locked?: string; free?: string }> | undefined) {
  const row = (balances ?? []).find((b) => (b.coin ?? '').toUpperCase() === 'VUSDC' || b.coin === 'vUSDC');
  if (!row) return 0;
  const total = parseFloat(row.total ?? '0');
  const locked = parseFloat(row.locked ?? '0');
  const free = row.free != null ? parseFloat(row.free) : total - locked;
  return Math.max(0, free);
}

router.get('/status',
  validate(addressSchema, 'query'),
  asyncHandler(async (req, res) => {
    const { address } = (req as any).validated;
    const env = resolveProfileFromRequest(req);
    const client = getSodexClientFromRequest(req);
    const addr = address.toLowerCase();
    const cacheKey = `acct:status:${env.id}:${addr}`;

    const payload = await cached(cacheKey, 8, async () => {
      const [state, spotBalances, perpsBalances, accountID] = await Promise.all([
        client.getAccountStateForAddress(addr).catch(() => null),
        client.getSpotBalancesForAddress(addr).catch(() => null),
        client.getPerpsBalancesForAddress(addr).catch(() => null),
        client.getAccountIDForAddress(addr),
      ]);

      const spotRows = spotBalances?.balances ?? spotBalances?.data?.balances ?? [];
      const perpsRows = perpsBalances?.balances ?? perpsBalances?.data?.balances ?? [];
      const spotUsdc = parseUsdcAvailable(spotRows);
      const perpsUsdc = parseUsdcAvailable(perpsRows);

      return {
        address: addr,
        environment: publicProfileSummary(env),
        accountID,
        tradingEnabled: accountID > 0,
        spot: {
          usdcAvailable: spotUsdc,
          funded: spotUsdc >= env.minDepositUsd,
          balances: spotRows,
        },
        perps: {
          usdcAvailable: perpsUsdc,
          funded: perpsUsdc > 0,
          balances: perpsRows,
        },
        state,
      };
    });

    res.json(wrapMeta(payload, { ttlMs: 8_000, source: 'live' }));
  }),
);

router.get('/funding',
  validate(addressSchema, 'query'),
  asyncHandler(async (req, res) => {
    const { address } = (req as any).validated;
    const env = resolveProfileFromRequest(req);
    const client = getSodexClientFromRequest(req);
    const addr = address.toLowerCase();

    const status = await cached(`acct:funding:${env.id}:${addr}`, 8, async () => {
      const [accountID, spotBalances] = await Promise.all([
        client.getAccountIDForAddress(addr),
        client.getSpotBalancesForAddress(addr).catch(() => null),
      ]);
      const spotRows = spotBalances?.balances ?? spotBalances?.data?.balances ?? [];
      const spotUsdc = parseUsdcAvailable(spotRows);
      const evmFunding = (spotRows as any[]).filter((b) =>
        !['VUSDC', 'vUSDC'].includes(String(b.coin ?? '')),
      );

      return {
        address: addr,
        environment: publicProfileSummary(env),
        accountID,
        tradingEnabled: accountID > 0,
        spotUsdc,
        minDepositUsd: env.minDepositUsd,
        spotFunded: spotUsdc >= env.minDepositUsd,
        faucetAvailable: env.faucetAvailable,
        depositCopy: env.depositCopy,
        sodexAppUrl: env.sodexAppUrl,
        depositUrl: env.isTestnet
          ? `${env.sodexAppUrl}/faucet`
          : `${env.sodexAppUrl}/portfolio`,
        portfolioUrl: `${env.sodexAppUrl}/portfolio`,
        evmFundingAssets: evmFunding,
        nextSteps: accountID <= 0
          ? ['Connect wallet on SoDEX', 'Accept terms and enable trading']
          : spotUsdc < env.minDepositUsd
            ? env.faucetAvailable
              ? ['Claim testnet assets', 'Transfer EVM-Funding to Spot', 'Enable gas-free trading if prompted']
              : ['Deposit supported assets', 'Wait for Spot balance to update', 'Transfer Spot to Futures if trading perps']
            : ['Review Spot balance', 'Place a trade or manage portfolio'],
      };
    });

    res.json(wrapMeta(status, { ttlMs: 8_000, source: 'live' }));
  }),
);

export default router;
