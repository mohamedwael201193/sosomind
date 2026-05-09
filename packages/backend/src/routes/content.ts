import { Router } from 'express';
import { z } from 'zod';
import { supabase } from '../db/supabase';
import { asyncHandler, validate } from '../utils/http';
import { generateMarketBrief, publishToChannel } from '../content/pipeline';

const router = Router();

router.post('/generate', asyncHandler(async (_req, res) => {
  const brief = await generateMarketBrief();
  res.json({ data: brief });
}));

router.post('/publish', asyncHandler(async (req, res) => {
  const channelId = req.body?.channelId || process.env.TELEGRAM_CHANNEL_ID;
  if (!channelId) return res.status(400).json({ error: 'No TELEGRAM_CHANNEL_ID configured' });
  const brief = await generateMarketBrief();
  const bot = (globalThis as any).__sosomind_bot;
  if (!bot) return res.status(503).json({ error: 'Bot not initialized' });
  await publishToChannel(channelId, brief, bot);
  res.json({ ok: true, channelId });
}));

router.get('/posts', validate(z.object({ limit: z.coerce.number().default(20) })), asyncHandler(async (req, res) => {
  const { limit } = (req as any).validated;
  const { data, error } = await supabase.from('content_posts').select('*').order('created_at', { ascending: false }).limit(limit);
  if (error) throw error;
  res.json({ data });
}));

export default router;
