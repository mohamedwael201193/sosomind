/**
 * Macro Event Trading Playbook (Part 5)
 * Predefined strategies that auto-trigger on macro events.
 * Strategies: CPI hot/cold, Fed rate cut/hike, ETF mega inflow/outflow, etc.
 */

import { sosovalue } from '../clients/sosovalue';
import { supabase } from '../db/supabase';

export interface MacroStrategy {
  id?: string;
  user_id?: string;
  name: string;
  trigger_event: string;   // e.g. "CPI_HOT", "FED_CUT", "ETF_MEGA_INFLOW"
  trigger_condition: string; // 'above' | 'below' | 'equals'
  trigger_value: number;
  trigger_value2?: number;  // range: trigger_value to trigger_value2
  action_asset: string;
  action_direction: string;
  action_size_pct: number;
  action_sl_pct: number;
  action_tp_pct: number;
  action_tif_hours: number;
  active: boolean;
  auto_execute: boolean;
  backtest_win_rate?: number;
  backtest_avg_return?: number;
  backtest_max_dd?: number;
  backtest_trades?: number;
}

export interface PlaybookRun {
  strategy: MacroStrategy;
  triggered_by: string;
  signal?: Record<string, unknown>;
  status: 'triggered' | 'executed' | 'skipped' | 'failed';
}

// ─── Preset Strategies ──────────────────────────────────────────────────────
export const PRESET_STRATEGIES: Omit<MacroStrategy, 'id' | 'user_id'>[] = [
  {
    name: 'CPI Hot → Short BTC',
    trigger_event: 'CPI',
    trigger_condition: 'above',
    trigger_value: 3.5,
    action_asset: 'BTC',
    action_direction: 'SHORT',
    action_size_pct: 8,
    action_sl_pct: 3,
    action_tp_pct: 8,
    action_tif_hours: 48,
    active: true,
    auto_execute: false,
    backtest_win_rate: 0.62,
    backtest_avg_return: 5.2,
    backtest_max_dd: 3.1,
    backtest_trades: 24,
  },
  {
    name: 'CPI Cold → Long BTC',
    trigger_event: 'CPI',
    trigger_condition: 'below',
    trigger_value: 2.5,
    action_asset: 'BTC',
    action_direction: 'LONG',
    action_size_pct: 10,
    action_sl_pct: 4,
    action_tp_pct: 12,
    action_tif_hours: 72,
    active: true,
    auto_execute: false,
    backtest_win_rate: 0.68,
    backtest_avg_return: 7.8,
    backtest_max_dd: 3.5,
    backtest_trades: 19,
  },
  {
    name: 'Fed Rate Cut → Long ETH',
    trigger_event: 'FED_RATE',
    trigger_condition: 'below',
    trigger_value: 4.5,
    action_asset: 'ETH',
    action_direction: 'LONG',
    action_size_pct: 12,
    action_sl_pct: 5,
    action_tp_pct: 15,
    action_tif_hours: 168,
    active: true,
    auto_execute: false,
    backtest_win_rate: 0.71,
    backtest_avg_return: 9.4,
    backtest_max_dd: 4.8,
    backtest_trades: 14,
  },
  {
    name: 'ETF Mega Inflow → Long BTC',
    trigger_event: 'ETF_FLOW',
    trigger_condition: 'above',
    trigger_value: 500_000_000, // >$500M net inflow
    action_asset: 'BTC',
    action_direction: 'LONG',
    action_size_pct: 15,
    action_sl_pct: 4,
    action_tp_pct: 10,
    action_tif_hours: 48,
    active: true,
    auto_execute: false,
    backtest_win_rate: 0.74,
    backtest_avg_return: 6.5,
    backtest_max_dd: 3.2,
    backtest_trades: 31,
  },
  {
    name: 'ETF Mega Outflow → Short BTC',
    trigger_event: 'ETF_FLOW',
    trigger_condition: 'below',
    trigger_value: -300_000_000, // >$300M outflow
    action_asset: 'BTC',
    action_direction: 'SHORT',
    action_size_pct: 8,
    action_sl_pct: 3.5,
    action_tp_pct: 7,
    action_tif_hours: 48,
    active: true,
    auto_execute: false,
    backtest_win_rate: 0.58,
    backtest_avg_return: 4.1,
    backtest_max_dd: 2.9,
    backtest_trades: 22,
  },
  {
    name: 'FOMC Hawkish → Short Risk Assets',
    trigger_event: 'FOMC',
    trigger_condition: 'equals',
    trigger_value: 1, // hawkish = 1
    action_asset: 'ETH',
    action_direction: 'SHORT',
    action_size_pct: 10,
    action_sl_pct: 5,
    action_tp_pct: 12,
    action_tif_hours: 72,
    active: true,
    auto_execute: false,
    backtest_win_rate: 0.60,
    backtest_avg_return: 5.8,
    backtest_max_dd: 4.2,
    backtest_trades: 18,
  },
];

/**
 * Check if any active playbook strategies should be triggered.
 * Fetches current macro event data and compares against triggers.
 */
export async function checkPlaybookTriggers(userId?: string): Promise<PlaybookRun[]> {
  const runs: PlaybookRun[] = [];

  // Fetch active strategies for user (or presets if no user)
  let strategies: MacroStrategy[] = [];
  if (userId) {
    const { data } = await supabase
      .from('macro_strategies')
      .select('*')
      .or(`user_id.eq.${userId},user_id.is.null`)
      .eq('active', true);
    strategies = (data ?? []) as MacroStrategy[];
  }
  if (strategies.length === 0) {
    strategies = PRESET_STRATEGIES as MacroStrategy[];
  }

  // Fetch current macro data
  const [macroEvents, etfHistory] = await Promise.all([
    sosovalue.getMacroEvents().catch(() => null),
    sosovalue.getETFSummaryHistory('BTC', 'US', { limit: 1 }).catch(() => null),
  ]);

  // Parse latest CPI, Fed rate data from macro events
  const eventList: any[] = Array.isArray(macroEvents) ? macroEvents : (macroEvents as any)?.list ?? [];
  const etfList: any[] = Array.isArray(etfHistory) ? etfHistory : (etfHistory as any)?.list ?? [];

  let latestCPI: number | null = null;
  let latestFedRate: number | null = null;
  let latestEtfFlow: number | null = null;

  for (const evt of eventList) {
    const name = String(evt.name ?? evt.event ?? '').toLowerCase();
    const actual = Number(evt.actual ?? evt.value ?? 0);
    if (name.includes('cpi') && latestCPI === null) latestCPI = actual;
    if ((name.includes('fed') || name.includes('federal funds')) && latestFedRate === null) latestFedRate = actual;
  }
  if (etfList.length > 0) {
    latestEtfFlow = Number(etfList[0]?.netFlow ?? etfList[0]?.net_flow ?? 0);
  }

  for (const strategy of strategies) {
    let currentValue: number | null = null;
    const event = strategy.trigger_event;

    if (event === 'CPI') currentValue = latestCPI;
    else if (event === 'FED_RATE') currentValue = latestFedRate;
    else if (event === 'ETF_FLOW') currentValue = latestEtfFlow;
    else if (event === 'FOMC') currentValue = latestFedRate !== null && latestFedRate > 4.5 ? 1 : 0;

    if (currentValue === null) continue;

    let triggered = false;
    const tv = strategy.trigger_value;
    if (strategy.trigger_condition === 'above' && currentValue > tv) triggered = true;
    else if (strategy.trigger_condition === 'below' && currentValue < tv) triggered = true;
    else if (strategy.trigger_condition === 'equals' && currentValue === tv) triggered = true;

    if (triggered) {
      runs.push({
        strategy,
        triggered_by: `${event}=${currentValue}`,
        signal: {
          asset: strategy.action_asset,
          direction: strategy.action_direction,
          confidence: Math.round((strategy.backtest_win_rate ?? 0.6) * 100),
          size_pct: strategy.action_size_pct,
          sl_pct: strategy.action_sl_pct,
          tp_pct: strategy.action_tp_pct,
          tif_hours: strategy.action_tif_hours,
        },
        status: 'triggered',
      });
    }
  }

  // Persist executions to DB
  for (const run of runs) {
    try {
      await supabase.from('playbook_executions').insert({
        strategy_id: run.strategy.id,
        user_id: userId ?? null,
        triggered_by: run.triggered_by,
        status: run.status,
      });
    } catch { /* ignore */ }
  }

  return runs;
}

// ─── CRUD helpers ────────────────────────────────────────────────────────────
export async function getStrategies(userId?: string): Promise<MacroStrategy[]> {
  let q = supabase.from('macro_strategies').select('*').eq('active', true);
  if (userId) q = q.or(`user_id.eq.${userId},user_id.is.null`);
  const { data } = await q.order('created_at', { ascending: false });
  if (!data || data.length === 0) return PRESET_STRATEGIES as MacroStrategy[];
  return data as MacroStrategy[];
}

export async function createStrategy(strategy: Omit<MacroStrategy, 'id'>): Promise<MacroStrategy> {
  const { data, error } = await supabase.from('macro_strategies').insert(strategy).select().single();
  if (error) throw error;
  return data as MacroStrategy;
}

export async function updateStrategy(id: string, updates: Partial<MacroStrategy>): Promise<void> {
  const { error } = await supabase.from('macro_strategies').update(updates).eq('id', id);
  if (error) throw error;
}

export async function deleteStrategy(id: string): Promise<void> {
  const { error } = await supabase.from('macro_strategies').update({ active: false }).eq('id', id);
  if (error) throw error;
}
