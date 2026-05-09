import { Redis } from '@upstash/redis';

export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

/**
 * Cache-aside pattern. Returns cached value if present, otherwise calls fetcher,
 * stores the result, and returns it. Errors from cache are non-fatal.
 */
export async function cachedFetch<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlSeconds = 30
): Promise<T> {
  try {
    const cached = await redis.get<T>(key);
    if (cached !== null && cached !== undefined) return cached as T;
  } catch (e) {
    console.warn('redis read failed', (e as Error).message);
  }

  const fresh = await fetcher();
  try {
    await redis.set(key, fresh as any, { ex: ttlSeconds });
  } catch (e) {
    console.warn('redis write failed', (e as Error).message);
  }
  return fresh;
}

export async function rateLimit(ipKey: string, max = 60, windowSec = 60): Promise<boolean> {
  try {
    const key = `rl:${ipKey}`;
    const count = await redis.incr(key);
    if (count === 1) await redis.expire(key, windowSec);
    return count <= max;
  } catch {
    return true; // fail-open if Redis is down
  }
}
