import type { Envelope, SmhiCurrentWeather } from '@svedata/types';
import { empty, makeMeta, ok } from '../../lib/envelope.js';
import { findCity } from './cities.js';

const SOURCE = 'smhi';
const BASE_URL = 'https://opendata-download-metfcst.smhi.se';
const SENTINEL = 9999;

type SmhiSnow1gData = Partial<{
  air_temperature: number;
  wind_speed: number;
  wind_from_direction: number;
  relative_humidity: number;
  air_pressure_at_mean_sea_level: number;
  symbol_code: number;
  predominant_precipitation_type_at_surface: number;
  precipitation_amount_mean: number;
}> &
  Record<string, number | undefined>;

type SmhiTimeSeriesEntry = {
  time: string;
  data: SmhiSnow1gData;
};

type SmhiSnow1gResponse = {
  createdTime: string;
  referenceTime: string;
  geometry: {
    type: 'Point';
    coordinates: [number, number];
  };
  timeSeries: SmhiTimeSeriesEntry[];
};

function value(data: SmhiSnow1gData, key: keyof SmhiSnow1gData): number | null {
  const v = data[key];
  if (v === undefined || v === SENTINEL) return null;
  return v;
}

export function buildSmhiForecastUrl(lat: number, lon: number): string {
  const lonStr = lon.toFixed(4);
  const latStr = lat.toFixed(4);
  return `${BASE_URL}/api/category/snow1g/version/1/geotype/point/lon/${lonStr}/lat/${latStr}/data.json`;
}

export const smhi = {
  async current(city: string): Promise<Envelope<SmhiCurrentWeather>> {
    const coords = findCity(city);
    if (!coords) {
      return empty(makeMeta(SOURCE));
    }

    const url = buildSmhiForecastUrl(coords.latitude, coords.longitude);
    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
    });

    if (res.status === 404) {
      return empty(makeMeta(SOURCE));
    }

    if (res.status === 429) {
      return empty(makeMeta(SOURCE, 0));
    }

    if (!res.ok) {
      return empty(makeMeta(SOURCE));
    }

    const body = (await res.json()) as SmhiSnow1gResponse;
    const first = body.timeSeries[0];
    if (!first) {
      return empty(makeMeta(SOURCE));
    }

    const d = first.data;
    const data: SmhiCurrentWeather = {
      location: coords.name,
      latitude: coords.latitude,
      longitude: coords.longitude,
      observed_at: first.time,
      air_temperature: value(d, 'air_temperature'),
      wind_speed: value(d, 'wind_speed'),
      wind_from_direction: value(d, 'wind_from_direction'),
      relative_humidity: value(d, 'relative_humidity'),
      air_pressure_at_mean_sea_level: value(d, 'air_pressure_at_mean_sea_level'),
      symbol_code: value(d, 'symbol_code'),
      predominant_precipitation_type_at_surface: value(
        d,
        'predominant_precipitation_type_at_surface',
      ),
      precipitation_amount_mean: value(d, 'precipitation_amount_mean'),
    };

    return ok(data, makeMeta(SOURCE));
  },
};
