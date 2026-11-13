import type {
  ArbetsformedlingenJobAd,
  ArbetsformedlingenSearchResult,
  Envelope,
} from '@svedata/types';
import { empty, makeMeta, ok } from '../../lib/envelope.js';
import { svedataFetch } from '../../lib/http.js';

const SOURCE = 'arbetsformedlingen';
const BASE_URL = 'https://jobsearch.api.jobtechdev.se';
// JobSearch rejects limit > 100 with HTTP 400.
const MAX_LIMIT = 100;

type Labelled = { label: string | null } | null | undefined;

type RawAddress = {
  municipality?: string | null;
  municipality_code?: string | null;
  region?: string | null;
  region_code?: string | null;
  coordinates?: (number | null)[] | null;
};

type RawAd = {
  id: string;
  headline: string;
  description?: { text?: string | null } | null;
  webpage_url?: string | null;
  employer?: { name?: string | null; workplace?: string | null } | null;
  occupation?: Labelled;
  occupation_group?: Labelled;
  occupation_field?: Labelled;
  employment_type?: Labelled;
  working_hours_type?: Labelled;
  number_of_vacancies?: number | null;
  workplace_address?: RawAddress | null;
  publication_date: string;
  application_deadline?: string | null;
};

type RawSearch = {
  total?: { value?: number };
  hits?: RawAd[];
};

function label(value: Labelled): string | null {
  return value?.label ?? null;
}

function finiteOrNull(n: number | null | undefined): number | null {
  return typeof n === 'number' && Number.isFinite(n) ? n : null;
}

// Deliberately leaves out `application_contacts`, the employer's phone/e-mail
// and the organisation number: contacts are named recruiters, and for sole
// traders the organisation number is the owner's personnummer. Consumers who
// need them can follow `url` to the ad on Platsbanken.
function mapAd(ad: RawAd): ArbetsformedlingenJobAd {
  const addr = ad.workplace_address ?? {};
  // JobTech coordinates are GeoJSON order: [longitude, latitude].
  const coords = Array.isArray(addr.coordinates) ? addr.coordinates : [];
  return {
    id: String(ad.id),
    headline: ad.headline,
    description: ad.description?.text ?? '',
    url: ad.webpage_url ?? `https://arbetsformedlingen.se/platsbanken/annonser/${ad.id}`,
    employer_name: ad.employer?.name ?? null,
    workplace: ad.employer?.workplace ?? null,
    occupation: label(ad.occupation),
    occupation_group: label(ad.occupation_group),
    occupation_field: label(ad.occupation_field),
    employment_type: label(ad.employment_type),
    working_hours: label(ad.working_hours_type),
    vacancies: finiteOrNull(ad.number_of_vacancies),
    municipality: addr.municipality ?? null,
    municipality_code: addr.municipality_code ?? null,
    region: addr.region ?? null,
    region_code: addr.region_code ?? null,
    latitude: finiteOrNull(coords[1]),
    longitude: finiteOrNull(coords[0]),
    published: ad.publication_date,
    application_deadline: ad.application_deadline ?? null,
  };
}

type ErrorKind = 'not_found' | 'rate_limited' | 'upstream_error';

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
  if (kind === 'rate_limited') return empty(makeMeta(SOURCE, 0, false, 'rate_limited'));
  return empty(makeMeta(SOURCE, null, false, kind));
}

export type ArbetsformedlingenSearchOptions = {
  /** Free text, e.g. 'utvecklare' or 'sjuksköterska Lund'. */
  query?: string;
  /** Kommunkod ('1281') or JobTech taxonomy concept id. One or several. */
  municipality?: string | string[];
  /** Länskod ('12') or JobTech taxonomy concept id. One or several. */
  region?: string | string[];
  /** Only ads published in the last N minutes. */
  publishedWithinMinutes?: number;
  /** 1–100, default 20. Values above 100 are clamped. */
  limit?: number;
  offset?: number;
};

export const arbetsformedlingen = {
  /** Search open job ads on Platsbanken via the JobTech JobSearch API. */
  async search(
    options: ArbetsformedlingenSearchOptions = {},
  ): Promise<Envelope<ArbetsformedlingenSearchResult>> {
    const limit = Math.min(Math.max(Math.trunc(options.limit ?? 20), 1), MAX_LIMIT);
    const offset = Math.max(Math.trunc(options.offset ?? 0), 0);
    const params = new URLSearchParams();
    if (options.query) params.set('q', options.query);
    for (const m of [options.municipality ?? []].flat()) params.append('municipality', m);
    for (const r of [options.region ?? []].flat()) params.append('region', r);
    if (options.publishedWithinMinutes !== undefined) {
      params.set('published-after', String(Math.trunc(options.publishedWithinMinutes)));
    }
    params.set('limit', String(limit));
    params.set('offset', String(offset));

    const result = await fetchJson<RawSearch>(`/search?${params}`);
    if (result.kind !== 'ok') return emptyFor<ArbetsformedlingenSearchResult>(result.kind);
    if (!result.body || !Array.isArray(result.body.hits)) {
      return emptyFor<ArbetsformedlingenSearchResult>('upstream_error');
    }

    const jobs = result.body.hits.map(mapAd);
    return ok({ total: result.body.total?.value ?? jobs.length, offset, jobs }, makeMeta(SOURCE));
  },

  /** Fetch one ad by id. Removed or unknown ads give `meta.error: 'not_found'`. */
  async lookup(id: string): Promise<Envelope<ArbetsformedlingenJobAd>> {
    const result = await fetchJson<RawAd>(`/ad/${encodeURIComponent(id)}`);
    if (result.kind !== 'ok') return emptyFor<ArbetsformedlingenJobAd>(result.kind);
    if (!result.body?.id) return emptyFor<ArbetsformedlingenJobAd>('upstream_error');
    return ok(mapAd(result.body), makeMeta(SOURCE));
  },
};

export { BASE_URL };
