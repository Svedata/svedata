import type {
  Envelope,
  HavAbnormalSituation,
  HavAdvice,
  HavBathingWater,
  HavBathingWaterList,
  HavForecastList,
  HavMeasurement,
  HavResults,
} from '@svedata/types';
import { empty, makeMeta, ok } from '../../lib/envelope.js';
import { svedataFetch } from '../../lib/http.js';

const SOURCE = 'hav';
const BASE_URL = 'https://gw.havochvatten.se/external-public/bathing-waters/v2';

type ErrorKind = 'not_found' | 'rate_limited' | 'upstream_error';

type RawAdvice = { startsAt?: string; description?: string; typeIdText?: string };
type RawAbnormal = { startsAt?: string; endsAt?: string | null; description?: string };
type RawWaterAndAdvisories = {
  bathingWater?: {
    id?: string;
    name?: string;
    description?: string;
    euType?: boolean;
    waterTypeIdText?: string;
    municipality?: { id?: number | string; name?: string };
    samplingPointPosition?: { latitude?: string | number; longitude?: string | number };
  };
  adviceAgainstBathing?: RawAdvice[];
  abnormalSituations?: RawAbnormal[];
};

type RawResult = {
  takenAt?: string;
  sampleAssessIdText?: string;
  escherichiaColiCount?: number;
  escherichiaColiPrefix?: string;
  escherichiaColiAssessIdText?: string;
  intestinalEnterococciCount?: number;
  intestinalEnterococciPrefix?: string;
  intestinalEnterococciAssessIdText?: string;
  algalIdText?: string;
  waterTemp?: string | number;
  weatherIdText?: string;
};

type RawForecast = {
  bathingWaterId?: string;
  waterForecasts?: { measHour?: string | number; waterTemp?: string | number }[];
};

function num(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = typeof value === 'number' ? value : Number.parseFloat(String(value));
  return Number.isFinite(n) ? n : null;
}

function municipalityCode(value: unknown): string | null {
  const n = num(value);
  return n === null ? null : String(Math.trunc(n)).padStart(4, '0');
}

function mapAdvice(a: RawAdvice): HavAdvice {
  return {
    starts_at: a.startsAt ?? '',
    reason: a.typeIdText ?? '',
    description: (a.description ?? '').trim(),
  };
}

function mapAbnormal(a: RawAbnormal): HavAbnormalSituation {
  return {
    starts_at: a.startsAt ?? '',
    ends_at: a.endsAt ?? null,
    description: (a.description ?? '').trim(),
  };
}

// Municipality contact details are dropped on purpose. They are not needed to
// identify the bathing water and can change independently of HaV's data.
function mapWater(w: RawWaterAndAdvisories): HavBathingWater | null {
  const b = w.bathingWater;
  if (!b?.id || !b.name) return null;
  return {
    id: b.id,
    name: b.name,
    description: (b.description ?? '').trim(),
    municipality: b.municipality?.name ?? null,
    municipality_code: municipalityCode(b.municipality?.id),
    water_type: b.waterTypeIdText ?? null,
    eu_bathing_water: b.euType === true,
    latitude: num(b.samplingPointPosition?.latitude),
    longitude: num(b.samplingPointPosition?.longitude),
    advice_against_bathing: (w.adviceAgainstBathing ?? []).map(mapAdvice),
    abnormal_situations: (w.abnormalSituations ?? []).map(mapAbnormal),
  };
}

function measurement(count: unknown, prefix: unknown, assessment: unknown): HavMeasurement {
  return {
    count: num(count),
    prefix: typeof prefix === 'string' && prefix ? prefix : null,
    assessment: typeof assessment === 'string' && assessment ? assessment : null,
  };
}

async function fetchJson<T>(path: string): Promise<{ kind: 'ok'; body: T } | { kind: ErrorKind }> {
  let res: Response;
  try {
    res = await svedataFetch(`${BASE_URL}${path}`);
  } catch {
    return { kind: 'upstream_error' };
  }
  if (res.status === 404) return { kind: 'not_found' };
  if (res.status === 429) return { kind: 'rate_limited' };
  if (!res.ok) return { kind: 'upstream_error' };
  try {
    return { kind: 'ok', body: (await res.json()) as T };
  } catch {
    return { kind: 'upstream_error' };
  }
}

function emptyFor<T>(kind: ErrorKind): Envelope<T> {
  return empty(makeMeta(SOURCE, kind === 'rate_limited' ? 0 : null, false, kind));
}

export type HavBathingWatersOptions = {
  /** Kommunkod, e.g. '1264' or 1264. The API ignores this filter, so the SDK applies it. */
  municipality?: string | number;
  /** true = only waters with active advice against bathing; false = only without. */
  adviceAgainstBathing?: boolean;
  limit?: number;
};

export type HavForecastOptions = {
  bathingWaterId?: string;
  /** Kommunkod, e.g. '1280'. */
  municipality?: string | number;
};

export const hav = {
  /** List Swedish bathing waters with any active advisories. */
  async bathingWaters(
    options: HavBathingWatersOptions = {},
  ): Promise<Envelope<HavBathingWaterList>> {
    const params = new URLSearchParams();
    if (options.adviceAgainstBathing !== undefined) {
      params.set('filter', `(hasAdviceAgainstBathing eq '${options.adviceAgainstBathing}')`);
    }
    const qs = params.toString();
    const result = await fetchJson<{ watersAndAdvisories?: RawWaterAndAdvisories[] }>(
      `/bathing-waters${qs ? `?${qs}` : ''}`,
    );
    if (result.kind !== 'ok') return emptyFor(result.kind);
    if (!Array.isArray(result.body?.watersAndAdvisories)) return emptyFor('upstream_error');

    const code = options.municipality === undefined ? null : municipalityCode(options.municipality);
    const all = result.body.watersAndAdvisories
      .map(mapWater)
      .filter((w): w is HavBathingWater => w !== null)
      .filter((w) => code === null || w.municipality_code === code);
    const limited = options.limit ? all.slice(0, options.limit) : all;
    return ok({ total: all.length, bathing_waters: limited }, makeMeta(SOURCE));
  },

  /** One bathing water by EU id, e.g. 'SE0441264000000306'. */
  async lookup(id: string): Promise<Envelope<HavBathingWater>> {
    const result = await fetchJson<RawWaterAndAdvisories>(
      `/bathing-waters/${encodeURIComponent(id)}`,
    );
    if (result.kind !== 'ok') return emptyFor(result.kind);
    const water = mapWater(result.body);
    return water ? ok(water, makeMeta(SOURCE)) : emptyFor('upstream_error');
  },

  /** Water sample results, newest first. */
  async results(id: string): Promise<Envelope<HavResults>> {
    const result = await fetchJson<{ results?: RawResult[] }>(
      `/bathing-waters/${encodeURIComponent(id)}/results`,
    );
    if (result.kind !== 'ok') return emptyFor(result.kind);
    if (!Array.isArray(result.body?.results)) return emptyFor('upstream_error');
    const results = result.body.results
      .filter((r) => typeof r.takenAt === 'string')
      .map((r) => ({
        taken_at: r.takenAt!,
        assessment: r.sampleAssessIdText ?? null,
        e_coli: measurement(
          r.escherichiaColiCount,
          r.escherichiaColiPrefix,
          r.escherichiaColiAssessIdText,
        ),
        intestinal_enterococci: measurement(
          r.intestinalEnterococciCount,
          r.intestinalEnterococciPrefix,
          r.intestinalEnterococciAssessIdText,
        ),
        algae: r.algalIdText ?? null,
        water_temp: num(r.waterTemp),
        weather: r.weatherIdText ?? null,
      }))
      .sort((a, b) => b.taken_at.localeCompare(a.taken_at));
    return ok({ id, results }, makeMeta(SOURCE));
  },

  /** Copernicus water temperature forecasts for the coming hours. */
  async forecasts(options: HavForecastOptions = {}): Promise<Envelope<HavForecastList>> {
    const params = new URLSearchParams();
    if (options.bathingWaterId) params.set('bathingWaterId', options.bathingWaterId);
    const code = options.municipality === undefined ? null : municipalityCode(options.municipality);
    if (code) params.set('municId', String(Number(code)));
    const qs = params.toString();
    const result = await fetchJson<{ forecasts?: RawForecast[] }>(
      `/forecasts${qs ? `?${qs}` : ''}`,
    );
    if (result.kind !== 'ok') return emptyFor(result.kind);
    if (!Array.isArray(result.body?.forecasts)) return emptyFor('upstream_error');
    const forecasts = result.body.forecasts.flatMap((f) => {
      if (!f.bathingWaterId) return [];
      const points = (f.waterForecasts ?? []).flatMap((p) => {
        const hour = num(p.measHour);
        const temp = num(p.waterTemp);
        return hour === null || temp === null ? [] : [{ hour, water_temp: temp }];
      });
      return [{ bathing_water_id: f.bathingWaterId, points }];
    });
    return ok({ forecasts }, makeMeta(SOURCE));
  },
};

export { BASE_URL };
