import type { Envelope, Meta, MetaError } from '@svedata/types';

export function makeMeta(
  source: string,
  rateLimitRemaining: number | null = null,
  cached = false,
  error?: MetaError,
): Meta {
  const meta: Meta = {
    source,
    fetched_at: new Date().toISOString(),
    cached,
    rate_limit_remaining: rateLimitRemaining,
  };
  if (error) meta.error = error;
  return meta;
}

export function ok<T>(data: T, meta: Meta): Envelope<T> {
  return { data, meta };
}

export function empty<T>(meta: Meta): Envelope<T> {
  return { data: null, meta };
}
