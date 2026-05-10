import type { Request, Response, NextFunction } from 'express';
import { extractWallet } from '../routes/auth.js';

/**
 * Express middleware that requires a valid SIWE JWT.
 * On success attaches `req.wallet` (lowercased 0x address).
 */
export interface AuthedRequest extends Request {
  wallet?: string;
}

export function requireWallet(req: AuthedRequest, res: Response, next: NextFunction) {
  const wallet = extractWallet(req.headers.authorization);
  if (!wallet) {
    return res.status(401).json({ error: 'unauthorized', message: 'Connect wallet and sign in first' });
  }
  req.wallet = wallet.toLowerCase();
  next();
}
