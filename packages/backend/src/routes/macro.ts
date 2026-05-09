import { Router } from 'express';
import { z } from 'zod';
import { sosovalue } from '../clients/sosovalue';
import { asyncHandler, validate, cached } from '../utils/http';

const router = Router();

router.get('/events', asyncHandler(async (_req, res) => {
  const data = await cached('soso:macro:events', 120, () => sosovalue.getMacroEvents());
  res.json({ data });
}));

router.get('/history', validate(z.object({ event: z.string().min(1), start_date: z.string().optional(), end_date: z.string().optional(), limit: z.coerce.number().default(20) })), asyncHandler(async (req, res) => {
  const { event, ...extra } = (req as any).validated;
  const data = await cached(`soso:macro:hist:${event}:${JSON.stringify(extra)}`, 300, () => sosovalue.getMacroHistory(event, extra));
  res.json({ data });
}));

export default router;
