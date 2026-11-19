import type { Envelope, SvkDatasetList, SvkDayAheadPrices, SvkFlows } from '@svedata/types';
import { empty, makeMeta, ok } from '../../lib/envelope.js';
import { svedataFetch } from '../../lib/http.js';

const SOURCE = 'svk';
const BASE_URL = 'https://data.svk.se/sv/api/3/action';
// Resource ids published by package_show. These are the datastore resources,
// not the package names. See https://data.svk.se/sv/blog/api_guide.
const PRICES_RESOURCE = 'cf392ef3-7345-4e98-970e-83088c185570';
const FLOWS_RESOURCE = '4aa94b88-9f42-4f0a-a6a8-8e47aadc782a';

type ErrorKind = 'not_found' | 'rate_limited' | 'upstream_error';
type FetchResult<T> = { kind: 'ok'; result: T } | { kind: ErrorKind };

type CkanResponse<T> = {
  success: boolean;
  result?: T;
  error?: { __type?: string };
};

type RawRecord = {
  start_time_utc: string;
  start_time_sweden: string;
  bidding_zone?: string;
  from_bidding_zone?: string;
  to_bidding_zone?: string;
  price?: number;
  price_unit?: string;
  power?: number;
  power_unit?: string;
};

type RawData = { records: RawRecord[]; total: number };

async function fetchAction<T>(action: string, params?: URLSearchParams): Promise<FetchResult<T>> {
  let res: Response;
  try {
    res = await svedataFetch(`${BASE_URL}/${action}${params ? `?${params}` : ''}`);
  } catch {
    return { kind: 'upstream_error' };
  }
  if (res.status === 404) return { kind: 'not_found' };
  if (res.status === 429) return { kind: 'rate_limited' };
  if (!res.ok) return { kind: 'upstream_error' };
  try {
    const body = (await res.json()) as CkanResponse<T>;
    if (!body || body.success !== true || body.result === undefined) {
      return { kind: body?.error?.__type === 'Not Found Error' ? 'not_found' : 'upstream_error' };
    }
    return { kind: 'ok', result: body.result };
  } catch {
    return { kind: 'upstream_error' };
  }
}

function emptyFor<T>(kind: ErrorKind): Envelope<T> {
  return empty(makeMeta(SOURCE, kind === 'rate_limited' ? 0 : null, false, kind));
}

function todayInStockholm(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Stockholm' }).format(new Date());
}

// datastore_search supports exact matches and lists, not date ranges.
// Enumerate quarter-hours in Swedish local time to fetch a whole date.
// At the autumn clock change the repeated local times still select both
// distinct UTC rows; at the spring change non-existent times match none.
function dayTimes(date: string): string[] {
  return Array.from({ length: 96 }, (_, i) => {
    const h = String(Math.floor(i / 4)).padStart(2, '0');
    const m = String((i % 4) * 15).padStart(2, '0');
    return `${date}T${h}:${m}:00`;
  });
}

function utc(value: string): string {
  return /(?:Z|[+-]\d{2}:?\d{2})$/.test(value) ? value : `${value}Z`;
}

function dataParams(
  resourceId: string,
  filters: Record<string, string | string[]>,
): URLSearchParams {
  return new URLSearchParams({
    resource_id: resourceId,
    filters: JSON.stringify(filters),
    sort: 'start_time_utc asc',
    // A full date for one zone/route stays well below this. Do not silently
    // truncate if the upstream schema changes and returns more rows.
    limit: '32000',
  });
}

export type SvkPricesOptions = {
  /** YYYY-MM-DD in Europe/Stockholm. Defaults to today. Some datasets lag. */
  date?: string;
};

export type SvkFlowsOptions = {
  date?: string;
  /** Source bidding zone, e.g. 'SE3'. */
  from?: string;
  /** Destination bidding zone, e.g. 'SE4'. */
  to?: string;
};

export const svk = {
  /** Discover dataset names published by Svenska kraftnät's Data Service. */
  async datasets(): Promise<Envelope<SvkDatasetList>> {
    const result = await fetchAction<string[]>('package_list');
    if (result.kind !== 'ok') return emptyFor(result.kind);
    if (!Array.isArray(result.result) || result.result.some((x) => typeof x !== 'string')) {
      return emptyFor('upstream_error');
    }
    return ok({ datasets: result.result }, makeMeta(SOURCE));
  },

  /**
   * Day-ahead area prices in EUR/MWh. This is an official historical dataset,
   * not a live replacement for nordpool.prices(): at integration time it
   * only contained values up to 1 July 2026.
   */
  async prices(area: string, options: SvkPricesOptions = {}): Promise<Envelope<SvkDayAheadPrices>> {
    const date = options.date ?? todayInStockholm();
    const params = dataParams(PRICES_RESOURCE, {
      bidding_zone: area,
      start_time_sweden: dayTimes(date),
    });
    const result = await fetchAction<RawData>('datastore_search', params);
    if (result.kind !== 'ok') return emptyFor(result.kind);
    if (!result.result || !Array.isArray(result.result.records)) return emptyFor('upstream_error');
    if (result.result.total > result.result.records.length) return emptyFor('upstream_error');
    const records = result.result.records;
    if (records.length === 0) return emptyFor('not_found');
    if (
      records.some(
        (r) => !r || !r.start_time_utc || typeof r.price !== 'number' || r.price_unit !== 'EUR-MWh',
      )
    ) {
      return emptyFor('upstream_error');
    }
    return ok(
      {
        area,
        date,
        points: records.map((r) => ({
          start: utc(r.start_time_utc),
          start_local: r.start_time_sweden,
          eur_per_mwh: r.price!,
        })),
      },
      makeMeta(SOURCE),
    );
  },

  /** Net cross-border physical power flows, in MW. Not for operational use. */
  async flows(options: SvkFlowsOptions = {}): Promise<Envelope<SvkFlows>> {
    const date = options.date ?? todayInStockholm();
    const filters: Record<string, string | string[]> = { start_time_sweden: dayTimes(date) };
    if (options.from) filters.from_bidding_zone = options.from;
    if (options.to) filters.to_bidding_zone = options.to;
    const result = await fetchAction<RawData>(
      'datastore_search',
      dataParams(FLOWS_RESOURCE, filters),
    );
    if (result.kind !== 'ok') return emptyFor(result.kind);
    if (!result.result || !Array.isArray(result.result.records)) return emptyFor('upstream_error');
    if (result.result.total > result.result.records.length) return emptyFor('upstream_error');
    const records = result.result.records;
    if (records.length === 0) return emptyFor('not_found');
    if (
      records.some(
        (r) =>
          !r ||
          !r.start_time_utc ||
          !r.from_bidding_zone ||
          !r.to_bidding_zone ||
          typeof r.power !== 'number' ||
          r.power_unit !== 'MW',
      )
    ) {
      return emptyFor('upstream_error');
    }
    return ok(
      {
        date,
        flows: records.map((r) => ({
          start: utc(r.start_time_utc),
          start_local: r.start_time_sweden,
          from: r.from_bidding_zone!,
          to: r.to_bidding_zone!,
          power_mw: r.power!,
        })),
      },
      makeMeta(SOURCE),
    );
  },
};

export { BASE_URL };
