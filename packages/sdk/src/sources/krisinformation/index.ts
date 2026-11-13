import type { Envelope, KrisinformationNews, KrisinformationNewsList } from '@svedata/types';
import { empty, makeMeta, ok } from '../../lib/envelope.js';
import { svedataFetch } from '../../lib/http.js';

const SOURCE = 'krisinformation';
const BASE_URL = 'https://api.krisinformation.se/v3';

type RawNews = {
  identifier: string;
  headline: string;
  preamble?: string | null;
  bodyText?: string | null;
  published: string;
  updated?: string | null;
  web?: string | null;
  language?: string | null;
  area?: { type?: string | null; description?: string | null }[] | null;
  links?: { text?: string | null; url?: string | null }[] | null;
};

function mapNews(n: RawNews): KrisinformationNews {
  return {
    id: String(n.identifier),
    headline: n.headline,
    preamble: n.preamble ?? '',
    body: n.bodyText ?? '',
    published: n.published,
    updated: n.updated || n.published,
    url: n.web || null,
    language: n.language ?? 'sv',
    areas: (Array.isArray(n.area) ? n.area : []).map((a) => ({
      type: a.type ?? '',
      name: a.description ?? '',
    })),
    links: (Array.isArray(n.links) ? n.links : [])
      .filter((l) => typeof l.url === 'string' && l.url.length > 0)
      .map((l) => ({ text: l.text ?? '', url: l.url! })),
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
  // Unknown ids return an HTML error page with status 404.
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

export type KrisinformationNewsOptions = {
  /**
   * Two-digit länskod, e.g. '01' (Stockholm) or '24' (Västerbotten). One or
   * several. Omit to get news for all counties.
   */
  counties?: string | string[];
  /** How many days back to look. Upstream default is 7. */
  days?: number;
  limit?: number;
};

export const krisinformation = {
  /** Crisis and emergency news published on Krisinformation.se. */
  async news(options: KrisinformationNewsOptions = {}): Promise<Envelope<KrisinformationNewsList>> {
    const params = new URLSearchParams();
    const counties = [options.counties ?? []].flat();
    if (counties.length > 0) params.set('counties', counties.join(','));
    else params.set('allcounties', 'true');
    if (options.days !== undefined) params.set('days', String(Math.trunc(options.days)));

    const result = await fetchJson<RawNews[]>(`/news?${params}`);
    if (result.kind !== 'ok') return emptyFor<KrisinformationNewsList>(result.kind);
    if (!Array.isArray(result.body)) return emptyFor<KrisinformationNewsList>('upstream_error');

    const sorted = result.body
      .filter((n) => n && n.identifier !== undefined)
      .map(mapNews)
      .sort((a, b) => b.published.localeCompare(a.published));
    const total = sorted.length;
    const news = options.limit ? sorted.slice(0, options.limit) : sorted;
    return ok({ total, news }, makeMeta(SOURCE));
  },

  /** One news item by id. */
  async lookup(id: string | number): Promise<Envelope<KrisinformationNews>> {
    const result = await fetchJson<RawNews>(`/news/${encodeURIComponent(String(id))}`);
    if (result.kind !== 'ok') return emptyFor<KrisinformationNews>(result.kind);
    if (!result.body?.identifier) return emptyFor<KrisinformationNews>('upstream_error');
    return ok(mapNews(result.body), makeMeta(SOURCE));
  },
};

export { BASE_URL };
