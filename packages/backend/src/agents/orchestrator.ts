import { runResearchAgent, ResearchSignal } from './research';
import { runRiskAgent } from './risk';
import { runExecutionAgent } from './execution';
import { isGlobalCircuitOpen, isAssetBlocked } from './circuitBreaker';
import { logAgent, getSubscribers } from '../db/supabase';

export type AgentTask =
  | { type: 'research'; asset: string; userId?: string }
  | { type: 'execute'; signal: ResearchSignal & { id?: string }; market: string; side: 'buy' | 'sell'; amount: number; userId?: string }
  | { type: 'content'; asset?: string };

export interface OrchestrationResult {
  task: AgentTask['type'];
  status: 'completed' | 'blocked' | 'failed';
  signal?: ResearchSignal;
  riskVerdict?: string;
  execution?: any;
  reason?: string;
}

export async function orchestrate(task: AgentTask): Promise<OrchestrationResult> {
  const startedAt = Date.now();

  if (task.type === 'research') {
    try {
      // 1. Check global circuit
      if (isGlobalCircuitOpen()) {
        return { task: 'research', status: 'blocked', reason: 'Global circuit breaker open — trading paused' };
      }
      if (isAssetBlocked(task.asset)) {
        return { task: 'research', status: 'blocked', reason: `${task.asset} is blocked by circuit breaker (24h drop)` };
      }

      // 2. Run research agent
      const signal = await runResearchAgent(task.asset, { saveToDb: true, userId: task.userId });

      // 3. Run risk agent
      const risk = await runRiskAgent({
        asset: task.asset,
        side: signal.direction === 'LONG' ? 'buy' : 'sell',
        amount: 0,
        price: signal.entry ?? 0,
        userId: task.userId,
      });

      await logAgent({
        agent: 'orchestrator', action: 'research:complete',
        output: { signal: { direction: signal.direction, confidence: signal.confidence }, riskVerdict: risk.verdict },
        duration_ms: Date.now() - startedAt,
        user_id: task.userId,
      });

      return { task: 'research', status: 'completed', signal, riskVerdict: risk.verdict };
    } catch (e) {
      return { task: 'research', status: 'failed', reason: (e as Error).message };
    }
  }

  if (task.type === 'execute') {
    try {
      if (isGlobalCircuitOpen()) {
        return { task: 'execute', status: 'blocked', reason: 'Global circuit breaker open' };
      }
      const asset = task.market.split(/[-_]/)[0];
      if (isAssetBlocked(asset)) {
        return { task: 'execute', status: 'blocked', reason: `${asset} blocked by circuit breaker` };
      }

      const result = await runExecutionAgent({
        userId: task.userId,
        signal: task.signal,
        market: task.market,
        side: task.side,
        amount: task.amount,
      });

      await logAgent({
        agent: 'orchestrator', action: 'execute:complete',
        output: { status: result.status, tradeId: result.trade?.id },
        duration_ms: Date.now() - startedAt,
        user_id: task.userId,
      });

      return { task: 'execute', status: 'completed', execution: result };
    } catch (e) {
      return { task: 'execute', status: 'failed', reason: (e as Error).message };
    }
  }

  return { task: task.type, status: 'failed', reason: 'Unknown task type' };
}

// Background research loop — run every 4h
export function startResearchLoop(assets = ['BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'AVAX', 'LINK', 'DOGE']): void {
  const run = async () => {
    for (const asset of assets) {
      await orchestrate({ type: 'research', asset }).catch((e) =>
        console.error('orchestrate loop error', asset, e.message)
      );
      await new Promise((r) => setTimeout(r, 5000));
    }
  };
  // Run once 30s after startup, then every 4h
  setTimeout(() => run(), 30_000);
  setInterval(() => run(), 4 * 60 * 60 * 1000);
}
