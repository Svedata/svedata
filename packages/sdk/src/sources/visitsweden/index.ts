import type {
  Envelope,
  VisitSwedenItem,
  VisitSwedenSearchResult,
  VisitSwedenType,
} from '@svedata/types';
import { empty, makeMeta, ok } from '../../lib/envelope.js';
import { svedataFetch } from '../../lib/http.js';

const SOURCE = 'visitsweden';
const BASE_URL = 'https://data.visitsweden.com/store';
const MAX_LIMIT = 100;
const REGION_PREFIX = 'http://data.visitsweden.com/region/';

const TYPES: Record<VisitSwedenType, string> = {
  lodging: 'LodgingBusiness',
  food: 'FoodEstablishment',
  event: 'Event',
  place: 'Place',
  store: 'Store',
  trip: 'Trip',
};

type ErrorKind = 'not_found' | 'rate_limited' | 'upstream_error';
type JsonLdValue =
  | string
  | number
  | { '@value'?: string | number; '@language'?: string; '@id'?: string };
type JsonLdNode = Record<string, unknown> & { '@id'?: string; '@type'?: string | string[] };
type RawEntry = {
  contextId?: string;
  entryId?: string;
  metadata?: { '@graph'?: JsonLdNode[] } & JsonLdNode;
};
type RawSearch = { results?: number; offset?: number; resource?: { children?: RawEntry[] } };

function escapeSolr(value: string): string {
  return value.replace(/[+\-!(){}[\]^"~*?:\\/&|]/g, '\\$&');
}

function values(value: unknown): JsonLdValue[] {
  if (value === undefined || value === null) return [];
  return (Array.isArray(value) ? value : [value]) as JsonLdValue[];
}

function literal(value: unknown, lang: string): string | null {
  const list = values(value);
  const chosen =
    list.find((v) => typeof v === 'object' && v['@language'] === lang) ??
    list.find((v) => typeof v === 'object' && v['@language'] === 'sv') ??
    list[0];
  if (chosen === undefined) return null;
  if (typeof chosen !== 'object') return String(chosen);
  return chosen['@value'] === undefined ? null : String(chosen['@value']);
}

function id(value: unknown): string | null {
  const first = values(value)[0];
  return first && typeof first === 'object' && typeof first['@id'] === 'string'
    ? first['@id']
    : null;
}

function number(value: unknown): number | null {
  const raw = literal(value, 'sv');
  const n = raw === null ? Number.NaN : Number.parseFloat(raw);
  return Number.isFinite(n) ? n : null;
}

function typeName(node: JsonLdNode): string | null {
  for (const t of values(node['@type'])) {
    if (typeof t === 'string' && t.startsWith('schema:')) return t.slice('schema:'.length);
  }
  return null;
}

function mapEntry(entry: RawEntry, lang: string): VisitSwedenItem | null {
  if (!entry.contextId || !entry.entryId || !entry.metadata) return null;
  const graph = Array.isArray(entry.metadata['@graph'])
    ? entry.metadata['@graph']
    : [entry.metadata];
  const byId = new Map(
    graph.filter((n) => typeof n['@id'] === 'string').map((n) => [n['@id']!, n]),
  );
  const main = graph.find((n) => {
    const t = typeName(n);
    return t !== null && Object.values(TYPES).includes(t);
  });
  if (!main) return null;
  const geo = byId.get(id(main['schema:geo']) ?? '');
  const address = byId.get(id(main['schema:address']) ?? '');
  const region = id(main['dcterms:spatial']);
  return {
    id: `${entry.contextId}/${entry.entryId}`,
    type: typeName(main)!,
    name: literal(main['schema:name'], lang) ?? '',
    description: literal(main['schema:description'], lang) ?? '',
    url: id(main['schema:url']),
    region: region?.startsWith(REGION_PREFIX) ? region.slice(REGION_PREFIX.length) : null,
    latitude: geo ? number(geo['schema:latitude']) : null,
    longitude: geo ? number(geo['schema:longitude']) : null,
    street_address: address ? literal(address['schema:streetAddress'], lang) : null,
    postal_code: address ? literal(address['schema:postalCode'], lang) : null,
    locality: address ? literal(address['schema:addressLocality'], lang) : null,
    start_date: literal(main['schema:startDate'], lang),
    end_date: literal(main['schema:endDate'], lang),
  };
}

async function fetchJson<T>(url: string): Promise<{ kind: 'ok'; body: T } | { kind: ErrorKind }> {
  let res: Response;
  try {
    res = await svedataFetch(url);
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

export type VisitSwedenSearchOptions = {
  type?: VisitSwedenType | VisitSwedenType[];
  /** Free text. Each word must match. */
  query?: string;
  /** Visit Sweden region slug, e.g. 'skane', 'stockholm', 'vastragotaland'. */
  region?: string;
  /** Preferred language for text fields. Falls back to Swedish, then any. */
  lang?: 'sv' | 'en' | 'de' | 'da' | 'no';
  /** 1–100, default 20. */
  limit?: number;
  offset?: number;
};

export const visitsweden = {
  /** Search public tourism data from Visit Sweden's national API. */
  async search(options: VisitSwedenSearchOptions = {}): Promise<Envelope<VisitSwedenSearchResult>> {
    const types = [options.type ?? (Object.keys(TYPES) as VisitSwedenType[])].flat();
    const typeQuery = types
      .map((t) => `rdfType:${escapeSolr(`http://schema.org/${TYPES[t]}`)}`)
      .join(' OR ');
    const clauses = ['public:true', `(${typeQuery})`];
    for (const word of (options.query ?? '').trim().split(/\s+/).filter(Boolean)) {
      clauses.push(`all:${escapeSolr(word.toLowerCase())}`);
    }
    if (options.region) {
      clauses.push(`metadata.object.uri:${escapeSolr(`${REGION_PREFIX}${options.region}`)}`);
    }
    const limit = Math.min(Math.max(Math.trunc(options.limit ?? 20), 1), MAX_LIMIT);
    const offset = Math.max(Math.trunc(options.offset ?? 0), 0);
    const params = new URLSearchParams({
      type: 'solr',
      query: clauses.join(' AND '),
      limit: String(limit),
      offset: String(offset),
      rdfFormat: 'application/ld+json',
    });

    const result = await fetchJson<RawSearch>(`${BASE_URL}/search?${params}`);
    if (result.kind !== 'ok') return emptyFor(result.kind);
    const children = result.body?.resource?.children;
    if (!Array.isArray(children)) return emptyFor('upstream_error');
    const lang = options.lang ?? 'sv';
    const items = children
      .map((c) => mapEntry(c, lang))
      .filter((x): x is VisitSwedenItem => x !== null);
    return ok({ total: result.body.results ?? items.length, offset, items }, makeMeta(SOURCE));
  },

  /** One public entry by id `<contextId>/<entryId>`, e.g. '210/4613'. */
  async lookup(
    entryId: string,
    options: Pick<VisitSwedenSearchOptions, 'lang'> = {},
  ): Promise<Envelope<VisitSwedenItem>> {
    const match = /^(\d+)\/(\d+)$/.exec(entryId);
    if (!match) return emptyFor('not_found');
    const [, contextId, id] = match;
    const result = await fetchJson<RawEntry['metadata']>(
      `${BASE_URL}/${contextId}/metadata/${id}?format=${encodeURIComponent('application/ld+json')}`,
    );
    if (result.kind !== 'ok') return emptyFor(result.kind);
    const item = mapEntry({ contextId, entryId: id, metadata: result.body }, options.lang ?? 'sv');
    return item ? ok(item, makeMeta(SOURCE)) : emptyFor('upstream_error');
  },
};

export { BASE_URL };
