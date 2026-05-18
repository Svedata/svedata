import type {
  Envelope,
  RiksdagenDocument,
  RiksdagenDocumentList,
  RiksdagenMember,
  RiksdagenMemberList,
} from '@svedata/types';
import { empty, makeMeta, ok } from '../../lib/envelope.js';
import { svedataFetch } from '../../lib/http.js';

const SOURCE = 'riksdagen';
const BASE_URL = 'https://data.riksdagen.se';

type RawDoc = {
  id: string;
  dok_id?: string;
  doktyp?: string;
  titel?: string;
  undertitel?: string;
  datum?: string;
  publicerad?: string;
  rm?: string;
  organ?: string;
  dokument_url_html?: string;
  dokument_url_text?: string;
};

type RawDocList = {
  dokumentlista: {
    '@traffar'?: string;
    '@sida'?: string;
    dokument?: RawDoc | RawDoc[];
  };
};

type RawPerson = {
  intressent_id: string;
  tilltalsnamn?: string;
  efternamn?: string;
  sorteringsnamn?: string;
  parti?: string;
  valkrets?: string;
  status?: string;
  kon?: string;
  fodd_ar?: string;
  bild_url_192?: string;
};

type RawPersonList = {
  personlista: {
    '@hits'?: string;
    person?: RawPerson | RawPerson[];
  };
};

function ensureArray<T>(value: T | T[] | undefined): T[] {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

function absUrl(url: string | undefined): string | null {
  if (!url) return null;
  if (url.startsWith('//')) return `https:${url}`;
  if (url.startsWith('http')) return url;
  return `https://data.riksdagen.se${url.startsWith('/') ? '' : '/'}${url}`;
}

function parseIntOrZero(s: string | undefined): number {
  if (!s) return 0;
  const n = Number.parseInt(s, 10);
  return Number.isFinite(n) ? n : 0;
}

function parseYear(s: string | undefined): number | null {
  if (!s) return null;
  const n = Number.parseInt(s, 10);
  return Number.isFinite(n) ? n : null;
}

function mapDocument(d: RawDoc): RiksdagenDocument {
  return {
    id: d.id,
    doc_id: d.dok_id ?? d.id,
    type: d.doktyp ?? '',
    title: d.titel ?? '',
    subtitle: d.undertitel ?? '',
    date: d.datum ?? '',
    published: d.publicerad ?? '',
    rm: d.rm ?? '',
    organ: d.organ ?? '',
    url_html: absUrl(d.dokument_url_html),
    url_text: absUrl(d.dokument_url_text),
  };
}

function mapMember(p: RawPerson): RiksdagenMember {
  return {
    id: p.intressent_id,
    first_name: p.tilltalsnamn ?? '',
    last_name: p.efternamn ?? '',
    sort_name: p.sorteringsnamn ?? '',
    party: p.parti ?? '',
    constituency: p.valkrets ?? '',
    status: p.status ?? '',
    gender: p.kon ?? '',
    born_year: parseYear(p.fodd_ar),
    image_url: absUrl(p.bild_url_192),
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

export type RiksdagenDocumentsOptions = {
  query?: string;
  type?: string;
  year?: string;
  page?: number;
  pageSize?: number;
};

export type RiksdagenMembersOptions = {
  party?: string;
  constituency?: string;
  pageSize?: number;
};

export const riksdagen = {
  async documents(
    options: RiksdagenDocumentsOptions = {},
  ): Promise<Envelope<RiksdagenDocumentList>> {
    const params = new URLSearchParams({ utformat: 'json' });
    if (options.query) params.set('sok', options.query);
    if (options.type) params.set('doktyp', options.type);
    if (options.year) params.set('rm', options.year);
    if (options.page) params.set('p', String(options.page));
    params.set('sz', String(options.pageSize ?? 20));

    const result = await fetchJson<RawDocList>(`/dokumentlista/?${params}`);
    if (result.kind !== 'ok') return emptyFor<RiksdagenDocumentList>(result.kind);

    const list = result.body?.dokumentlista;
    if (!list) return emptyFor<RiksdagenDocumentList>('upstream_error');
    return ok(
      {
        query: options.query ?? null,
        type: options.type ?? null,
        year: options.year ?? null,
        page: parseIntOrZero(list['@sida']) || (options.page ?? 1),
        page_size: options.pageSize ?? 20,
        total: parseIntOrZero(list['@traffar']),
        documents: ensureArray(list.dokument).map(mapDocument),
      },
      makeMeta(SOURCE),
    );
  },

  async members(options: RiksdagenMembersOptions = {}): Promise<Envelope<RiksdagenMemberList>> {
    const params = new URLSearchParams({ utformat: 'json' });
    if (options.party) params.set('parti', options.party);
    if (options.constituency) params.set('valkrets', options.constituency);
    if (options.pageSize) params.set('sz', String(options.pageSize));

    const result = await fetchJson<RawPersonList>(`/personlista/?${params}`);
    if (result.kind !== 'ok') return emptyFor<RiksdagenMemberList>(result.kind);

    const list = result.body?.personlista;
    if (!list) return emptyFor<RiksdagenMemberList>('upstream_error');

    return ok(
      {
        party: options.party ?? null,
        constituency: options.constituency ?? null,
        total: parseIntOrZero(list['@hits']),
        members: ensureArray(list.person).map(mapMember),
      },
      makeMeta(SOURCE),
    );
  },
};

export { BASE_URL };
