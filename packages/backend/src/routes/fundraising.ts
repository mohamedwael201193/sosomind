import { Router } from 'express';
import { z } from 'zod';
import { sosovalue } from '../clients/sosovalue';
import { asyncHandler, validate, cached } from '../utils/http';

const router = Router();

router.get('/projects', validate(z.object({ page: z.coerce.number().default(1), page_size: z.coerce.number().default(50) })), asyncHandler(async (req, res) => {
  const params = (req as any).validated;
  const data = await cached(`soso:fund:projects:${JSON.stringify(params)}`, 120, () => sosovalue.getFundraisingProjects(params));
  res.json({ data });
}));

router.get('/projects/:id', asyncHandler(async (req, res) => {
  const data = await cached(`soso:fund:project:${req.params.id}`, 300, () => sosovalue.getFundraisingProjectDetail(req.params.id));
  res.json({ data });
}));

export default router;
