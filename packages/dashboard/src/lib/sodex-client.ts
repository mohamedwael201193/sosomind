/**
 * sodex-client — orchestrates browser-side EIP-712 signing + relay.
 *
 *   1. Build canonical action body
 *   2. Build EIP-712 typed data via lib/sodex-signing
 *   3. window.ethereum.request({method:'eth_signTypedData_v4'})
 *   4. Convert ethers sig → SoDEX wire sig
 *   5. POST to backend `/api/sodex/relay` (JWT-gated, audited)
 *
 * The backend never sees the user's private key.
 */
import {
  buildSignable,
  ethSigToWireSig,
  buildSpotBatchNewOrderBody,
  buildPerpsNewOrderBody,
  type Scope,
} from './sodex-signing';
import { getActiveWalletProvider } from './wallet-provider';

import { API_URL } from './env';

export interface RelayInfo {
  chainId: number;
  isTestnet: boolean;
  spotBase: string;
  perpsBase: string;
  allowedActions: string[];
}

let cachedInfo: Promise<RelayInfo> | null = null;
export function getRelayInfo(): Promise<RelayInfo> {
  if (!cachedInfo) {
    cachedInfo = fetch(`${API_URL}/api/sodex/relay/info`)
      .then(r => r.json())
      .catch(() => ({ chainId: 138565, isTestnet: true, spotBase: '', perpsBase: '', allowedActions: [] }));
  }
  return cachedInfo;
}

export interface SignAndSubmitArgs {
  scope: Scope;
  actionName: 'batchNewOrder' | 'batchCancelOrder' | 'newOrder' | 'cancelOrder';
  body: Record<string, unknown>;
  /** Audit metadata (also persisted) */
  market?: string;
  side?: 'buy' | 'sell';
  quantity?: number;
  price?: number;
  orderType?: 'limit' | 'market';
  source?: 'dashboard' | 'telegram' | 'api';
}

export interface RelayResult {
  ok: boolean;
  orderId?: string;
  status: string;
  sodex: unknown;
  error?: string;
}

async function signTypedDataV4(address: string, typedData: unknown): Promise<string> {
  const eth = getActiveWalletProvider();
  if (!eth) throw new Error('No wallet connected — open Connect Wallet and choose a provider');
  const json = JSON.stringify(typedData);
  return eth.request({ method: 'eth_signTypedData_v4', params: [address, json] });
}

/** Switch MetaMask to the SoDEX chain, adding it if not yet known. */
export async function ensureSoDEXChain(eth: any, targetChainId: number): Promise<void> {
  const currentHex: string = await eth.request({ method: 'eth_chainId' });
  const current = parseInt(currentHex, 16);
  if (current === targetChainId) return; // already on the right chain

  const targetHex = `0x${targetChainId.toString(16)}`;
  try {
    await eth.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: targetHex }] });
  } catch (switchErr: any) {
    // 4902 = chain not registered in MetaMask yet → try to add it
    if (switchErr.code === 4902 || switchErr.code === -32603) {
      try {
        await eth.request({
          method: 'wallet_addEthereumChain',
          params: [{
            chainId: targetHex,
            chainName: targetChainId === 138565 ? 'ValueChain Testnet' : 'ValueChain',
            nativeCurrency: { name: 'SOSO', symbol: 'SOSO', decimals: 18 },
            rpcUrls: [targetChainId === 138565 ? 'https://testnet.valuechain.xyz' : 'https://mainnet.valuechain.xyz'],
            blockExplorerUrls: [targetChainId === 138565 ? 'https://testnet-scan.valuechain.xyz' : 'https://main-scan.valuechain.xyz'],
          }],
        });
      } catch (addErr: any) {
        // MetaMask error -32602: "Could not add network that points to same RPC endpoint
        // as existing network" — chain is already registered under a different name
        // (e.g. 'ValueChain Testnet'). Just switch to it.
        const msg: string = addErr?.message ?? '';
        if (
          addErr?.code === -32602 ||
          msg.toLowerCase().includes('same rpc') ||
          msg.toLowerCase().includes('already')
        ) {
          await eth.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: targetHex }] });
        } else {
          throw addErr;
        }
      }
    } else {
      throw new Error(
        `Please switch your MetaMask network to ${targetChainId === 138565 ? 'ValueChain Testnet' : 'ValueChain'} (chainId ${targetChainId}) and retry.`
      );
    }
  }
}

export async function signAndSubmit(args: SignAndSubmitArgs): Promise<RelayResult> {
  if (typeof window === 'undefined') throw new Error('signAndSubmit must run in the browser');
  const eth = getActiveWalletProvider();
  if (!eth) throw new Error('Connect your wallet to trade');

  // Confirm wallet & chain
  const accounts: string[] = await eth.request({ method: 'eth_accounts' });
  if (!accounts.length) {
    await eth.request({ method: 'eth_requestAccounts' });
  }
  const address = (accounts[0] || (await eth.request({ method: 'eth_accounts' }))[0])?.toLowerCase();
  if (!address) throw new Error('No wallet account available');

  const info = await getRelayInfo();

  // Switch to SoDEX chain BEFORE building typed data (MetaMask validates domain.chainId === active chain)
  await ensureSoDEXChain(eth, info.chainId);

  const signable = buildSignable({
    scope: args.scope,
    actionName: args.actionName,
    body: args.body,
    chainId: info.chainId,
  });

  const ethSig = await signTypedDataV4(address, signable.typedData);
  const wireSig = ethSigToWireSig(ethSig);

  const token = (typeof window !== 'undefined') ? localStorage.getItem('sosomind_token') : null;
  if (!token) throw new Error('Not signed in — connect wallet first');

  const r = await fetch(`${API_URL}/api/sodex/relay`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      scope: args.scope,
      actionName: args.actionName,
      body: args.body,
      envelopeJson: signable.envelopeJson,
      nonce: signable.nonce,
      sig: wireSig,
      market: args.market,
      side: args.side,
      quantity: args.quantity,
      price: args.price,
      orderType: args.orderType,
      source: args.source ?? 'dashboard',
    }),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) return { ok: false, status: 'error', sodex: data, error: data?.error || `HTTP ${r.status}` };
  return data as RelayResult;
}

// ── Convenience wrappers ──────────────────────────────────────────────────

export interface PlaceSpotOrderArgs {
  accountID: number;
  symbolID: number;
  market: string;             // for audit: 'vBTC_vUSDC'
  side: 'buy' | 'sell';
  orderType: 'limit' | 'market';
  quantity: number;
  price?: number;             // required for limit; for market pass bestAsk/bestBid (buffer applied internally)
  timeInForce?: 1 | 2 | 3;    // always coerced to 3 (IOC) — only valid value on SoDEX testnet
  pricePrecision?: number;    // decimal places for price (from symbol metadata)
  quantityPrecision?: number; // decimal places for quantity (from symbol metadata)
}

export async function placeSpotOrder(args: PlaceSpotOrderArgs): Promise<RelayResult> {
  const sideCode = args.side === 'buy' ? 1 : 2;

  // CRITICAL: always use limit orders — market orders (type:2) fail with
  // "MissingOraclePrice" on SoDEX testnet. Mirror the bot's execution agent.
  const typeCode = 1;

  // CRITICAL: SoDEX testnet only accepts timeInForce:3 (IOC — fill or cancel).
  // Values 1 and 2 are rejected with "timeInForce is invalid".
  const tif = 3 as const;

  // For "market" orders: apply ±0.5% taker slippage buffer so the limit
  // acts like a market (aggressive taker — matches immediately or cancels).
  const pp = args.pricePrecision ?? 2;
  const qp = args.quantityPrecision ?? 5;
  const mult = Math.pow(10, pp);

  let effectivePrice: number | undefined;
  if (args.price !== undefined && args.price > 0) {
    const rawPrice = args.orderType === 'market'
      ? (args.side === 'buy' ? args.price * 1.005 : args.price * 0.995)
      : args.price;
    effectivePrice = Math.round(rawPrice * mult) / mult;
  }

  // Format strings: toFixed(precision) + strip trailing zeros (SoDEX rejects "0.01000")
  const priceStr = effectivePrice !== undefined
    ? effectivePrice.toFixed(pp).replace(/\.?0+$/, '')
    : undefined;
  const qtyStr = args.quantity.toFixed(qp).replace(/\.?0+$/, '');

  const clOrdID = `dash-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  const body = buildSpotBatchNewOrderBody(args.accountID, [{
    symbolID: args.symbolID,
    clOrdID,
    side: sideCode,
    type: typeCode,
    timeInForce: tif,
    price: priceStr,
    quantity: qtyStr,
  }]);
  return signAndSubmit({
    scope: 'spot',
    actionName: 'batchNewOrder',
    body: body as unknown as Record<string, unknown>,
    market: args.market,
    side: args.side,
    quantity: args.quantity,
    price: effectivePrice,
    orderType: args.orderType,
  });
}

export interface PlacePerpsOrderArgs extends PlaceSpotOrderArgs {
  positionSide: 'long' | 'short';
  reduceOnly?: boolean;
}

export async function placePerpsOrder(args: PlacePerpsOrderArgs): Promise<RelayResult> {
  const sideCode = args.side === 'buy' ? 1 : 2;
  const typeCode = 1; // always limit (same testnet requirement as spot)
  const tif = 3 as const; // always IOC on SoDEX testnet
  const pp = args.pricePrecision ?? 2;
  const qp = args.quantityPrecision ?? 5;
  const mult = Math.pow(10, pp);
  const clOrdID = `dash-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;

  let effectivePrice: number | undefined;
  if (args.price !== undefined && args.price > 0) {
    const rawPrice = args.orderType === 'market'
      ? (args.side === 'buy' ? args.price * 1.005 : args.price * 0.995)
      : args.price;
    effectivePrice = Math.round(rawPrice * mult) / mult;
  }
  const priceStr = effectivePrice !== undefined ? effectivePrice.toFixed(pp).replace(/\.?0+$/, '') : undefined;
  const qtyStr = args.quantity.toFixed(qp).replace(/\.?0+$/, '');

  const body = buildPerpsNewOrderBody({
    accountID: args.accountID,
    symbolID: args.symbolID,
    clOrdID,
    side: sideCode,
    type: typeCode,
    timeInForce: tif,
    price: priceStr,
    quantity: qtyStr,
    positionSide: args.positionSide === 'long' ? 1 : 2,
    reduceOnly: args.reduceOnly ?? false,
  });
  return signAndSubmit({
    scope: 'futures',
    actionName: 'newOrder',
    body: body as unknown as Record<string, unknown>,
    market: args.market,
    side: args.side,
    quantity: args.quantity,
    price: effectivePrice,
    orderType: args.orderType,
  });
}

export async function listMyOrders(limit = 50): Promise<unknown[]> {
  const token = (typeof window !== 'undefined') ? localStorage.getItem('sosomind_token') : null;
  if (!token) return [];
  const r = await fetch(`${API_URL}/api/sodex/relay/orders?limit=${limit}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!r.ok) return [];
  const j = await r.json();
  return j.data ?? [];
}
