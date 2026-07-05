import { Router } from 'express';
import {
  ENVIRONMENT_PROFILES,
  getDefaultProfileId,
  publicProfileSummary,
  isTradingKillSwitchActive,
  parseAllowlist,
} from '../config/environment.js';
import { asyncHandler } from '../utils/http.js';
import { resolveProfileFromRequest } from '../config/environment.js';

const router = Router();

router.get('/environment', asyncHandler(async (req, res) => {
  const active = resolveProfileFromRequest(req);
  const defaultId = getDefaultProfileId();
  res.json({
    data: {
      active: publicProfileSummary(active),
      defaultId,
      profiles: Object.values(ENVIRONMENT_PROFILES).map(publicProfileSummary),
      selectors: [
        { id: 'testnet', label: 'Testnet', chainId: 138565 },
        { id: 'mainnet', label: 'Mainnet', chainId: 286623 },
      ],
      trading: {
        killSwitch: isTradingKillSwitchActive(),
        allowlistSize: parseAllowlist().size,
        dryRun: process.env.DRY_RUN === 'true',
      },
    },
  });
}));

export default router;
