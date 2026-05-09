import { Router } from 'express';
import { z } from 'zod';
import { sosovalue } from '../clients/sosovalue';
import { asyncHandler, validate, cached } from '../utils/http';

const router = Router();

router.get('/', asyncHandler(async (_req, res) => {
  const data = await cached('soso:analyses:list', 300, () => sosovalue.getAnalysisCharts());
  res.json({ data });
}));

router.get('/:chartName', validate(z.object({ limit: z.coerce.number().default(100) })), asyncHandler(async (req, res) => {
  const { limit } = (req as any).validated;
  const data = await cached(`soso:analyses:${req.params.chartName}:${limit}`, 60, () => sosovalue.getAnalysisChartData(req.params.chartName, limit));
  res.json({ data });
}));

export default router;
