import { Router } from 'express';
import { z } from 'zod';
import { supabase, createTrade, updateTrade } from '../db/supabase';
import { runExecutionAgent } from '../agents/execution';
import { asyncHandler, validate } from '../utils/http';

const router = Router();

router.get('/', validate(z.object({ limit: z.coerce.number().default(50) })), asyncHandler(async (req, res) => {
  const { limit } = (req as any).validated;
  const { data, error } = await supabase.from('trades').select('*').order('created_at', { ascending: false }).limit(limit);
  if (error) throw error;
  res.json({ data });
}));

router.get('/:id', asyncHandler(async (req, res) => {
  const { data, error } = await supabase.from('trades').select('*').eq('id', req.params.id).single();
  if (error) throw error;
  res.json({ data });
}));

// House-wallet execution — disabled on public deploy unless ALLOW_HOUSE_TRADES=true + ADMIN_API_KEY
router.post('/', validate(z.object({
  symbol: z.string().min(1),
  side: z.enum(['buy', 'sell']),
  amount: z.number().positive(),
  price: z.number().optional(),
  orderType: z.enum(['market', 'limit']).default('market'),
  userId: z.string().optional(),
}), 'body'), asyncHandler(async (req, res) => {
  const allowHouse = process.env.ALLOW_HOUSE_TRADES === 'true';
  const adminKey = process.env.ADMIN_API_KEY;
  const provided = req.headers['x-admin-key'] as string | undefined;
  if (!allowHouse || !adminKey || provided !== adminKey) {
    return res.status(403).json({
      error: 'house_trades_disabled',
      message: 'Use dashboard MetaMask relay (/api/sodex/relay) or Telegram bot for user-signed execution.',
    });
  }
  const v = (req as any).validated;
  const market = v.symbol.includes('_') || v.symbol.includes('-') ? v.symbol : `${v.symbol}_vUSDC`;
  const result = await runExecutionAgent({
    market,
    side: v.side,
    amount: v.amount,
    price: v.price,
    orderType: v.orderType,
    userId: v.userId,
  });
  res.json(result);
}));

export default router;
