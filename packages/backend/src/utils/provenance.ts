/**
 * Provenance — every signal/trade we publish is backed by frozen upstream snapshots.
 *
 *   const c = new CitationCollector();
 *   const trending = await c.cite('sosovalue', '/coin/getCoinTrending', { limit: 10 },
 *     () => sosovalue.getCoinTrending(10));
 *   // ... later when persisting a signal:
 *   await supabase.from('signals').insert({ ..., citations: c.toArray() });
 */
import { createHash } from 'crypto';
import { supabase } from '../db/supabase.js';

export interface Citation {
  source:    string;            // 'sosovalue' | 'sodex' | 'binance' | 'coingecko' | ...
  endpoint:  string;            // logical endpoint name
  hash:      string;            // sha256 of the normalized payload
  params?:   unknown;
  timestamp: string;            // ISO when the snapshot was fetched
  /** Optional human-readable extract — the specific number the citation justifies */
  value?:    string | number;
  note?:     string;
}

export class CitationCollector {
  private items: Citation[] = [];

  list(): Citation[] { return this.items.slice(); }
  toArray(): Citation[] { return this.items.slice(); }
  add(c: Citation): void { this.items.push(c); }

  /**
   * Wrap a fetch-style call. Persists the raw payload to `data_snapshots`
   * (deduped by hash) and records the citation in this collector.
   */
  async cite<T>(
    source: string,
    endpoint: string,
    params: unknown,
    fetcher: () => Promise<T>,
    extract?: (r: T) => { value?: string | number; note?: string } | void,
  ): Promise<T> {
    const payload = await fetcher();
    const hash = sha256(JSON.stringify(payload ?? null));
    const ts = new Date().toISOString();

    // Persist snapshot (best-effort — never block on failure)
    try {
      await supabase.from('data_snapshots').upsert({
        hash,
        source,
        endpoint,
        params: (params as object) ?? null,
        payload: payload as object,
        fetched_at: ts,
      }, { onConflict: 'hash' });
    } catch { /* ignore — provenance is best-effort */ }

    const ex = extract ? (extract(payload) || {}) : {};
    this.items.push({
      source,
      endpoint,
      hash,
      params,
      timestamp: ts,
      value: ex.value,
      note: ex.note,
    });
    return payload;
  }
}

export function sha256(s: string): string {
  return createHash('sha256').update(s, 'utf8').digest('hex');
}

/** Convenience factory */
export function newCitations(): CitationCollector {
  return new CitationCollector();
}
