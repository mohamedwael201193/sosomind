#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import axios from "axios";
import { ethers } from "ethers";

// SoDEX MCP - REST v1 (header-based EIP-712 auth)
const CHAIN_ID = parseInt(process.env.SODEX_CHAIN_ID || "138565", 10);
const IS_TESTNET = CHAIN_ID === 138565;
const BASE = IS_TESTNET ? "https://testnet-gw.sodex.dev/api/v1" : "https://mainnet-gw.sodex.dev/api/v1";
const PRIV = process.env.SODEX_PRIVATE_KEY;
const wallet = PRIV ? new ethers.Wallet(PRIV) : null;
const ADDRESS = process.env.SODEX_ADDRESS || wallet?.address || "";
const ACCOUNT_ID = process.env.SODEX_ACCOUNT_ID ? Number(process.env.SODEX_ACCOUNT_ID) : 0;
const API_KEY_NAME = process.env.SODEX_API_KEY_NAME || "";

const spot = axios.create({ baseURL: BASE + "/spot", timeout: 15000, headers: { "Content-Type": "application/json" } });
const perps = axios.create({ baseURL: BASE + "/perps", timeout: 15000, headers: { "Content-Type": "application/json" } });

const ACTION_TYPES = { ExchangeAction: [{ name: "payloadHash", type: "bytes32" }, { name: "nonce", type: "uint64" }] };
function domain(scope: "spot" | "futures") { return { name: scope, version: "1", chainId: CHAIN_ID, verifyingContract: "0x0000000000000000000000000000000000000000" }; }
let nonceCounter = Date.now();
function nextNonce() { const n = Date.now(); if (n > nonceCounter) nonceCounter = n; else nonceCounter += 1; return nonceCounter; }

async function signHeaders(body: any, scope: "spot" | "futures") {
  if (!wallet) throw new Error("SODEX_PRIVATE_KEY not set");
  if (!API_KEY_NAME) throw new Error("SODEX_API_KEY_NAME not set (register API key on SoDEX first)");
  const payloadHash = ethers.keccak256(ethers.toUtf8Bytes(JSON.stringify(body)));
  const nonce = nextNonce();
  const sig = await wallet.signTypedData(domain(scope), ACTION_TYPES, { payloadHash, nonce });
  return { "X-API-Key": API_KEY_NAME, "X-API-Sign": "0x01" + sig.slice(2), "X-API-Nonce": String(nonce) };
}

async function get(client: typeof spot, path: string, params?: any) { const r = await client.get(path, { params }); return r.data?.data ?? r.data; }
async function postSigned(client: typeof spot, path: string, body: any, scope: "spot" | "futures") {
  const headers = await signHeaders(body, scope);
  const r = await client.post(path, body, { headers }); return r.data?.data ?? r.data;
}
async function delSigned(client: typeof spot, path: string, body: any, scope: "spot" | "futures") {
  const headers = await signHeaders(body, scope);
  const r = await client.delete(path, { data: body, headers }); return r.data?.data ?? r.data;
}

type Tool = { name: string; description: string; inputSchema: any; schema: z.ZodTypeAny; run: (a: any) => Promise<any> };
const tools: Tool[] = [];
function tool<T extends z.ZodRawShape>(name: string, description: string, shape: T, run: (a: z.infer<z.ZodObject<T>>) => Promise<any>) {
  const schema = z.object(shape);
  const props: Record<string, any> = {}; const required: string[] = [];
  for (const [k, v] of Object.entries(shape)) { props[k] = { type: "string" }; if (!(v as any).isOptional?.()) required.push(k); }
  tools.push({ name, description, schema, inputSchema: { type: "object", properties: props, required }, run: (a: any) => run(schema.parse(a)) });
}

// READ spot
tool("sodex_get_spot_symbols", "List spot trading symbols (e.g. vBTC_vUSDC)", {}, () => get(spot, "/markets/symbols"));
tool("sodex_get_spot_tickers", "24h tickers for all spot symbols", {}, () => get(spot, "/markets/tickers"));
tool("sodex_get_spot_orderbook", "Get spot orderbook depth for a symbol", { market: z.string(), depth: z.string().optional() }, ({ market, depth }) => get(spot, `/markets/${market}/orderbook`, { limit: Number(depth || 20) }));
tool("sodex_get_spot_trades", "Get recent public trades", { market: z.string(), limit: z.string().optional() }, ({ market, limit }) => get(spot, `/markets/${market}/trades`, { limit: Number(limit || 50) }));
tool("sodex_get_spot_klines", "Get spot klines/candles", { market: z.string(), interval: z.string().optional(), limit: z.string().optional() }, ({ market, interval, limit }) => get(spot, `/markets/${market}/klines`, { interval: interval || "1h", limit: Number(limit || 100) }));

// READ perps
tool("sodex_get_perps_symbols", "List perps trading symbols", {}, () => get(perps, "/markets/symbols"));
tool("sodex_get_perps_mark_prices", "Mark prices for all perps", {}, () => get(perps, "/markets/mark-prices"));
tool("sodex_get_perps_orderbook", "Get perps orderbook depth", { market: z.string(), depth: z.string().optional() }, ({ market, depth }) => get(perps, `/markets/${market}/orderbook`, { limit: Number(depth || 20) }));
tool("sodex_get_perps_klines", "Get perps klines/candles", { market: z.string(), interval: z.string().optional(), limit: z.string().optional() }, ({ market, interval, limit }) => get(perps, `/markets/${market}/klines`, { interval: interval || "1h", limit: Number(limit || 100) }));
tool("sodex_get_perps_trades", "Get recent perps trades", { market: z.string(), limit: z.string().optional() }, ({ market, limit }) => get(perps, `/markets/${market}/trades`, { limit: Number(limit || 50) }));

// ACCOUNT
tool("sodex_get_account_balances", "Get spot account balances (uses SODEX_ADDRESS)", {}, () => get(spot, `/accounts/${ADDRESS}/balances`));
tool("sodex_get_perps_balances", "Get perps account balances", {}, () => get(perps, `/accounts/${ADDRESS}/balances`));
tool("sodex_get_perps_positions", "Get all open perps positions", {}, () => get(perps, `/accounts/${ADDRESS}/positions`));
tool("sodex_get_spot_orders", "Get open spot orders", { market: z.string().optional() }, ({ market }) => get(spot, `/accounts/${ADDRESS}/orders`, market ? { symbol: market } : undefined));
tool("sodex_get_perps_orders", "Get open perps orders", {}, () => get(perps, `/accounts/${ADDRESS}/orders`));

// WRITE spot - batch endpoint (single order wrapped)
tool("sodex_place_spot_order", "Place a signed spot order (POST /trade/orders/batch). Requires SODEX_API_KEY_NAME.", {
  symbolID: z.string(), clOrdID: z.string().optional(), side: z.enum(["buy","sell"]), type: z.enum(["limit","market"]).optional(),
  price: z.string().optional(), quantity: z.string(), accountID: z.string().optional(),
}, async (a) => {
  const body = {
    accountID: a.accountID ? Number(a.accountID) : ACCOUNT_ID,
    orders: [{
      symbolID: Number(a.symbolID),
      clOrdID: a.clOrdID || `mcp-${Date.now()}`,
      side: a.side === "buy" ? 1 : 2,
      type: a.type === "market" ? 2 : 1,
      timeInForce: a.type === "market" ? 1 : 3,
      ...(a.type !== "market" && a.price ? { price: a.price } : {}),
      quantity: a.quantity,
    }],
  };
  return postSigned(spot, "/trade/orders/batch", body, "spot");
});

tool("sodex_cancel_spot_order", "Cancel spot order (DELETE /trade/orders/batch)", {
  symbolID: z.string(), orderID: z.string().optional(), clOrdID: z.string().optional(), accountID: z.string().optional(),
}, async (a) => {
  const body = { accountID: a.accountID ? Number(a.accountID) : ACCOUNT_ID, orders: [{ symbolID: Number(a.symbolID), orderID: a.orderID, clOrdID: a.clOrdID }] };
  return delSigned(spot, "/trade/orders/batch", body, "spot");
});

// WRITE perps - single endpoint
tool("sodex_place_perps_order", "Place a signed perps order (POST /trade/orders)", {
  symbolID: z.string(), clOrdID: z.string().optional(), side: z.enum(["buy","sell"]), type: z.enum(["limit","market"]).optional(),
  price: z.string().optional(), quantity: z.string(), reduceOnly: z.string().optional(), positionSide: z.enum(["long","short"]),
  accountID: z.string().optional(),
}, async (a) => {
  const body = {
    accountID: a.accountID ? Number(a.accountID) : ACCOUNT_ID,
    symbolID: Number(a.symbolID),
    clOrdID: a.clOrdID || `mcp-${Date.now()}`,
    side: a.side === "buy" ? 1 : 2,
    type: a.type === "market" ? 2 : 1,
    timeInForce: a.type === "market" ? 1 : 3,
    ...(a.type !== "market" && a.price ? { price: a.price } : {}),
    quantity: a.quantity,
    reduceOnly: a.reduceOnly === "true",
    positionSide: a.positionSide === "long" ? 1 : 2,
  };
  return postSigned(perps, "/trade/orders", body, "futures");
});

tool("sodex_cancel_perps_order", "Cancel a perps order (DELETE /trade/orders)", {
  symbolID: z.string(), orderID: z.string().optional(), clOrdID: z.string().optional(), accountID: z.string().optional(),
}, async (a) => {
  const body = { accountID: a.accountID ? Number(a.accountID) : ACCOUNT_ID, symbolID: Number(a.symbolID), orderID: a.orderID, clOrdID: a.clOrdID };
  return delSigned(perps, "/trade/orders", body, "futures");
});

const server = new Server({ name: "sodex-mcp", version: "1.0.0" }, { capabilities: { tools: {} } });
server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: tools.map((t) => ({ name: t.name, description: t.description, inputSchema: t.inputSchema })) }));
server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const t = tools.find((x) => x.name === req.params.name);
  if (!t) return { isError: true, content: [{ type: "text", text: `Unknown tool: ${req.params.name}` }] };
  try {
    const result = await t.run(req.params.arguments || {});
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  } catch (e: any) {
    return { isError: true, content: [{ type: "text", text: `Error: ${e?.response?.data ? JSON.stringify(e.response.data) : e?.message || String(e)}` }] };
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
console.error(`[sodex-mcp] connected (${tools.length} tools, chainId=${CHAIN_ID}, base=${BASE})`);