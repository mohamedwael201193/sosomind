import { Router } from 'express';
import { getSectorMomentum } from '../agents/sectorRotation';
import { asyncHandler } from '../utils/http';

const router = Router();

router.get('/', asyncHandler(async (_req, res) => {
  const sectors = await getSectorMomentum();
  res.json({ data: sectors });
}));

router.get('/:sector', asyncHandler(async (req, res) => {
  const all = await getSectorMomentum();
  const match = all.find((s) => s.sector.toLowerCase() === req.params.sector.toLowerCase());
  if (!match) return res.status(404).json({ error: 'Sector not found' });
  res.json({ data: match });
}));

export default router;
