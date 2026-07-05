import type { Request, Response, NextFunction } from 'express';
import { resolveProfileFromRequest, type EnvironmentProfile } from '../config/environment.js';

declare global {
  namespace Express {
    interface Request {
      sosomindEnv?: EnvironmentProfile;
    }
  }
}

export function attachEnvironment(req: Request, _res: Response, next: NextFunction) {
  req.sosomindEnv = resolveProfileFromRequest(req);
  next();
}
