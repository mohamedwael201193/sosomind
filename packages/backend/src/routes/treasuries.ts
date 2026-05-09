import { Router } from 'express';
import { z } from 'zod';
import { sosovalue } from '../clients/sosovalue';
import { asyncHandler, validate, cached } from '../utils/http';

const router = Router();

router.get('/', asyncHandler(async (_req, res) => {
  const data = await cached('soso:treasuries', 300, () => sosovalue.getBTCTreasuries());
  res.json({ data });
}));

router.get('/purchase-history', validate(z.object({ company: z.string().min(1), limit: z.coerce.number().default(50) })), asyncHandler(async (req, res) => {
  const { company, limit } = (req as any).validated;
  const data = await cached(`soso:treasury:hist:${company}:${limit}`, 300, () => sosovalue.getBTCPurchaseHistory(company, limit));
  res.json({ data });
}));

export default router;
