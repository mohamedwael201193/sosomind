/**
 * sodex-client — browser EIP-712 signing + relay.
 */
import {
  buildSignable,
  ethSigToWireSig,
  buildSpotBatchNewOrderBody,
  buildPerpsNewOrderBody,
  type Scope,
} from './sodex-signing';
import { getActiveWalletProvider } from './wallet-provider';
import {
  buildSpotOrderItem,
  type SodexSymbolMeta,
  ORDER_TYPE,
  TIF,
  formatPrice,
  formatQuantity,
} from './sodex-market';

import { API_URL } from './env';
import { ENV_STORAGE_KEY, readStoredEnvironment } from './environment';

export interface RelayInfo {
  chainId: number;
  isTestnet: boolean;
  spotBase: string;
  perpsBase: string;
  allowedActions: string[];
  writesAllowed?: boolean;
  maxNotionalUsd?: number;
}

let infoCache = new Map<string, Promise<RelayInfo>>();

function envHeader(): string {
  if (typeof window === 'undefined') return readStoredEnvironment();
  return localStorage.getItem(ENV_STORAGE_KEY) || readStoredEnvironment();
}

export function clearRelayInfoCache() {
  infoCache.clear();
}

export function getRelayInfo(): Promise<RelayInfo> {
  const env = envHeader();
  if (!infoCache.has(env)) {
    infoCache.set(
      env,
      fetch(`${API_URL}/api/sodex/relay/info`, {
        headers: { 'X-SoSoMind-Environment': env },
      })
        .then((r) => r.json())
        .catch(() => ({
          chainId: env === 'testnet' ? 138565 : 286623,
          isTestnet: env === 'testnet',
          spotBase: '',
          perpsBase: '',
          allowedActions: [],
        })),
    );
  }
  return infoCache.get(env)!;
}

export interface SignAndSubmitArgs {
  scope: Scope;
  actionName: 'batchNewOrder' | 'batchCancelOrder' | 'newOrder' | 'cancelOrder';
  body: Record<string, unknown>;
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

export async function ensureSoDEXChain(eth: any, targetChainId: number): Promise<void> {
  const currentHex: string = await eth.request({ method: 'eth_chainId' });
  const current = parseInt(currentHex, 16);
  if (current === targetChainId) return;

  const targetHex = `0x${targetChainId.toString(16)}`;
  const isTestnet = targetChainId === 138565;
  try {
    await eth.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: targetHex }] });
  } catch (switchErr: any) {
    if (switchErr.code === 4902 || switchErr.code === -32603) {
      try {
        await eth.request({
          method: 'wallet_addEthereumChain',
          params: [{
            chainId: targetHex,
            chainName: isTestnet ? 'ValueChain Testnet' : 'ValueChain',
            nativeCurrency: { name: 'SOSO', symbol: 'SOSO', decimals: 18 },
            rpcUrls: [isTestnet ? 'https://testnet-v2.valuechain.xyz' : 'https://mainnet.valuechain.xyz'],
            blockExplorerUrls: [isTestnet ? 'https://test-scan.valuechain.xyz' : 'https://main-scan.valuechain.xyz'],
          }],
        });
      } catch (addErr: any) {
        const msg: string = addErr?.message ?? '';
        if (addErr?.code === -32602 || msg.toLowerCase().includes('same rpc') || msg.toLowerCase().includes('already')) {
          await eth.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: targetHex }] });
        } else {
          throw addErr;
        }
      }
    } else {
      throw new Error(
        `Please switch your wallet to ${isTestnet ? 'ValueChain Testnet' : 'ValueChain Mainnet'} (chainId ${targetChainId}) and retry.`,
      );
    }
  }
}

export async function signAndSubmit(args: SignAndSubmitArgs): Promise<RelayResult> {
  if (typeof window === 'undefined') throw new Error('signAndSubmit must run in the browser');
  const eth = getActiveWalletProvider();
  if (!eth) throw new Error('Connect your wallet to trade');

  const accounts: string[] = await eth.request({ method: 'eth_accounts' });
  if (!accounts.length) await eth.request({ method: 'eth_requestAccounts' });
  const address = (accounts[0] || (await eth.request({ method: 'eth_accounts' }))[0])?.toLowerCase();
  if (!address) throw new Error('No wallet account available');

  const info = await getRelayInfo();
  await ensureSoDEXChain(eth, info.chainId);

  const signable = buildSignable({
    scope: args.scope,
    actionName: args.actionName,
    body: args.body,
    chainId: info.chainId,
  });

  const ethSig = await signTypedDataV4(address, signable.typedData);
  const wireSig = ethSigToWireSig(ethSig);

  const token = typeof window !== 'undefined' ? localStorage.getItem('sosomind_token') : null;
  if (!token) throw new Error('Not signed in — connect wallet first');

  const r = await fetch(`${API_URL}/api/sodex/relay`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      'X-SoSoMind-Environment': envHeader(),
    },
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

export interface PlaceSpotOrderArgs {
  accountID: number;
  symbol: SodexSymbolMeta;
  market: string;
  side: 'buy' | 'sell';
  orderType: 'limit' | 'market';
  quantity: number;
  referencePrice: number;
}

export async function placeSpotOrder(args: PlaceSpotOrderArgs): Promise<RelayResult> {
  const info = await getRelayInfo();
  const clOrdID = `dash-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  const item = buildSpotOrderItem({
    symbol: args.symbol,
    isTestnet: info.isTestnet,
    orderType: args.orderType,
    side: args.side,
    quantity: args.quantity,
    referencePrice: args.referencePrice,
    clOrdID,
  });

  const body = buildSpotBatchNewOrderBody(args.accountID, [item]);
  const effectivePrice = item.price != null ? parseFloat(item.price) : args.referencePrice;

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

export interface PlacePerpsOrderArgs {
  accountID: number;
  symbol: SodexSymbolMeta;
  market: string;
  side: 'buy' | 'sell';
  orderType: 'limit' | 'market';
  quantity: number;
  referencePrice: number;
  positionSide: 'long' | 'short';
  reduceOnly?: boolean;
}

export async function placePerpsOrder(args: PlacePerpsOrderArgs): Promise<RelayResult> {
  const info = await getRelayInfo();
  const sideCode = args.side === 'buy' ? 1 : 2;
  const clOrdID = `dash-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  const qtyStr = formatQuantity(args.quantity, args.symbol);

  let typeCode: 1 | 2 = ORDER_TYPE.LIMIT;
  let tif: 1 | 2 | 3 = info.isTestnet ? TIF.IOC : TIF.GTC;
  let priceStr: string | undefined;

  if (args.orderType === 'market' && !info.isTestnet) {
    typeCode = ORDER_TYPE.MARKET;
    tif = TIF.IOC;
  } else if (args.orderType === 'market') {
    const slip = args.side === 'buy' ? 1.005 : 0.995;
    priceStr = formatPrice(args.referencePrice * slip, args.symbol);
    typeCode = ORDER_TYPE.LIMIT;
    tif = TIF.IOC;
  } else {
    priceStr = formatPrice(args.referencePrice, args.symbol);
  }

  const body = buildPerpsNewOrderBody({
    accountID: args.accountID,
    symbolID: args.symbol.id,
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
    price: priceStr ? parseFloat(priceStr) : args.referencePrice,
    orderType: args.orderType,
  });
}

export async function listMyOrders(limit = 50): Promise<unknown[]> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('sosomind_token') : null;
  if (!token) return [];
  const r = await fetch(`${API_URL}/api/sodex/relay/orders?limit=${limit}`, {
    headers: { Authorization: `Bearer ${token}`, 'X-SoSoMind-Environment': envHeader() },
  });
  if (!r.ok) return [];
  const j = await r.json();
  return j.data ?? [];
}
