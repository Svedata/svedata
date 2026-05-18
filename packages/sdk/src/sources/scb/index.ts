import type {
  Envelope,
  ScbDataset,
  ScbLang,
  ScbSearchResult,
  ScbTable,
  ScbTableSummary,
} from '@svedata/types';
import { empty, makeMeta, ok } from '../../lib/envelope.js';
import { svedataFetch } from '../../lib/http.js';

const SOURCE = 'scb';
const BASE_URL = 'https://statistikdatabasen.scb.se/api/v2';

type RawTable = {
  id: string;
  label: string;
  description: string;
  updated: string;
  firstPeriod: string;
  lastPeriod: string;
  variableNames: string[];
  source: string;
  subjectCode: string;
  timeUnit: string;
  paths?: { id: string; label: string }[][];
};

type RawTablesResponse = {
  language: string;
  tables: RawTable[];
  page?: { pageNumber: number; pageSize: number; totalElements: number };
};

type RawDataset = {
  label: string;
  source: string;
  updated: string;
};

function mapSummary(t: RawTable): ScbTableSummary {
  return {
    id: t.id,
    label: t.label,
    description: t.description,
    updated: t.updated,
    first_period: t.firstPeriod,
    last_period: t.lastPeriod,
    variable_names: t.variableNames,
    source: t.source,
    subject_code: t.subjectCode,
    time_unit: t.timeUnit,
  };
}

type FetchResult<T> =
  | { kind: 'ok'; body: T }
  | { kind: 'not_found' }
  | { kind: 'rate_limited' }
  | { kind: 'upstream_error' };

async function fetchJson<T>(path: string): Promise<FetchResult<T>> {
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
    const body = (await res.json()) as T;
    return { kind: 'ok', body };
  } catch {
    return { kind: 'upstream_error' };
  }
}

function emptyFor<T>(kind: 'not_found' | 'rate_limited' | 'upstream_error'): Envelope<T> {
  if (kind === 'rate_limited') return empty(makeMeta(SOURCE, 0, false, 'rate_limited'));
  return empty(makeMeta(SOURCE, null, false, kind));
}

export type ScbSearchOptions = {
  page?: number;
  pageSize?: number;
  lang?: ScbLang;
};

export type ScbDataOptions = {
  lang?: ScbLang;
};

export const scb = {
  async search(query: string, options: ScbSearchOptions = {}): Promise<Envelope<ScbSearchResult>> {
    const lang = options.lang ?? 'sv';
    const page = options.page ?? 1;
    const pageSize = options.pageSize ?? 20;
    const params = new URLSearchParams({
      lang,
      query,
      pageNumber: String(page),
      pageSize: String(pageSize),
    });

    const result = await fetchJson<RawTablesResponse>(`/tables?${params}`);
    if (result.kind !== 'ok') return emptyFor<ScbSearchResult>(result.kind);

    const tables = Array.isArray(result.body?.tables) ? result.body.tables : [];
    return ok(
      {
        query,
        page: result.body.page?.pageNumber ?? page,
        page_size: result.body.page?.pageSize ?? pageSize,
        total: result.body.page?.totalElements ?? tables.length,
        tables: tables.map(mapSummary),
      },
      makeMeta(SOURCE),
    );
  },

  async table(tableId: string, options: ScbDataOptions = {}): Promise<Envelope<ScbTable>> {
    const lang = options.lang ?? 'sv';
    const result = await fetchJson<RawTable>(
      `/tables/${encodeURIComponent(tableId)}?lang=${lang}`,
    );
    if (result.kind !== 'ok') return emptyFor<ScbTable>(result.kind);
    if (!result.body?.id) return emptyFor<ScbTable>('upstream_error');

    return ok(
      {
        ...mapSummary(result.body),
        paths: result.body.paths ?? [],
      },
      makeMeta(SOURCE),
    );
  },

  /**
   * Fetches table data as JSON-Stat 2.0 in the `jsonstat` field. The
   * `jsonstat` field is typed `unknown` because we don't (yet) ship typed
   * JSON-Stat 2.0 definitions. Use a JSON-Stat library on the consumer
   * side, or cast to a shape that fits your data.
   */
  async data(tableId: string, options: ScbDataOptions = {}): Promise<Envelope<ScbDataset>> {
    const lang = options.lang ?? 'sv';
    const result = await fetchJson<RawDataset>(
      `/tables/${encodeURIComponent(tableId)}/data?lang=${lang}&outputFormat=json-stat2`,
    );
    if (result.kind !== 'ok') return emptyFor<ScbDataset>(result.kind);
    if (!result.body || typeof result.body !== 'object') {
      return emptyFor<ScbDataset>('upstream_error');
    }

    return ok(
      {
        table_id: tableId,
        label: result.body.label ?? '',
        source: result.body.source ?? '',
        updated: result.body.updated ?? '',
        jsonstat: result.body,
      },
      makeMeta(SOURCE),
    );
  },
};

export { BASE_URL };
