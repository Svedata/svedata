import type {
  Envelope,
  SkolverketEducation,
  SkolverketEducationList,
  SkolverketEvent,
  SkolverketEventList,
  SkolverketProvider,
  SkolverketProviderList,
  SkolverketSchoolType,
} from '@svedata/types';
import { empty, makeMeta, ok } from '../../lib/envelope.js';
import { svedataFetch } from '../../lib/http.js';

const SOURCE = 'skolverket';
const BASE_URL = 'https://api.skolverket.se/susa-navet/emil3';
const MAX_PAGE_SIZE = 2000;

type LocalizedStrings = { strings?: { lang?: string; value?: string }[] } | null | undefined;
type LocalizedUrls = { urls?: { lang?: string; value?: string }[] } | null | undefined;
type Code = { code?: string } | null | undefined;
type RawPage = { pageNumber?: number; size?: number; totalElements?: number };
type ErrorKind = 'not_found' | 'rate_limited' | 'upstream_error';

type RawEducation = {
  id: string;
  status?: string;
  content?: {
    code?: string;
    title?: LocalizedStrings;
    description?: LocalizedStrings;
    type?: Code;
    educationLevels?: Code[];
    url?: LocalizedUrls;
    lastEdited?: string;
  };
};

type RawEvent = {
  id: string;
  status?: string;
  content?: {
    education?: string;
    providers?: string[];
    execution?: { start?: string; end?: string };
    application?: { last?: string };
    places?: number;
    paceOfStudy?: { percentage?: number };
    locations?: { town?: string; areaCode?: string }[];
    languageOfInstructions?: string[];
    url?: LocalizedUrls;
    lastEdited?: string;
  };
};

type RawProvider = {
  id: string;
  status?: string;
  content?: {
    name?: LocalizedStrings;
    url?: LocalizedUrls;
    visitAddresses?: { town?: string }[];
    contactAddress?: { town?: string };
    responsibleBody?: { type?: Code };
    lastEdited?: string;
  };
};

function pick(values: { lang?: string; value?: string }[] | undefined): string | null {
  if (!Array.isArray(values) || values.length === 0) return null;
  return (values.find((v) => v.lang === 'swe') ?? values[0])?.value ?? null;
}

function text(value: LocalizedStrings): string {
  return pick(value?.strings) ?? '';
}

function url(value: LocalizedUrls): string | null {
  return pick(value?.urls);
}

function finite(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function mapEducation(e: RawEducation): SkolverketEducation {
  const c = e.content ?? {};
  return {
    id: e.id,
    code: c.code ?? null,
    title: text(c.title),
    description: text(c.description),
    school_type: c.type?.code ?? null,
    education_levels: (c.educationLevels ?? []).flatMap((l) => (l?.code ? [l.code] : [])),
    url: url(c.url),
    status: e.status ?? '',
    last_edited: c.lastEdited ?? null,
  };
}

function mapEvent(e: RawEvent): SkolverketEvent {
  const c = e.content ?? {};
  return {
    id: e.id,
    education_id: c.education ?? null,
    provider_ids: Array.isArray(c.providers) ? c.providers : [],
    start: c.execution?.start ?? null,
    end: c.execution?.end ?? null,
    application_deadline: c.application?.last ?? null,
    places: finite(c.places),
    pace_percent: finite(c.paceOfStudy?.percentage),
    locations: (c.locations ?? []).map((l) => ({
      town: l.town ?? null,
      municipality_code: l.areaCode ?? null,
    })),
    languages: Array.isArray(c.languageOfInstructions) ? c.languageOfInstructions : [],
    url: url(c.url),
    status: e.status ?? '',
    last_edited: c.lastEdited ?? null,
  };
}

function mapProvider(p: RawProvider): SkolverketProvider {
  const c = p.content ?? {};
  return {
    id: p.id,
    name: text(c.name),
    url: url(c.url),
    town: c.visitAddresses?.[0]?.town ?? c.contactAddress?.town ?? null,
    responsible_body: c.responsibleBody?.type?.code ?? null,
    status: p.status ?? '',
    last_edited: c.lastEdited ?? null,
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

export type SkolverketListOptions = {
  schoolType?: SkolverketSchoolType | SkolverketSchoolType[];
  /** Only resources new, updated or removed since this date/time. */
  updatedSince?: string;
  /** Zero-based page number. */
  page?: number;
  /** 1–2000, default 100. */
  pageSize?: number;
};

export type SkolverketEventOptions = SkolverketListOptions & {
  providerId?: string;
};

function listParams(options: SkolverketEventOptions): {
  params: URLSearchParams;
  page: number;
  pageSize: number;
} {
  const page = Math.max(Math.trunc(options.page ?? 0), 0);
  const pageSize = Math.min(Math.max(Math.trunc(options.pageSize ?? 100), 1), MAX_PAGE_SIZE);
  const params = new URLSearchParams({ page: String(page), size: String(pageSize) });
  for (const type of [options.schoolType ?? []].flat()) params.append('schoolType', type);
  if (options.updatedSince) params.set('updatedSince', options.updatedSince);
  if (options.providerId) params.set('providerId', options.providerId);
  return { params, page, pageSize };
}

async function list<TRaw, TItem>(
  path: string,
  key: string,
  options: SkolverketEventOptions,
  map: (raw: TRaw) => TItem,
): Promise<Envelope<{ page: number; page_size: number; total: number; items: TItem[] }>> {
  const { params, page, pageSize } = listParams(options);
  const result = await fetchJson<Record<string, unknown> & { page?: RawPage }>(`${path}?${params}`);
  if (result.kind !== 'ok') return emptyFor(result.kind);
  const raw = result.body?.[key];
  if (!Array.isArray(raw)) return emptyFor('upstream_error');
  const items = (raw as TRaw[])
    .filter((x) => x && typeof (x as { id?: unknown }).id === 'string')
    .map(map);
  return ok(
    {
      page: result.body.page?.pageNumber ?? page,
      page_size: result.body.page?.size ?? pageSize,
      total: result.body.page?.totalElements ?? items.length,
      items,
    },
    makeMeta(SOURCE),
  );
}

export const skolverket = {
  /** Education offerings (utbildningar) from Susa-navet. */
  async educations(
    options: SkolverketListOptions = {},
  ): Promise<Envelope<SkolverketEducationList>> {
    const r = await list('/educationInfos', 'educationInfos', options, mapEducation);
    if (!r.data) return empty(r.meta);
    const { items, ...page } = r.data;
    return ok({ ...page, educations: items }, r.meta);
  },

  /** Scheduled education events (utbildningstillfällen) with start, end and places. */
  async events(options: SkolverketEventOptions = {}): Promise<Envelope<SkolverketEventList>> {
    const r = await list('/educationEvents', 'educationEvents', options, mapEvent);
    if (!r.data) return empty(r.meta);
    const { items, ...page } = r.data;
    return ok({ ...page, events: items }, r.meta);
  },

  /** Education providers (utbildningsanordnare). */
  async providers(options: SkolverketListOptions = {}): Promise<Envelope<SkolverketProviderList>> {
    const r = await list('/educationProviders', 'educationProviders', options, mapProvider);
    if (!r.data) return empty(r.meta);
    const { items, ...page } = r.data;
    return ok({ ...page, providers: items }, r.meta);
  },

  /** One education offering by id, e.g. 'i.myh.yh.8917'. */
  async education(id: string): Promise<Envelope<SkolverketEducation>> {
    const result = await fetchJson<RawEducation>(`/educationInfos/${encodeURIComponent(id)}`);
    if (result.kind !== 'ok') return emptyFor(result.kind);
    if (!result.body?.id) return emptyFor('upstream_error');
    return ok(mapEducation(result.body), makeMeta(SOURCE));
  },
};

export { BASE_URL };
