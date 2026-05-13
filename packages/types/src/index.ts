export type Envelope<T> = {
  data: T | null;
  meta: Meta;
};

export type Meta = {
  source: string;
  fetched_at: string;
  cached: boolean;
  rate_limit_remaining: number | null;
};

export type Money = {
  amount: number;
  currency: 'SEK';
};

export type Lang = 'en' | 'sv';

export * from './smhi.js';
export * from './riksbanken.js';
