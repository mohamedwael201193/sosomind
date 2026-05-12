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

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:10000';

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
  const eth = (typeof window !== 'undefined' ? (window as any).ethereum : null);
  if (!eth) throw new Error('No injected wallet (MetaMask) detected');
  const json = JSON.stringify(typedData);
  // Some wallets accept the object directly, others need a string. v4 spec is string.
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
            chainName: `SoDEX ${targetChainId === 138565 ? 'Testnet' : 'Mainnet'}`,
            nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
            rpcUrls: [targetChainId === 138565 ? 'https://testnet-rpc.sodex.dev' : 'https://rpc.sodex.dev'],
            blockExplorerUrls: [targetChainId === 138565 ? 'https://testnet-explorer.sodex.dev' : 'https://explorer.sodex.dev'],
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
        `Please switch your MetaMask network to SoDEX ${targetChainId === 138565 ? 'Testnet' : 'Mainnet'} (chainId ${targetChainId}) and retry.`
      );
    }
  }
}

export async function signAndSubmit(args: SignAndSubmitArgs): Promise<RelayResult> {
  if (typeof window === 'undefined') throw new Error('signAndSubmit must run in the browser');
  const eth = (window as any).ethereum;
  if (!eth) throw new Error('MetaMask not detected');

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
  price?: number;             // omit for market
  timeInForce?: 1 | 2 | 3;    // default 3 (GTC) for limit, 1 (IOC) for market
}

export async function placeSpotOrder(args: PlaceSpotOrderArgs): Promise<RelayResult> {
  const sideCode = args.side === 'buy' ? 1 : 2;
  const typeCode = args.orderType === 'market' ? 2 : 1;
  const tif = args.timeInForce ?? (args.orderType === 'market' ? 1 : 3);
  const clOrdID = `dash-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  const body = buildSpotBatchNewOrderBody(args.accountID, [{
    symbolID: args.symbolID,
    clOrdID,
    side: sideCode,
    type: typeCode,
    timeInForce: tif,
    price: args.price !== undefined ? String(args.price) : undefined,
    quantity: String(args.quantity),
  }]);
  return signAndSubmit({
    scope: 'spot',
    actionName: 'batchNewOrder',
    body: body as unknown as Record<string, unknown>,
    market: args.market,
    side: args.side,
    quantity: args.quantity,
    price: args.price,
    orderType: args.orderType,
  });
}

export interface PlacePerpsOrderArgs extends PlaceSpotOrderArgs {
  positionSide: 'long' | 'short';
  reduceOnly?: boolean;
}

export async function placePerpsOrder(args: PlacePerpsOrderArgs): Promise<RelayResult> {
  const sideCode = args.side === 'buy' ? 1 : 2;
  const typeCode = args.orderType === 'market' ? 2 : 1;
  const tif = args.timeInForce ?? (args.orderType === 'market' ? 1 : 3);
  const clOrdID = `dash-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  const body = buildPerpsNewOrderBody({
    accountID: args.accountID,
    symbolID: args.symbolID,
    clOrdID,
    side: sideCode,
    type: typeCode,
    timeInForce: tif,
    price: args.price !== undefined ? String(args.price) : undefined,
    quantity: String(args.quantity),
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
    price: args.price,
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
