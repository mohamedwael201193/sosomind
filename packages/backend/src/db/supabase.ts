import { createClient, SupabaseClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env');
}

export const supabase: SupabaseClient = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// ===================== TypeScript Interfaces =====================

export interface Signal {
  id?: string;
  user_id?: string | null;
  asset: string;
  symbol: string;
  direction: 'long' | 'short' | 'neutral';
  confidence: number;
  reasoning: string;
  entry?: number | null;
  take_profit?: number | null;
  stop_loss?: number | null;
  sources?: Array<{ module: string; insight: string }> | null;
  status: 'active' | 'expired' | 'dismissed' | 'executed';
  expires_at?: string | null;
  created_at?: string;
}

export interface Trade {
  id?: string;
  user_id?: string | null;
  signal_id?: string | null;
  market: string;
  side: 'buy' | 'sell';
  price: number;
  amount: number;
  total?: number | null;
  order_type: 'market' | 'limit';
  status: 'pending' | 'filled' | 'cancelled' | 'failed' | 'dry_run';
  sodex_order_id?: string | null;
  tx_hash?: string | null;
  confirmed_by?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface Alert {
  id?: string;
  user_id?: string | null;
  type: string;
  asset?: string | null;
  condition?: string | null;
  threshold?: number | null;
  message?: string | null;
  triggered?: boolean;
  created_at?: string;
}

export interface PortfolioSnapshot {
  id?: string;
  user_id?: string | null;
  total_value: number;
  available_value?: number | null;
  positions?: any | null;
  pnl_usd?: number | null;
  pnl_pct?: number | null;
  timestamp: string;
  created_at?: string;
}

export interface AgentLog {
  id?: string;
  agent: string;
  action: string;
  level: 'info' | 'warn' | 'error';
  input?: any | null;
  output?: any | null;
  duration_ms?: number | null;
  error?: string | null;
  user_id?: string | null;
  created_at?: string;
}

export interface ContentPost {
  id?: string;
  title: string;
  body: string;
  summary?: string | null;
  sector?: string | null;
  symbols?: string[] | null;
  sentiment?: string | null;
  confidence?: number | null;
  channel?: string | null;
  published?: boolean;
  engagement?: any | null;
  created_at?: string;
}

export interface MarketCorrelation {
  id?: string;
  asset_a: string;
  asset_b: string;
  correlation: number;
  timeframe: string;
  calculated_at: string;
}

export interface Subscriber {
  id?: string;
  user_id: string;
  chat_id: string;
  segments?: string[] | null;
  active?: boolean;
  preferences?: any | null;
  created_at?: string;
  updated_at?: string;
}

export interface UserPreference {
  id?: string;
  user_id: string;
  key: string;
  value: any;
  created_at?: string;
  updated_at?: string;
}

// ===================== CRUD Helpers =====================

export async function createSignal(signal: Omit<Signal, 'id' | 'created_at'>): Promise<Signal | null> {
  const { data, error } = await supabase.from('signals').insert(signal).select('*').single();
  if (error) { console.error('createSignal', error.message); return null; }
  return data as Signal;
}

export async function getSignals(filter: { status?: string; asset?: string; limit?: number } = {}): Promise<Signal[]> {
  let q = supabase.from('signals').select('*').order('created_at', { ascending: false }).limit(filter.limit ?? 50);
  if (filter.status) q = q.eq('status', filter.status);
  if (filter.asset) q = q.eq('asset', filter.asset.toUpperCase());
  const { data, error } = await q;
  if (error) { console.error('getSignals', error.message); return []; }
  return (data ?? []) as Signal[];
}

export async function createTrade(trade: Omit<Trade, 'id' | 'created_at' | 'updated_at'>): Promise<Trade | null> {
  const { data, error } = await supabase.from('trades').insert(trade).select('*').single();
  if (error) { console.error('createTrade', error.message); return null; }
  return data as Trade;
}

export async function updateTrade(id: string, update: Partial<Trade>): Promise<Trade | null> {
  const { data, error } = await supabase.from('trades').update({ ...update, updated_at: new Date().toISOString() }).eq('id', id).select('*').single();
  if (error) { console.error('updateTrade', error.message); return null; }
  return data as Trade;
}

export async function getPortfolio(userId?: string): Promise<PortfolioSnapshot | null> {
  let q = supabase.from('portfolio_snapshots').select('*').order('created_at', { ascending: false }).limit(1);
  if (userId) q = q.eq('user_id', userId);
  const { data, error } = await q;
  if (error) { console.error('getPortfolio', error.message); return null; }
  return (data?.[0] ?? null) as PortfolioSnapshot | null;
}

export async function logAgentActivity(log: Omit<AgentLog, 'id' | 'created_at'>): Promise<void> {
  try {
    await supabase.from('agent_logs').insert(log);
  } catch (e) {
    console.error('logAgentActivity failed', e);
  }
}

export async function createContentPost(post: Omit<ContentPost, 'id' | 'created_at'>): Promise<ContentPost | null> {
  const { data, error } = await supabase.from('content_posts').insert(post).select('*').single();
  if (error) { console.error('createContentPost', error.message); return null; }
  return data as ContentPost;
}

export async function getSubscribers(): Promise<Subscriber[]> {
  const { data, error } = await supabase.from('subscribers').select('*').eq('active', true);
  if (error) { console.error('getSubscribers', error.message); return []; }
  return (data ?? []) as Subscriber[];
}

export async function upsertSubscriber(sub: Omit<Subscriber, 'id' | 'created_at' | 'updated_at'>): Promise<Subscriber | null> {
  const { data, error } = await supabase.from('subscribers').upsert({ ...sub, updated_at: new Date().toISOString() }, { onConflict: 'user_id' }).select('*').single();
  if (error) { console.error('upsertSubscriber', error.message); return null; }
  return data as Subscriber;
}

export async function getUserPreference(userId: string, key: string): Promise<any> {
  const { data } = await supabase.from('user_preferences').select('value').eq('user_id', userId).eq('key', key).single();
  return data?.value ?? null;
}

export async function setUserPreference(userId: string, key: string, value: any): Promise<void> {
  await supabase.from('user_preferences').upsert({ user_id: userId, key, value, updated_at: new Date().toISOString() }, { onConflict: 'user_id,key' });
}

// Realtime: subscribe to new signal inserts -----------------------------
export function subscribeToSignals(onInsert: (signal: Signal) => void): () => void {
  const channel = supabase
    .channel('signals-realtime')
    .on(
      'postgres_changes' as any,
      { event: 'INSERT', schema: 'public', table: 'signals' },
      (payload: any) => {
        try { onInsert(payload.new as Signal); } catch (e) { console.error('subscribeToSignals callback', e); }
      }
    )
    .subscribe();
  return () => { supabase.removeChannel(channel); };
}

// Convenience helpers ------------------------------------------------------
export async function logAgent(args: {
  agent: string;
  action: string;
  level?: 'info' | 'warn' | 'error';
  input?: any;
  output?: any;
  duration_ms?: number;
  error?: string;
  user_id?: string;
}) {
  try {
    await supabase.from('agent_logs').insert({
      agent: args.agent,
      action: args.action,
      level: args.level ?? 'info',
      input: args.input ?? null,
      output: args.output ?? null,
      duration_ms: args.duration_ms ?? null,
      error: args.error ?? null,
      user_id: args.user_id ?? null,
    });
  } catch (e) {
    console.error('logAgent failed', e);
  }
}

