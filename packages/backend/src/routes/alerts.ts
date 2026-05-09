import { Router } from 'express';
import { z } from 'zod';
import { supabase } from '../db/supabase';
import { asyncHandler, validate } from '../utils/http';

const router = Router();

router.get('/', asyncHandler(async (_req, res) => {
  const { data, error } = await supabase.from('alerts').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  res.json({ data });
}));

router.post('/', validate(z.object({
  type: z.string().min(1),
  asset: z.string().optional(),
  condition: z.string().optional(),
  threshold: z.coerce.number().optional(),
  message: z.string().optional(),
  user_id: z.string().uuid().optional(),
}), 'body'), asyncHandler(async (req, res) => {
  const v = (req as any).validated;
  const { data, error } = await supabase.from('alerts').insert(v).select('*').single();
  if (error) throw error;
  res.json({ data });
}));

router.delete('/:id', asyncHandler(async (req, res) => {
  const { error } = await supabase.from('alerts').delete().eq('id', req.params.id);
  if (error) throw error;
  res.json({ ok: true });
}));

export default router;
