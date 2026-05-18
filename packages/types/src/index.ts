export type Envelope<T> = {
  data: T | null;
  meta: Meta;
};

export type Meta = {
  source: string;
  fetched_at: string;
  cached: boolean;
  rate_limit_remaining: number | null;
  error?: MetaError;
};

export type MetaError = 'rate_limited' | 'not_found' | 'upstream_error';

export type Money = {
  amount: number;
  currency: 'SEK';
};

export type Lang = 'en' | 'sv';

export * from './smhi.js';
export * from './riksbanken.js';
export * from './scb.js';
export * from './riksdagen.js';
export * from './nordpool.js';
export * from './trafikverket.js';
export * from './polisen.js';
