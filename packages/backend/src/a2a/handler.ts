// Agent-to-Agent (A2A) protocol handler.
// Lets external AI agents query SosoMind for research / signals / risk checks.

import { runResearchAgent } from '../agents/research';
import { getMacroOutlook } from '../agents/macroOverlay';
import { getSectorMomentum } from '../agents/sectorRotation';
import { getSignals } from '../db/supabase';

export interface A2ARequest {
  fromAgent: string;
  intent: 'research' | 'signal' | 'risk_check' | 'macro' | 'sectors';
  params?: Record<string, any>;
}

export interface A2AResponse {
  status: 'success' | 'error';
  fromAgent: 'sosomind';
  toAgent: string;
  intent: string;
  data?: any;
  error?: string;
  timestamp: string;
}

const ALLOWED_INTENTS: A2ARequest['intent'][] = ['research', 'signal', 'risk_check', 'macro', 'sectors'];

export async function handleA2ARequest(req: A2ARequest): Promise<A2AResponse> {
  const base = {
    fromAgent: 'sosomind' as const,
    toAgent: req.fromAgent || 'unknown',
    intent: req.intent,
    timestamp: new Date().toISOString(),
  };

  if (!req.intent || !ALLOWED_INTENTS.includes(req.intent)) {
    return { status: 'error', error: `unsupported intent. allowed=${ALLOWED_INTENTS.join(',')}`, ...base };
  }

  try {
    switch (req.intent) {
      case 'research': {
        const asset = String(req.params?.asset || 'BTC').toUpperCase();
        const signal = await runResearchAgent(asset, { saveToDb: false });
        return { status: 'success', data: signal, ...base };
      }
      case 'signal': {
        const asset = req.params?.asset ? String(req.params.asset).toUpperCase() : undefined;
        const signals = await getSignals({ asset, limit: Number(req.params?.limit ?? 5) });
        return { status: 'success', data: signals, ...base };
      }
      case 'macro': {
        const outlook = await getMacroOutlook();
        return { status: 'success', data: outlook, ...base };
      }
      case 'sectors': {
        const sectors = await getSectorMomentum();
        return { status: 'success', data: sectors, ...base };
      }
      case 'risk_check': {
        // Lightweight risk check: returns max trade size, daily limit, current open count
        return {
          status: 'success',
          data: {
            maxTradeSizePct: Number(process.env.MAX_TRADE_SIZE_PCT || 25),
            maxTradesPerDay: Number(process.env.MAX_TRADES_PER_DAY || 100),
            dryRun: process.env.DRY_RUN === 'true',
          },
          ...base,
        };
      }
    }
  } catch (e) {
    return { status: 'error', error: (e as Error).message, ...base };
  }
  // unreachable
  return { status: 'error', error: 'unhandled', ...base };
}
