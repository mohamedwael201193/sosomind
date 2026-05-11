/**
 * responseMeta — uniform freshness metadata wrapper for API responses.
 *
 * Every data endpoint should return:
 *   { data, meta: { cachedAt, ageMs, isStale, source, ttlMs } }
 *
 * The frontend `CacheBadge` reads `meta` to render Live / Cached / Stale chips.
 */

export type DataSource = 'live' | 'cache' | 'fallback' | 'computed';

export interface ResponseMeta {
  cachedAt: string;        // ISO timestamp when the data was first observed
  ageMs: number;           // milliseconds since cachedAt
  isStale: boolean;        // ageMs > ttlMs
  source: DataSource;      // where the data came from
  ttlMs: number;           // expected freshness window
}

export interface MetaResponse<T> {
  data: T;
  meta: ResponseMeta;
}

export interface WrapMetaOptions {
  cachedAt?: number | string | Date;
  ttlMs?: number;
  source?: DataSource;
}

/**
 * Wrap any payload with freshness metadata.
 *
 * @param data the payload to wrap (kept at top level for backwards compat)
 * @param opts.cachedAt ms epoch / ISO / Date when payload was first fetched
 * @param opts.ttlMs    soft freshness window. Default 60_000.
 * @param opts.source   tag — defaults to 'live'
 */
export function wrapMeta<T>(data: T, opts: WrapMetaOptions = {}): MetaResponse<T> {
  const ttlMs = opts.ttlMs ?? 60_000;
  const now = Date.now();
  let cachedAtMs: number;
  if (opts.cachedAt == null) cachedAtMs = now;
  else if (opts.cachedAt instanceof Date) cachedAtMs = opts.cachedAt.getTime();
  else if (typeof opts.cachedAt === 'number') cachedAtMs = opts.cachedAt;
  else cachedAtMs = new Date(opts.cachedAt).getTime();
  const ageMs = Math.max(0, now - cachedAtMs);
  return {
    data,
    meta: {
      cachedAt: new Date(cachedAtMs).toISOString(),
      ageMs,
      isStale: ageMs > ttlMs,
      source: opts.source ?? 'live',
      ttlMs,
    },
  };
}
