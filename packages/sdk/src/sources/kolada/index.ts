import type {
  Envelope,
  KoladaData,
  KoladaDataPoint,
  KoladaGender,
  KoladaKpi,
  KoladaKpiSearchResult,
  KoladaMunicipality,
  KoladaMunicipalityList,
} from '@svedata/types';
import { empty, makeMeta, ok } from '../../lib/envelope.js';
import { svedataFetch } from '../../lib/http.js';

const SOURCE = 'kolada';
const BASE_URL = 'https://api.kolada.se/v3';
// Kolada paginates with `next_url`. Data calls are normally a single page,
// but a broad history query can span several. Cap the walk so a runaway
// response can never turn one SDK call into hundreds of requests.
const MAX_PAGES = 10;

type RawPage<T> = {
  values: T[];
  next_url: string | null;
  count: number;
};

type RawKpi = {
  id: string;
  title: string;
  description: string | null;
  operating_area: string | null;
  is_divided_by_gender: boolean;
  municipality_type: string;
  publication_date: string | null;
};

type RawMunicipality = { id: string; title: string; type: string };

type RawDataRow = {
  kpi: string;
  period: number;
  municipality: string;
  values: { gender: string; status: string | null; value: number | null }[];
};

type ErrorKind = 'not_found' | 'rate_limited' | 'upstream_error';

type FetchResult<T> = { kind: 'ok'; values: T[] } | { kind: ErrorKind };

async function fetchAll<T>(path: string): Promise<FetchResult<T>> {
  const values: T[] = [];
  let url: string | null = `${BASE_URL}${path}`;
  for (let page = 0; url && page < MAX_PAGES; page++) {
    let res: Response;
    try {
      res = await svedataFetch(url);
    } catch {
      return { kind: 'upstream_error' };
    }
    if (res.status === 404) return { kind: 'not_found' };
    if (res.status === 429) return { kind: 'rate_limited' };
    if (!res.ok) return { kind: 'upstream_error' };

    let body: RawPage<T>;
    try {
      body = (await res.json()) as RawPage<T>;
    } catch {
      return { kind: 'upstream_error' };
    }
    if (!body || !Array.isArray(body.values)) return { kind: 'upstream_error' };
    values.push(...body.values);
    // Only follow pagination links that stay on Kolada's own API.
    url =
      typeof body.next_url === 'string' && body.next_url.startsWith(BASE_URL)
        ? body.next_url
        : null;
  }
  return { kind: 'ok', values };
}

function emptyFor<T>(kind: ErrorKind): Envelope<T> {
  if (kind === 'rate_limited') return empty(makeMeta(SOURCE, 0, false, 'rate_limited'));
  return empty(makeMeta(SOURCE, null, false, kind));
}

function joinIds(value: string | number | (string | number)[]): string {
  const list = Array.isArray(value) ? value : [value];
  return list.map((v) => encodeURIComponent(String(v).trim())).join(',');
}

function mapKpi(k: RawKpi): KoladaKpi {
  return {
    id: k.id,
    title: k.title,
    description: k.description ?? '',
    operating_area: k.operating_area ?? '',
    is_divided_by_gender: Boolean(k.is_divided_by_gender),
    municipality_type: k.municipality_type,
    publication_date: k.publication_date ?? null,
  };
}

const GENDER: Record<string, KoladaGender> = { T: 'total', M: 'male', K: 'female' };

export type KoladaKpisOptions = {
  limit?: number;
};

export type KoladaDataOptions = {
  /** One year or several. Omit for the full history. */
  years?: number | number[];
};

export const kolada = {
  /** Search key figures (nyckeltal) by title, e.g. `kpis('invånare')`. */
  async kpis(
    query: string,
    options: KoladaKpisOptions = {},
  ): Promise<Envelope<KoladaKpiSearchResult>> {
    const params = new URLSearchParams({ title: query });
    const result = await fetchAll<RawKpi>(`/kpi?${params}`);
    if (result.kind !== 'ok') return emptyFor<KoladaKpiSearchResult>(result.kind);

    const total = result.values.length;
    const limited = options.limit ? result.values.slice(0, options.limit) : result.values;
    return ok({ query, total, kpis: limited.map(mapKpi) }, makeMeta(SOURCE));
  },

  /** List municipalities (kommuner) and regions, optionally filtered by name. */
  async municipalities(query?: string): Promise<Envelope<KoladaMunicipalityList>> {
    const qs = query ? `?${new URLSearchParams({ title: query })}` : '';
    const result = await fetchAll<RawMunicipality>(`/municipality${qs}`);
    if (result.kind !== 'ok') return emptyFor<KoladaMunicipalityList>(result.kind);

    const municipalities: KoladaMunicipality[] = result.values.map((m) => ({
      id: m.id,
      title: m.title,
      type: m.type === 'L' ? 'region' : 'municipality',
    }));
    return ok({ total: municipalities.length, municipalities }, makeMeta(SOURCE));
  },

  /**
   * Values for one key figure in one or more municipalities. Returns
   * `{ data: null, meta: { error: 'not_found' } }` when Kolada has no
   * values for that combination (unknown KPI, unknown municipality, or a
   * year that is not published yet).
   */
  async data(
    kpiId: string,
    municipality: string | string[],
    options: KoladaDataOptions = {},
  ): Promise<Envelope<KoladaData>> {
    let path = `/data/kpi/${joinIds(kpiId)}/municipality/${joinIds(municipality)}`;
    if (options.years !== undefined) path += `/year/${joinIds(options.years)}`;

    const result = await fetchAll<RawDataRow>(path);
    if (result.kind !== 'ok') return emptyFor<KoladaData>(result.kind);

    const points: KoladaDataPoint[] = [];
    for (const row of result.values) {
      if (!row || !Array.isArray(row.values)) continue;
      for (const v of row.values) {
        points.push({
          municipality: row.municipality,
          period: row.period,
          gender: GENDER[v.gender] ?? 'total',
          value: typeof v.value === 'number' && Number.isFinite(v.value) ? v.value : null,
          status: v.status ?? '',
        });
      }
    }
    if (points.length === 0) return emptyFor<KoladaData>('not_found');

    points.sort(
      (a, b) =>
        a.period - b.period ||
        a.municipality.localeCompare(b.municipality) ||
        a.gender.localeCompare(b.gender),
    );
    return ok({ kpi: kpiId, points }, makeMeta(SOURCE));
  },
};

export { BASE_URL };
