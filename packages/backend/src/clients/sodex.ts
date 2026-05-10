import axios, { AxiosInstance } from "axios";
import { ethers } from "ethers";
import * as fs from "fs";
import * as path from "path";

// SoDEX REST + EIP-712 signing client.
// Per docs at https://sodex.com/documentation/api/rest-v1
//   Testnet base: https://testnet-gw.sodex.dev/api/v1 (chainId 138565)
//   Mainnet base: https://mainnet-gw.sodex.dev/api/v1 (chainId 286623)
//   Spot endpoints under /spot, perps under /perps.
// Symbol format example: vBTC_vUSDC, vETH_vUSDC.
// Auth (write only): X-API-Sign (EIP-712 wire sig), X-API-Nonce (ms timestamp), X-API-Chain (chainId).
// Optional X-API-Key = registered key name (omit to auth directly with master private key).
// payloadHash = keccak256(JSON({type:actionName, params:body})) — Go struct field order, strings for decimals.
// Wire sig = [0x01, r(32), s(32), v(0|1)] — v normalized from Ethereum 27/28 to raw 0/1.

// ===================== Rate-limit semaphore =====================
class SodexSemaphore {
  private slots: number;
  private queue: Array<() => void> = [];
  constructor(max: number) { this.slots = max; }
  acquire(): Promise<void> {
    if (this.slots > 0) { this.slots--; return Promise.resolve(); }
    return new Promise((r) => this.queue.push(r));
  }
  release(): void {
    if (this.queue.length > 0) { const next = this.queue.shift()!; next(); }
    else this.slots++;
  }
}
const sodexSem = new SodexSemaphore(5);
const SODEX_INTER_MS = 150;

// ===================== Health state =====================
let sdLastSuccess: Date | null = null;
let sdLastLatencyMs = 0;
let sdErrorCount = 0;
let sdCircuitOpenUntil = 0;

export function getSoDexHealth(): { status: "ok" | "degraded" | "down"; lastSuccess: Date | null; latencyMs: number } {
  const status = Date.now() < sdCircuitOpenUntil ? "down" : sdErrorCount > 2 ? "degraded" : "ok";
  return { status, lastSuccess: sdLastSuccess, latencyMs: sdLastLatencyMs };
}

// ===================== Sig cache =====================
const sigCache = new Map<string, { sig: string; nonce: number; expiresAt: number }>();
const SIG_CACHE_TTL_MS = 5000;

const ACTION_TYPES = {
  ExchangeAction: [
    { name: "payloadHash", type: "bytes32" },
    { name: "nonce", type: "uint64" },
  ],
};

export type Side = "buy" | "sell";

// Full symbol metadata returned by /markets/symbols
export interface SodexSymbol {
  id: number;
  name: string;         // e.g. "TESTBTC_vUSDC"
  displayName: string;  // e.g. "TESTBTC/USDC"
  baseCoin: string;     // e.g. "TESTBTC"
  quoteCoin: string;    // e.g. "vUSDC"
  minQuantity: string;
  marketMinQuantity: string;
  minNotional?: string;   // minimum order value in quote currency (e.g. "5" = $5 USDC)
  pricePrecision: number;
  quantityPrecision: number;
  status: string;
}

// Spot order matches NewOrderRequest from go-sdk (single order, not array).
export interface SpotOrderRequest {
  accountID: number;
  symbolID: number;
  clOrdID: string;
  side: 1 | 2;            // 1=buy, 2=sell
  type: 1 | 2;            // 1=limit, 2=market
  timeInForce: 1 | 2 | 3; // 1=IOC, 2=FOK, 3=GTC
  price?: string;
  quantity: string;
}

export interface PerpsOrderRequest extends SpotOrderRequest {
  reduceOnly?: boolean;
  positionSide: 1 | 2;    // 1=long, 2=short
  stopPrice?: string;
}

export class SoDEXClient {
  private spot: AxiosInstance;
  private perps: AxiosInstance;
  private wallet: ethers.Wallet | null = null;
  private address: string = "";
  private chainId: number;
  private isTestnet: boolean;
  private nonceCounter: number;
  private defaultAccountID: number;
  private apiKeyName: string;
  private symbolCache: {
    spot: Map<string, number>;       // name.toUpperCase() → symbolID
    spotMeta: Map<string, SodexSymbol>; // name.toUpperCase() → full metadata
    spotByBase: Map<string, SodexSymbol>; // baseCoin.toUpperCase() → metadata (first vUSDC pair)
    perps: Map<string, number>;
    perpsMeta: Map<string, SodexSymbol>;
    perpsByBase: Map<string, SodexSymbol>;
    loadedAt: number;
  };

  constructor(opts: { chainId: number; privateKey?: string; address?: string; isTestnet?: boolean; accountID?: number; apiKeyName?: string }) {
    this.chainId = opts.chainId;
    this.isTestnet = opts.isTestnet ?? opts.chainId === 138565;
    const base = this.isTestnet ? "https://testnet-gw.sodex.dev/api/v1" : "https://mainnet-gw.sodex.dev/api/v1";
    const headers = { "Content-Type": "application/json", Accept: "application/json" };
    this.spot = axios.create({ baseURL: base + "/spot", headers, timeout: 15000 });
    this.perps = axios.create({ baseURL: base + "/perps", headers, timeout: 15000 });
    if (opts.privateKey) {
      this.wallet = new ethers.Wallet(opts.privateKey);
      this.address = opts.address || this.wallet.address;
    }
    // Load persisted nonce or start from now
    this.nonceCounter = this.loadNonce();
    this.defaultAccountID = opts.accountID || 0;
    this.apiKeyName = opts.apiKeyName || "";
    this.symbolCache = {
      spot: new Map(), spotMeta: new Map(), spotByBase: new Map(),
      perps: new Map(), perpsMeta: new Map(), perpsByBase: new Map(),
      loadedAt: 0,
    };
  }

  private noncePath(): string {
    const dataDir = path.join(process.cwd(), "data");
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
    return path.join(dataDir, `sodex-nonce-${this.address || "default"}.json`);
  }
  private loadNonce(): number {
    try {
      const p = this.noncePath();
      if (fs.existsSync(p)) {
        const saved = Number(JSON.parse(fs.readFileSync(p, "utf8")).nonce);
        if (saved > Date.now()) return saved + 1;
      }
    } catch {}
    return Date.now();
  }
  private saveNonce(n: number): void {
    try { fs.writeFileSync(this.noncePath(), JSON.stringify({ nonce: n, updatedAt: new Date().toISOString() }), "utf8"); } catch {}
  }

  getAddress() { return this.address; }
  getAccountID() { return this.defaultAccountID; }
  isLive() { return Boolean(this.wallet); }

  // Fetch the numeric accountID from SoDEX balance response and cache it.
  // SoDEX assigns a numeric accountID when an API key is registered via the UI.
  // Set SODEX_ACCOUNT_ID in .env with the value from testnet.sodex.dev → Profile → API Keys.
  async resolveAccountID(): Promise<number> {
    if (this.defaultAccountID && this.defaultAccountID > 0) return this.defaultAccountID;
    // Auto-fetch from /accounts/{address}/state (response field: aid)
    if (this.address) {
      try {
        const data: any = await this.read(this.spot, `/accounts/${this.address}/state`);
        const id = Number(data?.aid ?? data?.accountID ?? 0);
        if (id > 0) {
          this.defaultAccountID = id;
          console.log(`[SoDEX] Resolved accountID=${id} for ${this.address}`);
          return id;
        }
      } catch (e) {
        console.warn('[SoDEX] resolveAccountID fetch failed:', (e as Error).message);
      }
    }
    throw new Error(
      'SODEX_ACCOUNT_ID not configured and could not be fetched automatically. Add SODEX_ACCOUNT_ID=54647 to .env'
    );
  }
  wsUrl(scope: "spot" | "perps") {
    const host = this.isTestnet ? "testnet-gw.sodex.dev" : "mainnet-gw.sodex.dev";
    return `wss://${host}/ws/${scope}`;
  }

  // Rate-limited public read helper
  private async read<T = any>(instance: AxiosInstance, url: string, config?: any): Promise<T> {
    await sodexSem.acquire();
    const t0 = Date.now();
    try {
      const r = await instance.get(url, config);
      sdLastLatencyMs = Date.now() - t0;
      sdLastSuccess = new Date();
      sdErrorCount = 0;
      await new Promise((res) => setTimeout(res, SODEX_INTER_MS));
      return this.unwrap<T>(r);
    } catch (err) {
      sdErrorCount++;
      if (sdErrorCount >= 5) sdCircuitOpenUntil = Date.now() + 60_000;
      throw err;
    } finally {
      sodexSem.release();
    }
  }

  async resolveSymbolID(market: string, scope: "spot" | "perps"): Promise<number> {
    const TTL = 10 * 60 * 1000;
    if (Date.now() - this.symbolCache.loadedAt > TTL ||
      (this.symbolCache.spot.size === 0 && this.symbolCache.perps.size === 0)) {
      const fillCache = (
        list: any,
        idMap: Map<string, number>,
        metaMap: Map<string, SodexSymbol>,
        baseMap: Map<string, SodexSymbol>
      ) => {
        const items: SodexSymbol[] = Array.isArray(list) ? list : list?.data || list?.symbols || [];
        for (const item of items) {
          // SoDEX uses "name" field (e.g. "TESTBTC_vUSDC"), not "symbol"
          const sym = String(item.name || "").toUpperCase();
          const id = Number(item.id);
          if (sym && Number.isFinite(id) && id > 0) {
            idMap.set(sym, id);
            metaMap.set(sym, item);
            // Also index by baseCoin for asset-only lookup (e.g. "TESTBTC" → this entry)
            const base = String(item.baseCoin || "").toUpperCase();
            if (base && !baseMap.has(base)) baseMap.set(base, item);
          }
        }
      };
      try {
        const [s, p] = await Promise.all([
          this.getSpotSymbols().catch(() => []),
          this.getPerpsSymbols().catch(() => []),
        ]);
        fillCache(s, this.symbolCache.spot, this.symbolCache.spotMeta, this.symbolCache.spotByBase);
        fillCache(p, this.symbolCache.perps, this.symbolCache.perpsMeta, this.symbolCache.perpsByBase);
        this.symbolCache.loadedAt = Date.now();
        console.log(`[SoDEX] Loaded ${this.symbolCache.spot.size} spot / ${this.symbolCache.perps.size} perps symbols`);
      } catch {}
    }
    const idMap = scope === "spot" ? this.symbolCache.spot : this.symbolCache.perps;
    const metaMap = scope === "spot" ? this.symbolCache.spotMeta : this.symbolCache.perpsMeta;
    const id = idMap.get(market.toUpperCase());
    if (!id) throw new Error(`Unknown SoDEX ${scope} market: ${market} (known: ${[...idMap.keys()].slice(0, 10).join(', ')})`);
    return id;
  }

  // Look up full symbol metadata by exact market name (e.g. "vBTC_vUSDC" → {id:1, pricePrecision:0, ...})
  async getSymbolMeta(market: string, scope: "spot" | "perps"): Promise<SodexSymbol> {
    await this.resolveSymbolID(market, scope); // ensures cache is loaded
    const metaMap = scope === "spot" ? this.symbolCache.spotMeta : this.symbolCache.perpsMeta;
    const meta = metaMap.get(market.toUpperCase());
    if (!meta) throw new Error(`No metadata for SoDEX ${scope} market: ${market}`);
    return meta;
  }

  // Find the best spot market for a plain asset symbol (e.g. "BTC" → TESTBTC_vUSDC on testnet)
  async findMarketForAsset(asset: string): Promise<SodexSymbol> {
    // Ensure symbols are loaded
    await this.resolveSymbolID("__probe__", "spot").catch(() => {});
    const needle = asset.toUpperCase();
    const byBase = this.symbolCache.spotByBase;
    // Try exact base match: "BTC" → "BTC" key, or "VBTC", "TESTBTC"
    for (const [base, meta] of byBase.entries()) {
      if (base === needle || base === `V${needle}` || base.endsWith(needle) || base.includes(needle)) {
        return meta;
      }
    }
    throw new Error(`No SoDEX spot market found for asset: ${asset}. Available: ${[...byBase.keys()].join(', ')}`);
  }

  // ---------- READ (spot, public) ----------
  async getSpotSymbols() { return this.read(this.spot, "/markets/symbols"); }
  async getSpotCoins() { return this.read(this.spot, "/markets/coins"); }
  async getSpotTickers() { return this.read(this.spot, "/markets/tickers"); }
  async getSpotMiniTickers() { return this.read(this.spot, "/markets/miniTickers"); }
  async getSpotBookTickers() { return this.read(this.spot, "/markets/bookTickers"); }
  async getSpotOrderbook(symbol: string, limit = 20) { return this.read(this.spot, `/markets/${symbol}/orderbook`, { params: { limit } }); }
  async getSpotKlines(symbol: string, interval = "1h", limit = 100) { return this.read(this.spot, `/markets/${symbol}/klines`, { params: { interval, limit } }); }
  async getSpotTrades(symbol: string, limit = 50) { return this.read(this.spot, `/markets/${symbol}/trades`, { params: { limit } }); }

  // ---------- READ (perps, public) ----------
  async getPerpsSymbols() { return this.read(this.perps, "/markets/symbols"); }
  async getPerpsCoins() { return this.read(this.perps, "/markets/coins"); }
  async getPerpsTickers() { return this.read(this.perps, "/markets/tickers"); }
  async getPerpsMarkPrices() { return this.read(this.perps, "/markets/mark-prices"); }
  async getPerpsOrderbook(symbol: string, limit = 20) { return this.read(this.perps, `/markets/${symbol}/orderbook`, { params: { limit } }); }
  async getPerpsKlines(symbol: string, interval = "1h", limit = 100) { return this.read(this.perps, `/markets/${symbol}/klines`, { params: { interval, limit } }); }
  async getPerpsTrades(symbol: string, limit = 50) { return this.read(this.perps, `/markets/${symbol}/trades`, { params: { limit } }); }
  async getPerpsFundingRate(symbol: string) {
    const all = await this.getPerpsMarkPrices().catch(() => null);
    if (Array.isArray(all)) return all.find((x: any) => String(x.symbol).toUpperCase() === symbol.toUpperCase()) || null;
    return all;
  }

  // ---------- READ (account) ----------
  async getAccountBalances(_accountID?: number) {
    if (!this.address) throw new Error("No address configured");
    return this.read(this.spot, `/accounts/${this.address}/balances`);
  }
  async getSpotOrders(symbol?: string) {
    return this.read(this.spot, `/accounts/${this.address}/orders`, { params: symbol ? { symbol } : undefined });
  }
  async getSpotOrderHistory(symbol?: string, limit = 50) {
    return this.read(this.spot, `/accounts/${this.address}/orders/history`, { params: { ...(symbol ? { symbol } : {}), limit } });
  }
  async getPerpsBalances() { return this.read(this.perps, `/accounts/${this.address}/balances`); }
  async getPerpsPositions(_accountID?: number) {
    if (!this.address) throw new Error("No address configured");
    return this.read(this.perps, `/accounts/${this.address}/positions`);
  }
  async getPerpsOrders() { return this.read(this.perps, `/accounts/${this.address}/orders`); }
  async getPerpsTradeHistory(limit = 50) {
    return this.read(this.perps, `/accounts/${this.address}/trades`, { params: { limit } });
  }
  async getSpotFeeRate() {
    return this.read(this.spot, `/accounts/${this.address}/fee-rate`);
  }
  async estimateSlippage(symbol: string, amount: number, side: "buy" | "sell"): Promise<{ slippagePct: number; avgPrice: number }> {
    const ob: any = await this.getSpotOrderbook(symbol, 20);
    // SoDEX orderbook: bids/asks are arrays [price, size], not objects {price, size}
    const rawLevels: any[] = side === "buy" ? (ob?.asks || []) : (ob?.bids || []);
    const levels: Array<[number, number]> = rawLevels.map((a: any) =>
      Array.isArray(a) ? [Number(a[0]), Number(a[1])] : [Number(a.price), Number(a.size)]
    );
    let remaining = amount;
    let cost = 0;
    const midPrice = levels[0]?.[0] ?? 0;
    for (const [price, size] of levels) {
      const fill = Math.min(remaining, size);
      cost += fill * price;
      remaining -= fill;
      if (remaining <= 0) break;
    }
    if (remaining > 0) return { slippagePct: 100, avgPrice: 0 }; // insufficient liquidity
    const avgPrice = cost / amount;
    const slippagePct = midPrice > 0 ? Math.abs((avgPrice - midPrice) / midPrice) * 100 : 0;
    return { slippagePct: parseFloat(slippagePct.toFixed(4)), avgPrice };
  }

  private unwrap<T = any>(r: any): T {
    const d = r?.data;
    // SoDEX returns code: 0 for success, negative for errors (HTTP 200 body with error)
    if (d && typeof d === 'object' && 'code' in d && d.code !== 0) {
      const msg = d.error || d.message || `SoDEX error code ${d.code}`;
      throw new Error(`[SoDEX] ${msg}`);
    }
    if (d && typeof d === 'object' && 'data' in d) return d.data;
    return d;
  }

  // ---------- SIGNING ----------
  private nextNonce(): number {
    const now = Date.now();
    if (now > this.nonceCounter) this.nonceCounter = now;
    else this.nonceCounter += 1;
    this.saveNonce(this.nonceCounter);
    return this.nonceCounter;
  }
  private domain(scope: "spot" | "futures") {
    return { name: scope, version: "1", chainId: this.chainId, verifyingContract: "0x0000000000000000000000000000000000000000" };
  }
  // Sign a request body and return the headers needed.
  // Uses a 5s cache for identical payloads to avoid redundant signing.
  // Sign a request body for SoDEX.
  // payloadHash = keccak256(JSON({type:actionName, params:body})) — must match Go's json.Marshal field order.
  // Wire format: 0x01 byte + r(32) + s(32) + v(0|1) — v normalized from Ethereum 27/28 to raw recovery id 0/1.
  private async signBody(body: any, scope: "spot" | "futures", actionName: string): Promise<{ nonce: number; sig: string }> {
    if (!this.wallet) throw new Error("Wallet not configured — set SODEX_PRIVATE_KEY in .env");
    // Wrap in ActionPayload envelope — server re-serializes using Go struct field order to compute payloadHash
    const envelope = { type: actionName, params: body };
    const json = JSON.stringify(envelope);
    const payloadHash = ethers.keccak256(ethers.toUtf8Bytes(json));
    const cacheKey = `${scope}:${actionName}:${payloadHash}`;
    const cached = sigCache.get(cacheKey);
    if (cached && Date.now() < cached.expiresAt) return { nonce: cached.nonce, sig: cached.sig };
    const nonce = this.nextNonce();
    const rawSig = await this.wallet.signTypedData(this.domain(scope), ACTION_TYPES, { payloadHash, nonce });
    // Normalize v: Ethereum returns 27/28, SoDEX needs raw recovery ID 0/1
    const sigBytes = ethers.getBytes(rawSig);
    sigBytes[64] = sigBytes[64] - 27;
    const sig = "0x01" + ethers.hexlify(sigBytes).slice(2);
    sigCache.set(cacheKey, { sig, nonce, expiresAt: Date.now() + SIG_CACHE_TTL_MS });
    return { nonce, sig };
  }
  private signedHeaders(nonce: number, sig: string): Record<string, string> {
    const headers: Record<string, string> = {
      "X-API-Sign": sig,
      "X-API-Nonce": String(nonce),
      "X-API-Chain": String(this.chainId),
    };
    // Only set X-API-Key if a registered key name is configured
    // Without it, the server recovers the signer address from the signature (direct auth)
    if (this.apiKeyName) headers["X-API-Key"] = this.apiKeyName;
    return headers;
  }

  // ---------- WRITE (spot) ----------
  async placeSpotOrderBatch(accountID: number, orders: SpotOrderRequest[]) {
    // Build items in Go struct field order (symbolID, clOrdID, side, type, timeInForce, price?, quantity?)
    // accountID is top-level only, NOT in order items (BatchNewOrderItem has no accountID)
    const items = orders.map(({ symbolID, clOrdID, side, type, timeInForce, price, quantity }) => {
      const item: Record<string, any> = { symbolID, clOrdID, side, type, timeInForce };
      if (price !== undefined) item.price = price; // price before quantity (Go struct order)
      if (quantity !== undefined) item.quantity = quantity;
      return item;
    });
    const body = { accountID, orders: items };
    const { nonce, sig } = await this.signBody(body, "spot", "batchNewOrder");
    return this.unwrap(await this.spot.post("/trade/orders/batch", body, { headers: this.signedHeaders(nonce, sig) }));
  }
  async placeSpotOrder(order: SpotOrderRequest) {
    return this.placeSpotOrderBatch(order.accountID, [order]);
  }
  async cancelSpotOrders(accountID: number, items: Array<{ symbolID: number; orderID?: number; clOrdID?: string }>) {
    // SoDEX uses 'cancels' (not 'orders') and 'batchCancelOrder' action name
    // BatchCancelOrderItem field order: symbolID, clOrdID (required), orderID?
    const cancels = items.map(({ symbolID, clOrdID, orderID }) => {
      const item: Record<string, any> = { symbolID, clOrdID: clOrdID ?? '' };
      if (orderID !== undefined) item.orderID = orderID;
      return item;
    });
    const body = { accountID, cancels };
    const { nonce, sig } = await this.signBody(body, "spot", "batchCancelOrder");
    return this.unwrap(await this.spot.delete("/trade/orders/batch", { data: body, headers: this.signedHeaders(nonce, sig) }));
  }
  async cancelSpotOrder(p: { accountID: number; symbolID: number; orderID?: number; clOrdID?: string }) {
    return this.cancelSpotOrders(p.accountID, [{ symbolID: p.symbolID, orderID: p.orderID, clOrdID: p.clOrdID }]);
  }

  // ---------- WRITE (perps) ----------
  async placePerpsOrder(order: PerpsOrderRequest) {
    // Perps NewOrderRequest: {accountID, symbolID, orders:[{clOrdID, modifier, side, type, timeInForce, ..., reduceOnly, positionSide}]}
    // modifier, reduceOnly, positionSide are required (no omitempty)
    const { accountID, symbolID, clOrdID, side, type, timeInForce, price, quantity, positionSide = 1 } = order;
    const item: Record<string, any> = { clOrdID, modifier: 0, side, type, timeInForce };
    if (price !== undefined) item.price = price;
    if (quantity !== undefined) item.quantity = quantity;
    item.reduceOnly = false;
    item.positionSide = positionSide;
    const body = { accountID, symbolID, orders: [item] };
    const { nonce, sig } = await this.signBody(body, "futures", "newOrder");
    return this.unwrap(await this.perps.post("/trade/orders", body, { headers: this.signedHeaders(nonce, sig) }));
  }
  async cancelPerpsOrder(p: { accountID: number; symbolID: number; orderID?: string; clOrdID?: string }) {
    const body = { accountID: p.accountID, symbolID: p.symbolID, cancels: [{ clOrdID: p.clOrdID ?? '', ...(p.orderID ? { orderID: p.orderID } : {}) }] };
    const { nonce, sig } = await this.signBody(body, "futures", "cancelOrder");
    return this.unwrap(await this.perps.delete("/trade/orders", { data: body, headers: this.signedHeaders(nonce, sig) }));
  }
}

export const sodex = new SoDEXClient({
  chainId: parseInt(process.env.SODEX_CHAIN_ID || "138565", 10),
  privateKey: process.env.SODEX_PRIVATE_KEY,
  address: process.env.SODEX_ADDRESS,
  isTestnet: (process.env.SODEX_CHAIN_ID || "138565") === "138565",
  accountID: process.env.SODEX_ACCOUNT_ID ? parseInt(process.env.SODEX_ACCOUNT_ID, 10) : 0,
  apiKeyName: process.env.SODEX_API_KEY_NAME || "",
});