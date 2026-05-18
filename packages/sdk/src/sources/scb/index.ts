import type {
  Envelope,
  ScbDataset,
  ScbLang,
  ScbSearchResult,
  ScbTable,
  ScbTableSummary,
} from '@svedata/types';
import { empty, makeMeta, ok } from '../../lib/envelope.js';

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

async function fetchJson<T>(
  path: string,
): Promise<{ kind: 'ok'; body: T } | { kind: 'empty' } | { kind: 'rate_limited' }> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { Accept: 'application/json' },
  });
  if (res.status === 429) return { kind: 'rate_limited' };
  if (!res.ok) return { kind: 'empty' };
  const body = (await res.json()) as T;
  return { kind: 'ok', body };
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
    if (result.kind === 'rate_limited') return empty(makeMeta(SOURCE, 0));
    if (result.kind === 'empty') return empty(makeMeta(SOURCE));

    return ok(
      {
        query,
        page: result.body.page?.pageNumber ?? page,
        page_size: result.body.page?.pageSize ?? pageSize,
        total: result.body.page?.totalElements ?? result.body.tables.length,
        tables: result.body.tables.map(mapSummary),
      },
      makeMeta(SOURCE),
    );
  },

  async table(tableId: string, options: ScbDataOptions = {}): Promise<Envelope<ScbTable>> {
    const lang = options.lang ?? 'sv';
    const result = await fetchJson<RawTable>(
      `/tables/${encodeURIComponent(tableId)}?lang=${lang}`,
    );
    if (result.kind === 'rate_limited') return empty(makeMeta(SOURCE, 0));
    if (result.kind === 'empty') return empty(makeMeta(SOURCE));

    return ok(
      {
        ...mapSummary(result.body),
        paths: result.body.paths ?? [],
      },
      makeMeta(SOURCE),
    );
  },

  async data(tableId: string, options: ScbDataOptions = {}): Promise<Envelope<ScbDataset>> {
    const lang = options.lang ?? 'sv';
    const result = await fetchJson<RawDataset>(
      `/tables/${encodeURIComponent(tableId)}/data?lang=${lang}&outputFormat=json-stat2`,
    );
    if (result.kind === 'rate_limited') return empty(makeMeta(SOURCE, 0));
    if (result.kind === 'empty') return empty(makeMeta(SOURCE));

    return ok(
      {
        table_id: tableId,
        label: result.body.label,
        source: result.body.source,
        updated: result.body.updated,
        jsonstat: result.body,
      },
      makeMeta(SOURCE),
    );
  },
};

export { BASE_URL };
