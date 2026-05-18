import type { Envelope, SmhiCurrentWeather } from '@svedata/types';
import { empty, makeMeta, ok } from '../../lib/envelope.js';
import { svedataFetch } from '../../lib/http.js';
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

/**
 * Coordinate input as an alternative to a city name. WGS84.
 */
export type SmhiCoords = { latitude: number; longitude: number };

/**
 * Either a known Swedish city name (case-insensitive, see {@link CITIES})
 * or an explicit WGS84 coordinate pair.
 */
export type SmhiLocationInput = string | SmhiCoords;

function resolveLocation(input: SmhiLocationInput): { name: string; latitude: number; longitude: number } | null {
  if (typeof input === 'string') {
    const city = findCity(input);
    return city ? { name: city.name, latitude: city.latitude, longitude: city.longitude } : null;
  }
  if (
    typeof input.latitude === 'number' &&
    typeof input.longitude === 'number' &&
    Number.isFinite(input.latitude) &&
    Number.isFinite(input.longitude)
  ) {
    return {
      name: `${input.latitude.toFixed(4)},${input.longitude.toFixed(4)}`,
      latitude: input.latitude,
      longitude: input.longitude,
    };
  }
  return null;
}

async function fetchCurrent(input: SmhiLocationInput): Promise<Envelope<SmhiCurrentWeather>> {
  const loc = resolveLocation(input);
  if (!loc) {
    return empty(makeMeta(SOURCE, null, false, 'not_found'));
  }

  const url = buildSmhiForecastUrl(loc.latitude, loc.longitude);
  let res: Response;
  try {
    res = await svedataFetch(url);
  } catch {
    return empty(makeMeta(SOURCE, null, false, 'upstream_error'));
  }

  if (res.status === 404) return empty(makeMeta(SOURCE, null, false, 'not_found'));
  if (res.status === 429) return empty(makeMeta(SOURCE, 0, false, 'rate_limited'));
  if (!res.ok) return empty(makeMeta(SOURCE, null, false, 'upstream_error'));

  let body: SmhiSnow1gResponse;
  try {
    body = (await res.json()) as SmhiSnow1gResponse;
  } catch {
    return empty(makeMeta(SOURCE, null, false, 'upstream_error'));
  }

  const first = body?.timeSeries?.[0];
  if (!first || !first.data) {
    return empty(makeMeta(SOURCE, null, false, 'upstream_error'));
  }

  const d = first.data;
  const data: SmhiCurrentWeather = {
    location: loc.name,
    latitude: loc.latitude,
    longitude: loc.longitude,
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
}

export const smhi = {
  /**
   * Returns the current/next forecast point for a Swedish city or coordinate.
   *
   * **This is a short-range forecast, not an observation.** Backed by SMHI's
   * metfcst SNOW1gv1 endpoint, which publishes a forecast time series in
   * 15-minute steps. `timeSeries[0]` is the next forecast point (typically
   * within the next hour) — close enough to "current weather" for most UIs,
   * but if you need an actual measurement use SMHI's metobs API directly
   * (a typed wrapper is planned for a future release).
   *
   * `input` accepts a known Swedish city name (case-insensitive, see
   * {@link CITIES}) or an explicit `{ latitude, longitude }` pair in WGS84.
   *
   * Failure modes:
   * - Unknown city / invalid coords → `{ data: null, meta: { error: 'not_found' } }`
   * - 404 from SMHI → `{ data: null, meta: { error: 'not_found' } }`
   * - 429 → `{ data: null, meta: { rate_limit_remaining: 0, error: 'rate_limited' } }`
   * - 5xx / malformed body → `{ data: null, meta: { error: 'upstream_error' } }`
   */
  current: fetchCurrent,

  /**
   * Alias for {@link current}. The underlying SMHI endpoint is a forecast
   * API; use `forecast()` when you want the name to match the data.
   */
  forecast: fetchCurrent,
};
