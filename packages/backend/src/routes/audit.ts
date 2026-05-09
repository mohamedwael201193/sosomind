import { Router } from 'express';
import { z } from 'zod';
import { supabase } from '../db/supabase';
import { asyncHandler, validate } from '../utils/http';

const router = Router();

router.get('/logs', validate(z.object({
  agent: z.string().optional(),
  level: z.string().optional(),
  limit: z.coerce.number().default(100),
  page: z.coerce.number().default(1),
})), asyncHandler(async (req, res) => {
  const { agent, level, limit, page } = (req as any).validated;
  const offset = (page - 1) * limit;
  let q = supabase.from('agent_logs').select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);
  if (agent) q = q.eq('agent', agent);
  if (level) q = q.eq('level', level);
  const { data, error, count } = await q;
  if (error) throw error;
  res.json({ data, total: count, page, limit });
}));

export default router;
