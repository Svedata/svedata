import type {
  Envelope,
  NordpoolArea,
  NordpoolDailyPrices,
  NordpoolPricePoint,
} from '@svedata/types';
import { empty, makeMeta, ok } from '../../lib/envelope.js';
import { svedataFetch } from '../../lib/http.js';

/**
 * The "nordpool" namespace fetches Swedish day-ahead spot prices via
 * `elprisetjustnu.se`, a free community proxy that republishes ENTSO-E /
 * Nord Pool data. The official Nord Pool API is commercial (€4 100/year);
 * elprisetjustnu serves the same numbers under a permissive open-data
 * license. The `meta.source` field is set to `'elprisetjustnu'` to make
 * the actual data origin visible in the envelope.
 */
const SOURCE = 'elprisetjustnu';
const BASE_URL = 'https://www.elprisetjustnu.se';

type RawPrice = {
  SEK_per_kWh: number;
  EUR_per_kWh: number;
  EXR: number;
  time_start: string;
  time_end: string;
};

function todayInStockholm(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Stockholm',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
  return parts;
}

export function buildPricesUrl(area: NordpoolArea, date: string): string {
  const [year, month, day] = date.split('-');
  return `${BASE_URL}/api/v1/prices/${year}/${month}-${day}_${area}.json`;
}

function mapPoint(p: RawPrice): NordpoolPricePoint {
  return {
    start: p.time_start,
    end: p.time_end,
    sek_per_kwh: p.SEK_per_kWh,
    eur_per_kwh: p.EUR_per_kWh,
    exr: p.EXR,
  };
}

export type NordpoolPricesOptions = {
  /** YYYY-MM-DD. Defaults to today in Europe/Stockholm. */
  date?: `${number}-${number}-${number}` | string;
};

export const nordpool = {
  /**
   * Returns Swedish day-ahead spot prices for the given area on the given
   * date. Since 1 October 2025 the feed publishes 96 quarter-hourly points
   * per day; older dates may return 24 hourly points.
   *
   * Tomorrow's prices are typically released around 13:00 CET; before
   * that, requesting tomorrow's date returns `{ data: null, meta: { error: 'not_found' } }`.
   */
  async prices(
    area: NordpoolArea,
    options: NordpoolPricesOptions = {},
  ): Promise<Envelope<NordpoolDailyPrices>> {
    const date = options.date ?? todayInStockholm();
    const url = buildPricesUrl(area, date);

    let res: Response;
    try {
      res = await svedataFetch(url);
    } catch {
      return empty(makeMeta(SOURCE, null, false, 'upstream_error'));
    }

    if (res.status === 404) return empty(makeMeta(SOURCE, null, false, 'not_found'));
    if (res.status === 429) return empty(makeMeta(SOURCE, 0, false, 'rate_limited'));
    if (!res.ok) return empty(makeMeta(SOURCE, null, false, 'upstream_error'));

    let body: RawPrice[];
    try {
      body = (await res.json()) as RawPrice[];
    } catch {
      return empty(makeMeta(SOURCE, null, false, 'upstream_error'));
    }
    if (!Array.isArray(body) || body.length === 0) {
      return empty(makeMeta(SOURCE, null, false, 'not_found'));
    }

    return ok(
      { area, date, prices: body.map(mapPoint) },
      makeMeta(SOURCE),
    );
  },
};

export { BASE_URL };
