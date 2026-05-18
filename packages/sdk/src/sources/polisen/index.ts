import type { Envelope, PolisenEvent, PolisenEventsResult } from '@svedata/types';
import { empty, makeMeta, ok } from '../../lib/envelope.js';
import { svedataFetch } from '../../lib/http.js';

const SOURCE = 'polisen';
const BASE_URL = 'https://polisen.se';

type RawEvent = {
  id: number;
  datetime: string;
  name: string;
  summary: string;
  url: string;
  type: string;
  location: { name: string; gps: string };
};

function parseGps(gps: string): { lat: number | null; lon: number | null } {
  const parts = gps.split(',');
  if (parts.length !== 2) return { lat: null, lon: null };
  const lat = Number.parseFloat(parts[0]!);
  const lon = Number.parseFloat(parts[1]!);
  return {
    lat: Number.isFinite(lat) ? lat : null,
    lon: Number.isFinite(lon) ? lon : null,
  };
}

function toIsoDatetime(dt: string): string {
  return dt.replace(' ', 'T').replace(/\s/g, '');
}

function absUrl(url: string): string {
  if (url.startsWith('http')) return url;
  return `${BASE_URL}${url.startsWith('/') ? '' : '/'}${url}`;
}

function mapEvent(e: RawEvent): PolisenEvent {
  const { lat, lon } = parseGps(e.location.gps);
  return {
    id: e.id,
    datetime: toIsoDatetime(e.datetime),
    name: e.name,
    summary: e.summary,
    type: e.type,
    url: absUrl(e.url),
    location_name: e.location.name,
    latitude: lat,
    longitude: lon,
  };
}

export type PolisenEventsOptions = {
  location?: string | string[];
  type?: string | string[];
  limit?: number;
};

function joinList(value: string | string[] | undefined): string | undefined {
  if (value === undefined) return undefined;
  return Array.isArray(value) ? value.join(';') : value;
}

export const polisen = {
  async events(options: PolisenEventsOptions = {}): Promise<Envelope<PolisenEventsResult>> {
    const params = new URLSearchParams();
    const loc = joinList(options.location);
    const typ = joinList(options.type);
    if (loc) params.set('locationname', loc);
    if (typ) params.set('type', typ);

    const qs = params.toString();
    const url = `${BASE_URL}/api/events${qs ? `?${qs}` : ''}`;

    let res: Response;
    try {
      res = await svedataFetch(url);
    } catch {
      return empty(makeMeta(SOURCE, null, false, 'upstream_error'));
    }

    if (res.status === 404) return empty(makeMeta(SOURCE, null, false, 'not_found'));
    if (res.status === 429) return empty(makeMeta(SOURCE, 0, false, 'rate_limited'));
    if (!res.ok) return empty(makeMeta(SOURCE, null, false, 'upstream_error'));

    let body: RawEvent[];
    try {
      body = (await res.json()) as RawEvent[];
    } catch {
      return empty(makeMeta(SOURCE, null, false, 'upstream_error'));
    }
    if (!Array.isArray(body)) return empty(makeMeta(SOURCE, null, false, 'upstream_error'));

    const total = body.length;
    const limited = options.limit ? body.slice(0, options.limit) : body;
    return ok({ total, events: limited.map(mapEvent) }, makeMeta(SOURCE));
  },
};

export { BASE_URL };
