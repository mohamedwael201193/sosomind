import { Router } from 'express';
import { z } from 'zod';
import { supabase } from '../db/supabase';
import { asyncHandler, validate } from '../utils/http';
import { generateMarketBrief, publishToChannel, runDailyBriefing } from '../content/pipeline';
import { wrapMeta } from '../utils/responseMeta';

const router = Router();

router.post('/generate', asyncHandler(async (_req, res) => {
  const brief = await generateMarketBrief();
  // Persist to DB so it shows up in /posts
  await supabase.from('content_posts').insert({
    title: brief.title,
    body: brief.body,
    summary: brief.body.slice(0, 200).replace(/<[^>]+>/g, ''),
    symbols: ['BTC', 'ETH'],
    sentiment: 'neutral',
    published: false,
    citations: brief.citations ?? [],
  } as any);
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
  const cachedAt = data && data[0]?.created_at ? new Date(data[0].created_at).getTime() : Date.now();
  res.json(wrapMeta(data ?? [], { ttlMs: 30_000, source: 'live', cachedAt }));
}));

router.get('/latest', asyncHandler(async (_req, res) => {
  const { data, error } = await supabase.from('content_posts')
    .select('*').order('created_at', { ascending: false }).limit(1);
  if (error) throw error;
  const post = data && data[0] ? data[0] : null;
  const cachedAt = post?.created_at ? new Date(post.created_at).getTime() : Date.now();
  res.json(wrapMeta(post, { ttlMs: 15 * 60_000, source: 'live', cachedAt }));
}));

router.get('/post/:id', asyncHandler(async (req, res) => {
  const { data, error } = await supabase.from('content_posts').select('*').eq('id', req.params.id).maybeSingle();
  if (error) throw error;
  if (!data) return res.status(404).json({ error: 'not_found' });
  const cachedAt = data.created_at ? new Date(data.created_at).getTime() : Date.now();
  res.json(wrapMeta(data, { ttlMs: 60 * 60_000, source: 'live', cachedAt }));
}));

router.post('/trigger', asyncHandler(async (req, res) => {
  const secret = req.headers['x-cron-secret'] || (req.body && req.body.secret);
  if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  const bot = (globalThis as any).__sosomind_bot;
  if (bot) await runDailyBriefing(bot);
  else {
    const brief = await generateMarketBrief();
    await supabase.from('content_posts').insert({
      title: brief.title,
      body: brief.body,
      summary: brief.body.slice(0, 200).replace(/<[^>]+>/g, ''),
      symbols: ['BTC', 'ETH'],
      sentiment: 'neutral',
      published: false,
      citations: brief.citations ?? [],
    } as any);
  }
  res.json({ ok: true, ts: new Date().toISOString() });
}));

// SSE stream — pushes new content_posts as they appear (15s poll).
router.get('/stream', asyncHandler(async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  (res as any).flushHeaders?.();

  let lastSeen: string | null = null;
  let closed = false;
  req.on('close', () => { closed = true; });
  res.write(`event: hello\ndata: ${JSON.stringify({ ts: Date.now() })}\n\n`);

  while (!closed) {
    try {
      const { data } = await supabase.from('content_posts')
        .select('*').order('created_at', { ascending: false }).limit(5);
      if (data && data.length) {
        const fresh = lastSeen ? data.filter((d: any) => d.created_at > lastSeen!) : [data[0]];
        for (const row of fresh.reverse()) {
          res.write(`event: post\ndata: ${JSON.stringify(row)}\n\n`);
        }
        lastSeen = data[0].created_at;
      }
      res.write(`event: ping\ndata: ${Date.now()}\n\n`);
    } catch (e: any) {
      res.write(`event: error\ndata: ${JSON.stringify({ message: e?.message })}\n\n`);
    }
    await new Promise((r) => setTimeout(r, 15_000));
  }
}));

export default router;
