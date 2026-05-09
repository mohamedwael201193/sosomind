import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler, validate } from '../utils/http';
import { createPaperTrade, closePaperTrade, getPaperTrades, getPaperLeaderboard, autoCloseExpiredPaperTrades } from '../simulation/paperTrading';
import { publishSignal, getMarketplaceSignals, followCreator, unfollowCreator, getFollowing, getMarketplaceLeaderboard } from '../social/marketplace';
import { checkPlaybookTriggers, getStrategies, createStrategy, updateStrategy, deleteStrategy } from '../strategies/playbook';
import { generateRebalanceRecommendation } from '../rebalance/engine';
import { getUserPersona, setUserPersona, getPersonaQuiz, inferPersonaFromQuiz } from '../agents/persona';
import { generateTaxReport, taxReportToCsv } from '../tax/reporter';

const router = Router();

// ─── Paper Trading (Part 7) ─────────────────────────────────────────────────
router.get('/paper/trades', asyncHandler(async (req, res) => {
  const userId = req.query.user_id as string;
  if (!userId) return res.status(400).json({ error: 'user_id required' });
  const status = req.query.status as string | undefined;
  const trades = await getPaperTrades(userId, status as any);
  res.json({ data: trades });
}));

router.post('/paper/trades',
  validate(z.object({
    user_id: z.string(),
    symbol: z.string(),
    side: z.enum(['buy', 'sell']),
    amount_usd: z.number(),
  })),
  asyncHandler(async (req, res) => {
    const { user_id, symbol, side, amount_usd } = (req as any).validated;
    const trade = await createPaperTrade(user_id, symbol, side, amount_usd);
    res.json({ data: trade });
  })
);

router.post('/paper/trades/:id/close', asyncHandler(async (req, res) => {
  const exitPrice = req.body?.exit_price ? Number(req.body.exit_price) : undefined;
  const trade = await closePaperTrade(req.params.id, exitPrice);
  res.json({ data: trade });
}));

router.get('/paper/leaderboard', asyncHandler(async (req, res) => {
  const limit = Number(req.query.limit ?? 20);
  const entries = await getPaperLeaderboard(limit);
  res.json({ data: entries });
}));

router.post('/paper/auto-close', asyncHandler(async (_req, res) => {
  const count = await autoCloseExpiredPaperTrades();
  res.json({ closed: count });
}));

// ─── Signal Marketplace (Part 2) ────────────────────────────────────────────
router.get('/marketplace/signals', asyncHandler(async (req, res) => {
  const limit = Number(req.query.limit ?? 20);
  const signals = await getMarketplaceSignals(limit);
  res.json({ data: signals });
}));

router.post('/marketplace/signals',
  validate(z.object({
    creator_id: z.string(),
    asset: z.string(),
    direction: z.string(),
    confidence: z.number(),
    entry: z.number(),
    take_profit: z.number().optional(),
    stop_loss: z.number().optional(),
    reasoning: z.string().optional(),
  })),
  asyncHandler(async (req, res) => {
    const signal = await publishSignal((req as any).validated);
    res.json({ data: signal });
  })
);

router.get('/marketplace/leaderboard', asyncHandler(async (req, res) => {
  const limit = Number(req.query.limit ?? 20);
  const viewerId = req.query.viewer_id as string | undefined;
  const entries = await getMarketplaceLeaderboard(limit, viewerId);
  res.json({ data: entries });
}));

router.post('/marketplace/follow',
  validate(z.object({ follower_id: z.string(), creator_id: z.string(), auto_copy: z.boolean().default(false), max_position_pct: z.number().default(5) })),
  asyncHandler(async (req, res) => {
    const { follower_id, creator_id, auto_copy, max_position_pct } = (req as any).validated;
    await followCreator(follower_id, creator_id, auto_copy, max_position_pct);
    res.json({ ok: true });
  })
);

router.delete('/marketplace/follow',
  validate(z.object({ follower_id: z.string(), creator_id: z.string() })),
  asyncHandler(async (req, res) => {
    const { follower_id, creator_id } = (req as any).validated;
    await unfollowCreator(follower_id, creator_id);
    res.json({ ok: true });
  })
);

router.get('/marketplace/following', asyncHandler(async (req, res) => {
  const followerId = req.query.follower_id as string;
  if (!followerId) return res.status(400).json({ error: 'follower_id required' });
  const following = await getFollowing(followerId);
  res.json({ data: following });
}));

// ─── Macro Playbook (Part 5) ─────────────────────────────────────────────────
router.get('/playbook', asyncHandler(async (req, res) => {
  const userId = req.query.user_id as string | undefined;
  const strategies = await getStrategies(userId);
  res.json({ data: strategies });
}));

router.post('/playbook/check', asyncHandler(async (req, res) => {
  const userId = req.query.user_id as string | undefined;
  const results = await checkPlaybookTriggers(userId);
  res.json({ data: results });
}));

router.post('/playbook',
  validate(z.object({
    user_id: z.string(),
    name: z.string(),
    trigger_event: z.string(),
    trigger_condition: z.enum(['above', 'below', 'increases', 'decreases']),
    trigger_value: z.number(),
    action_asset: z.string(),
    action_direction: z.enum(['long', 'short']),
    action_size_pct: z.number(),
    action_sl_pct: z.number().optional(),
    action_tp_pct: z.number().optional(),
    action_tif_hours: z.number().optional(),
    active: z.boolean().default(true),
    auto_execute: z.boolean().default(false),
  })),
  asyncHandler(async (req, res) => {
    const strategy = await createStrategy((req as any).validated);
    res.json({ data: strategy });
  })
);

router.put('/playbook/:id',
  asyncHandler(async (req, res) => {
    const strategy = await updateStrategy(req.params.id, req.body);
    res.json({ data: strategy });
  })
);

router.delete('/playbook/:id', asyncHandler(async (req, res) => {
  await deleteStrategy(req.params.id);
  res.json({ ok: true });
}));

// ─── Portfolio Rebalancer (Part 6) ───────────────────────────────────────────
router.get('/rebalance', asyncHandler(async (req, res) => {
  const userId = req.query.user_id as string | undefined;
  const portfolioValue = Number(req.query.portfolio_value ?? 10000);
  const result = await generateRebalanceRecommendation(userId, undefined, portfolioValue);
  res.json({ data: result });
}));

router.post('/rebalance',
  validate(z.object({
    user_id: z.string().optional(),
    portfolio_value: z.number().default(10000),
    holdings: z.record(z.number()).optional(),
  })),
  asyncHandler(async (req, res) => {
    const { user_id, portfolio_value, holdings } = (req as any).validated;
    const result = await generateRebalanceRecommendation(user_id, holdings, portfolio_value);
    res.json({ data: result });
  })
);

// ─── Trader Persona (Part 14) ────────────────────────────────────────────────
router.get('/persona', asyncHandler(async (req, res) => {
  const userId = req.query.user_id as string;
  if (!userId) return res.status(400).json({ error: 'user_id required' });
  const persona = await getUserPersona(userId);
  res.json({ data: { persona } });
}));

router.post('/persona',
  validate(z.object({ user_id: z.string(), persona: z.enum(['aggressive', 'balanced', 'conservative', 'quant', 'swing']) })),
  asyncHandler(async (req, res) => {
    const { user_id, persona } = (req as any).validated;
    await setUserPersona(user_id, persona);
    res.json({ ok: true, persona });
  })
);

router.get('/persona/quiz', asyncHandler(async (_req, res) => {
  const quiz = getPersonaQuiz();
  res.json({ data: quiz });
}));

router.post('/persona/quiz',
  validate(z.object({ answers: z.array(z.number()) })),
  asyncHandler(async (req, res) => {
    const { answers } = (req as any).validated;
    const persona = inferPersonaFromQuiz(answers);
    res.json({ data: { persona } });
  })
);

// ─── Tax Reporting (Part 12) ─────────────────────────────────────────────────
router.get('/tax/report', asyncHandler(async (req, res) => {
  const userId = req.query.user_id as string;
  if (!userId) return res.status(400).json({ error: 'user_id required' });
  const year = Number(req.query.year ?? new Date().getFullYear() - 1);
  const report = await generateTaxReport(userId, year);
  
  if (req.query.format === 'csv') {
    const csv = taxReportToCsv(report);
    res.set('Content-Type', 'text/csv');
    res.set('Content-Disposition', `attachment; filename="tax_report_${year}.csv"`);
    return res.send(csv);
  }
  
  res.json({ data: report });
}));

export default router;
