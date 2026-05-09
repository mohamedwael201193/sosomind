#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { get } from './http.js';

const server = new Server(
  { name: 'sosovalue-mcp', version: '1.0.0' },
  { capabilities: { tools: {} } }
);

// ─────────────────────────── Tool registry ───────────────────────────
type Tool = {
  name: string;
  description: string;
  schema: z.ZodTypeAny;
  inputSchema: any;
  run: (args: any) => Promise<any>;
};

const tools: Tool[] = [];

function tool<T extends z.ZodRawShape>(
  name: string,
  description: string,
  shape: T,
  run: (args: z.infer<z.ZodObject<T>>) => Promise<any>
) {
  const schema = z.object(shape);
  const props: Record<string, any> = {};
  const required: string[] = [];
  for (const [k, v] of Object.entries(shape)) {
    const isOpt = (v as any).isOptional?.();
    props[k] = { type: 'string', description: '' };
    if (!isOpt) required.push(k);
  }
  tools.push({
    name,
    description,
    schema,
    inputSchema: { type: 'object', properties: props, required },
    run: async (args: any) => run(schema.parse(args)),
  });
}

// ── 1. Currency & Pairs (9 tools) ──
tool('soso_get_currencies', 'List all listed currencies', {}, () => get('/currencies'));
tool('soso_get_currency_info', 'Get currency details by id/symbol', { currency_id: z.string() }, ({ currency_id }) => get(`/currencies/${currency_id}`));
tool('soso_get_market_snapshot', 'Get market snapshot for one currency', { currency_id: z.string() }, ({ currency_id }) => get(`/currencies/${currency_id}/market-snapshot`));
tool('soso_get_token_economics', 'Get token economics', { currency_id: z.string() }, ({ currency_id }) => get(`/currencies/${currency_id}/token-economics`));
tool('soso_get_klines', 'Get historical klines', { currency_id: z.string(), limit: z.string().optional() }, ({ currency_id, limit }) => get(`/currencies/${currency_id}/klines`, { limit: Number(limit || 100) }));
tool('soso_get_supply', 'Get historical supply', { currency_id: z.string() }, ({ currency_id }) => get(`/currencies/${currency_id}/supply`));
tool('soso_get_pairs', 'Get trading pairs for currency', { currency_id: z.string() }, ({ currency_id }) => get(`/currencies/${currency_id}/pairs`));
tool('soso_get_sector_spotlight', 'Get sector and spotlight data', {}, () => get('/currencies/sector-spotlight'));
tool('soso_get_currency_fundraising', 'Get currency fundraising info', { currency_id: z.string() }, ({ currency_id }) => get(`/currencies/${currency_id}/fundraising`));

// ── 2. ETF (4 tools) ──
tool('soso_get_etf_list', 'Get ETF list (symbol like BTC ETH SOL, country_code US or HK)', { symbol: z.string(), country_code: z.string().optional() }, ({ symbol, country_code }) => get('/etfs', { symbol, country_code: country_code || 'US' }));
tool('soso_get_etf_summary_history', 'ETF aggregate historical data', { symbol: z.string(), country_code: z.string().optional(), limit: z.string().optional() }, ({ symbol, country_code, limit }) => get('/etfs/summary-history', { symbol, country_code: country_code || 'US', limit: Number(limit || 30) }));
tool('soso_get_etf_market_snapshot', 'ETF market snapshot', { ticker: z.string() }, ({ ticker }) => get(`/etfs/${ticker}/market-snapshot`));
tool('soso_get_etf_history', 'ETF historical data', { ticker: z.string(), limit: z.string().optional() }, ({ ticker, limit }) => get(`/etfs/${ticker}/history`, { limit: Number(limit || 90) }));

// ── 3. Index (4 tools) ──
tool('soso_get_indices', 'Get SoSoValue index list', {}, () => get('/indices'));
tool('soso_get_index_constituents', 'Get index constituents', { index_ticker: z.string() }, ({ index_ticker }) => get(`/indices/${index_ticker}/constituents`));
tool('soso_get_index_market_snapshot', 'Index market snapshot', { index_ticker: z.string() }, ({ index_ticker }) => get(`/indices/${index_ticker}/market-snapshot`));
tool('soso_get_index_klines', 'Index historical klines', { index_ticker: z.string(), limit: z.string().optional() }, ({ index_ticker, limit }) => get(`/indices/${index_ticker}/klines`, { limit: Number(limit || 100) }));

// ── 4. Crypto Stocks (6 tools) ──
tool('soso_get_crypto_stock_list', 'Get crypto stocks list', {}, () => get('/crypto-stocks'));
tool('soso_get_crypto_stock_snapshot', 'Crypto stock market snapshot', { stock_ticker: z.string() }, ({ stock_ticker }) => get(`/crypto-stocks/${stock_ticker}/market-snapshot`));
tool('soso_get_crypto_stock_market_cap', 'Crypto stock historical market cap', { stock_ticker: z.string() }, ({ stock_ticker }) => get(`/crypto-stocks/${stock_ticker}/market-cap`));
tool('soso_get_crypto_stock_klines', 'Crypto stock klines', { stock_ticker: z.string(), limit: z.string().optional() }, ({ stock_ticker, limit }) => get(`/crypto-stocks/${stock_ticker}/klines`, { limit: Number(limit || 100) }));
tool('soso_get_crypto_stock_sectors', 'Crypto stock sectors', {}, () => get('/crypto-stocks/sector'));
tool('soso_get_crypto_sector_index', 'Crypto sector index history', { sector_name: z.string() }, ({ sector_name }) => get(`/crypto-stocks/sector/${sector_name}/index`));

// ── 5. BTC Treasuries (2 tools) ──
tool('soso_get_btc_treasuries', 'BTC treasuries company list', {}, () => get('/btc-treasuries'));
tool('soso_get_btc_purchase_history', 'BTC purchase history', { ticker: z.string(), limit: z.string().optional() }, ({ ticker, limit }) => get(`/btc-treasuries/${ticker}/purchase-history`, { limit: Number(limit || 50) }));

// ── 6. Feeds / News (4 tools) ──
tool('soso_get_news_feed', 'News feed', { page: z.string().optional(), page_size: z.string().optional() }, ({ page, page_size }) => get('/news', { page: Number(page || 1), page_size: Number(page_size || 20) }));
tool('soso_get_hot_news', 'Hot news', { page_size: z.string().optional() }, ({ page_size }) => get('/news/hot', { page_size: Number(page_size || 10) }));
tool('soso_get_featured_news', 'Featured news', { page_size: z.string().optional() }, ({ page_size }) => get('/news/featured', { page_size: Number(page_size || 10) }));
tool('soso_search_news', 'Search news by keyword', { keyword: z.string(), page_size: z.string().optional() }, ({ keyword, page_size }) => get('/news/search', { keyword, page_size: Number(page_size || 20) }));

// ── 7. Fundraising (2 tools) ──
tool('soso_get_fundraising_projects', 'Fundraising project list', { page: z.string().optional(), page_size: z.string().optional() }, ({ page, page_size }) => get('/fundraising/projects', { page: Number(page || 1), page_size: Number(page_size || 50) }));
tool('soso_get_fundraising_project_detail', 'Fundraising project detail', { project_id: z.string() }, ({ project_id }) => get(`/fundraising/projects/${project_id}`));

// ── 8. Macro (2 tools) ──
tool('soso_get_macro_events', 'Macro events list', {}, () => get('/macro/events'));
tool('soso_get_macro_event_history', 'Macro event historical data', { event: z.string(), limit: z.string().optional() }, ({ event, limit }) => get(`/macro/events/${event}/history`, { limit: Number(limit || 20) }));

// ── 9. Analysis (2 tools) ──
tool('soso_get_analysis_charts', 'List analysis charts', {}, () => get('/analyses'));
tool('soso_get_analysis_chart_data', 'Get analysis chart data', { chart_name: z.string(), limit: z.string().optional() }, ({ chart_name, limit }) => get(`/analyses/${chart_name}`, { limit: Number(limit || 100) }));

// ─────────────────────────── MCP wiring ───────────────────────────
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: tools.map((t) => ({
    name: t.name,
    description: t.description,
    inputSchema: t.inputSchema,
  })),
}));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const t = tools.find((x) => x.name === req.params.name);
  if (!t) {
    return { isError: true, content: [{ type: 'text', text: `Unknown tool: ${req.params.name}` }] };
  }
  try {
    const result = await t.run(req.params.arguments || {});
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  } catch (e: any) {
    return { isError: true, content: [{ type: 'text', text: `Error: ${e?.response?.data ? JSON.stringify(e.response.data) : e?.message || String(e)}` }] };
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
console.error(`[sosovalue-mcp] connected (${tools.length} tools)`);
