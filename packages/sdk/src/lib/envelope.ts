import type { Envelope, Meta } from '@svedata/types';

export function makeMeta(
  source: string,
  rateLimitRemaining: number | null = null,
  cached = false,
): Meta {
  return {
    source,
    fetched_at: new Date().toISOString(),
    cached,
    rate_limit_remaining: rateLimitRemaining,
  };
}

export function ok<T>(data: T, meta: Meta): Envelope<T> {
  return { data, meta };
}

export function empty<T>(meta: Meta): Envelope<T> {
  return { data: null, meta };
}
