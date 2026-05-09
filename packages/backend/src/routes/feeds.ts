import { Router } from 'express';
import { z } from 'zod';
import { sosovalue } from '../clients/sosovalue';
import { asyncHandler, validate, cached } from '../utils/http';

const router = Router();

router.get('/', validate(z.object({ page: z.coerce.number().default(1), page_size: z.coerce.number().default(20), category: z.string().optional(), language: z.string().optional() })), asyncHandler(async (req, res) => {
  const params = (req as any).validated;
  const data = await cached(`soso:news:feed:${JSON.stringify(params)}`, 60, () => sosovalue.getNewsFeed(params));
  res.json({ data });
}));

router.get('/hot', validate(z.object({ page: z.coerce.number().default(1), page_size: z.coerce.number().default(10) })), asyncHandler(async (req, res) => {
  const params = (req as any).validated;
  const data = await cached(`soso:news:hot:${JSON.stringify(params)}`, 60, () => sosovalue.getHotNews(params));
  res.json({ data });
}));

router.get('/featured', validate(z.object({ page: z.coerce.number().default(1), page_size: z.coerce.number().default(10) })), asyncHandler(async (req, res) => {
  const { page, page_size } = (req as any).validated;
  const data = await cached(`soso:news:feat:${page}:${page_size}`, 60, () => sosovalue.getFeaturedNews(page, page_size));
  res.json({ data });
}));

router.get('/search', validate(z.object({ q: z.string().min(1), page: z.coerce.number().default(1), page_size: z.coerce.number().default(20) })), asyncHandler(async (req, res) => {
  const { q, page, page_size } = (req as any).validated;
  const data = await cached(`soso:news:search:${q}:${page}:${page_size}`, 60, () => sosovalue.searchNews(q, { page, page_size }));
  res.json({ data });
}));

export default router;
