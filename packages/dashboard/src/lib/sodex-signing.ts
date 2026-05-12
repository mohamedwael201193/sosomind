/**
 * sodex-signing — browser EIP-712 signing for SoDEX.
 *
 * Mirrors the algorithm in `packages/backend/src/clients/sodex.ts:signBody`:
 *   envelope    = { type: actionName, params: body }      // Go field order
 *   payloadHash = keccak256(toUtf8Bytes(JSON.stringify(envelope)))
 *   typed data  = ExchangeAction { payloadHash, nonce }
 *   wire sig    = 0x01 + r + s + v(0|1)                    // v normalized from 27/28
 *
 * The user signs through MetaMask via `eth_signTypedData_v4`. We never
 * see their key. The backend relay only forwards the signed wire data.
 */
import { keccak256, toUtf8Bytes, getBytes, hexlify } from 'ethers';

export type Scope = 'spot' | 'futures';

export interface BuildSignableArgs {
  scope: Scope;
  actionName: string;
  body: Record<string, unknown>;
  chainId: number;
}

export interface Signable {
  envelopeJson: string;          // exact bytes that hash to payloadHash
  payloadHash: string;
  nonce: number;
  typedData: Record<string, unknown>;   // EIP-712 v4 payload for eth_signTypedData_v4
}

let nonceCounter = 0;
function nextNonce(): number {
  const now = Date.now();
  if (now > nonceCounter) nonceCounter = now;
  else nonceCounter += 1;
  return nonceCounter;
}

export function buildSignable({ scope, actionName, body, chainId }: BuildSignableArgs): Signable {
  // CRITICAL: stringify the envelope in the same field order the Go server expects.
  // The caller is responsible for passing `body` with keys in the correct order
  // (JS preserves insertion order for non-integer keys since ES2015).
  const envelope = { type: actionName, params: body };
  const envelopeJson = JSON.stringify(envelope);
  const payloadHash = keccak256(toUtf8Bytes(envelopeJson));
  const nonce = nextNonce();

  const typedData = {
    types: {
      EIP712Domain: [
        { name: 'name',              type: 'string' },
        { name: 'version',           type: 'string' },
        { name: 'chainId',           type: 'uint256' },
        { name: 'verifyingContract', type: 'address' },
      ],
      ExchangeAction: [
        { name: 'payloadHash', type: 'bytes32' },
        { name: 'nonce',       type: 'uint64' },
      ],
    },
    primaryType: 'ExchangeAction',
    domain: {
      name: scope,
      version: '1',
      chainId,
      verifyingContract: '0x0000000000000000000000000000000000000000',
    },
    message: { payloadHash, nonce: nonce.toString() },   // uint64 as string for v4
  };
  return { envelopeJson, payloadHash, nonce, typedData };
}

/**
 * Convert MetaMask's 65-byte 0x signature (v=27|28) into SoDEX wire format
 * 0x01 + r + s + v(0|1).
 */
export function ethSigToWireSig(sig: string): string {
  const bytes = getBytes(sig);
  if (bytes.length !== 65) throw new Error(`Bad signature length ${bytes.length}, expected 65`);
  // ethers v6 personal_sign returns v=27|28; some wallets return 0|1 already.
  const v = bytes[64];
  bytes[64] = v >= 27 ? v - 27 : v;
  return '0x01' + hexlify(bytes).slice(2);
}

// ── Helpers to build action bodies in correct Go field order ─────────────
// The order MUST match what packages/backend/src/clients/sodex.ts builds when
// it constructs `body` to sign. Each helper returns a fresh object with keys
// in the canonical order; do not spread other properties in.

export interface SpotOrderItemArgs {
  symbolID: number;
  clOrdID: string;
  side: 1 | 2;            // 1=buy, 2=sell
  type: 1 | 2;            // 1=limit, 2=market (testnet: always use 1)
  timeInForce: 1 | 2 | 3; // 3=IOC (only valid value on SoDEX testnet), 1=GTC, 2=FOK
  price?: string;         // decimal as string; required for limit, taker-buffered for market-style
  quantity: string;
}

export function buildSpotBatchNewOrderBody(accountID: number, orders: SpotOrderItemArgs[]) {
  const items = orders.map(({ symbolID, clOrdID, side, type, timeInForce, price, quantity }) => {
    const item: Record<string, unknown> = { symbolID, clOrdID, side, type, timeInForce };
    if (price !== undefined) item.price = price;
    item.quantity = quantity;
    return item;
  });
  return { accountID, orders: items };
}

export function buildSpotBatchCancelBody(
  accountID: number,
  cancels: Array<{ symbolID: number; clOrdID: string; orderID?: number }>
) {
  const items = cancels.map(({ symbolID, clOrdID, orderID }) => {
    const item: Record<string, unknown> = { symbolID, clOrdID };
    if (orderID !== undefined) item.orderID = orderID;
    return item;
  });
  return { accountID, cancels: items };
}

export interface PerpsOrderArgs {
  accountID: number;
  symbolID: number;
  clOrdID: string;
  side: 1 | 2;
  type: 1 | 2;
  timeInForce: 1 | 2 | 3;
  price?: string;
  quantity: string;
  positionSide: 1 | 2;       // 1=long, 2=short
  reduceOnly?: boolean;
}

export function buildPerpsNewOrderBody(args: PerpsOrderArgs) {
  const { accountID, symbolID, clOrdID, side, type, timeInForce, price, quantity, positionSide, reduceOnly } = args;
  const item: Record<string, unknown> = { clOrdID, modifier: 0, side, type, timeInForce };
  if (price !== undefined) item.price = price;
  item.quantity = quantity;
  item.reduceOnly = reduceOnly ?? false;
  item.positionSide = positionSide;
  return { accountID, symbolID, orders: [item] };
}
