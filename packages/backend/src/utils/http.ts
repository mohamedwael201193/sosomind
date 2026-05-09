import { Request, Response, NextFunction } from 'express';
import { ZodSchema } from 'zod';
import { cachedFetch } from '../clients/redis';

export function asyncHandler<T extends Request = Request>(
  fn: (req: T, res: Response, next: NextFunction) => Promise<any>
) {
  return (req: T, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch((err) => {
      console.error('route error', err?.message || err);
      const status = err?.response?.status || err?.status || 500;
      const payload = err?.response?.data || { error: err?.message || 'Internal server error' };
      res.status(status).json(payload);
    });
  };
}

export function validate<T>(schema: ZodSchema<T>, source: 'query' | 'body' | 'params' = 'query') {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse((req as any)[source]);
    if (!result.success) {
      return res.status(400).json({ error: 'Validation failed', details: result.error.flatten() });
    }
    (req as any).validated = result.data;
    next();
  };
}

export async function cached<T>(key: string, ttl: number, fetcher: () => Promise<T>) {
  return cachedFetch<T>(key, fetcher, ttl);
}
