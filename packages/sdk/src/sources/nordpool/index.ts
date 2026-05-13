import type {
  Envelope,
  NordpoolArea,
  NordpoolDailyPrices,
  NordpoolPricePoint,
} from '@svedata/types';
import { empty, makeMeta, ok } from '../../lib/envelope.js';

const SOURCE = 'nordpool';
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
  date?: string;
};

export const nordpool = {
  async prices(
    area: NordpoolArea,
    options: NordpoolPricesOptions = {},
  ): Promise<Envelope<NordpoolDailyPrices>> {
    const date = options.date ?? todayInStockholm();
    const url = buildPricesUrl(area, date);
    const res = await fetch(url, { headers: { Accept: 'application/json' } });

    if (res.status === 429) return empty(makeMeta(SOURCE, 0));
    if (!res.ok) return empty(makeMeta(SOURCE));

    const body = (await res.json()) as RawPrice[];
    if (!Array.isArray(body) || body.length === 0) {
      return empty(makeMeta(SOURCE));
    }

    return ok(
      {
        area,
        date,
        prices: body.map(mapPoint),
      },
      makeMeta(SOURCE),
    );
  },
};

export { BASE_URL };
