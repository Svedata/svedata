import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { svedata } from '../../index.js';
import { BASE_URL } from './index.js';

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const sampleNews = (identifier: string, published: string) => ({
  identifier,
  contentId: Number(identifier),
  contentTypeName: 'newspage',
  updated: published,
  published,
  headline: 'Röd varning för snöfall i Skellefteå',
  preamble: 'SMHI har utfärdat en röd varning.',
  bodyText: 'Varningen gäller från torsdag.',
  mobileBody: '<p>Varningen gäller från torsdag.</p>',
  imageLink: '',
  links: [
    { text: 'SMHI:s varningar', url: 'https://www.smhi.se/vader/varningar' },
    { text: 'Trasig länk', url: '' },
  ],
  area: [
    { type: 'County', description: 'Västerbottens län', coordinate: null, coordinateObject: null },
  ],
  web: 'https://www.krisinformation.se/aktuellt/nyheter/rod-varning/',
  language: 'sv',
  event: 'News',
  senderName: '',
  bodyLinks: [],
  isPinned: false,
});

describe('svedata.krisinformation.news', () => {
  it('hämtar alla län som default och mappar nyheter (nyast först)', async () => {
    server.use(
      http.get(`${BASE_URL}/news`, ({ request }) => {
        const p = new URL(request.url).searchParams;
        expect(p.get('allcounties')).toBe('true');
        expect(p.get('counties')).toBeNull();
        expect(request.headers.get('User-Agent')).toContain('svedata');
        return HttpResponse.json([
          sampleNews('1262', '2026-11-11T13:26:20+01:00'),
          sampleNews('1263', '2026-11-12T08:22:12+01:00'),
        ]);
      }),
    );

    const result = await svedata.krisinformation.news();
    expect(result.meta.source).toBe('krisinformation');
    expect(result.data?.total).toBe(2);
    expect(result.data?.news.map((n) => n.id)).toEqual(['1263', '1262']);
    expect(result.data?.news[0]).toEqual({
      id: '1263',
      headline: 'Röd varning för snöfall i Skellefteå',
      preamble: 'SMHI har utfärdat en röd varning.',
      body: 'Varningen gäller från torsdag.',
      published: '2026-11-12T08:22:12+01:00',
      updated: '2026-11-12T08:22:12+01:00',
      url: 'https://www.krisinformation.se/aktuellt/nyheter/rod-varning/',
      language: 'sv',
      areas: [{ type: 'County', name: 'Västerbottens län' }],
      links: [{ text: 'SMHI:s varningar', url: 'https://www.smhi.se/vader/varningar' }],
    });
  });

  it('skickar länskoder komma-separerade, days och respekterar limit', async () => {
    server.use(
      http.get(`${BASE_URL}/news`, ({ request }) => {
        const p = new URL(request.url).searchParams;
        expect(p.get('counties')).toBe('24,25');
        expect(p.get('allcounties')).toBeNull();
        expect(p.get('days')).toBe('30');
        return HttpResponse.json([
          sampleNews('1', '2026-11-01T10:00:00+01:00'),
          sampleNews('2', '2026-11-02T10:00:00+01:00'),
          sampleNews('3', '2026-11-03T10:00:00+01:00'),
        ]);
      }),
    );
    const result = await svedata.krisinformation.news({
      counties: ['24', '25'],
      days: 30,
      limit: 2,
    });
    expect(result.data?.total).toBe(3);
    expect(result.data?.news.map((n) => n.id)).toEqual(['3', '2']);
  });

  it('returnerar tom lista (inte null) när inget har hänt', async () => {
    server.use(http.get(`${BASE_URL}/news`, () => HttpResponse.json([])));
    const result = await svedata.krisinformation.news();
    expect(result.data).toEqual({ total: 0, news: [] });
    expect(result.meta.error).toBeUndefined();
  });

  it('sätter meta.error = "rate_limited" med rate_limit_remaining = 0', async () => {
    server.use(http.get(`${BASE_URL}/news`, () => new HttpResponse(null, { status: 429 })));
    const result = await svedata.krisinformation.news();
    expect(result.data).toBeNull();
    expect(result.meta.rate_limit_remaining).toBe(0);
    expect(result.meta.error).toBe('rate_limited');
  });

  it('sätter meta.error = "upstream_error" vid 500 och icke-JSON-svar', async () => {
    server.use(http.get(`${BASE_URL}/news`, () => new HttpResponse(null, { status: 500 })));
    const a = await svedata.krisinformation.news();
    expect(a.meta.error).toBe('upstream_error');

    server.use(http.get(`${BASE_URL}/news`, () => HttpResponse.text('<!doctype html>')));
    const b = await svedata.krisinformation.news();
    expect(b.data).toBeNull();
    expect(b.meta.error).toBe('upstream_error');
  });
});

describe('svedata.krisinformation.lookup', () => {
  it('hämtar en nyhet på id', async () => {
    server.use(
      http.get(`${BASE_URL}/news/1263`, () =>
        HttpResponse.json(sampleNews('1263', '2026-11-12T08:22:12+01:00')),
      ),
    );
    const result = await svedata.krisinformation.lookup(1263);
    expect(result.data?.id).toBe('1263');
  });

  it('sätter meta.error = "not_found" vid 404 med HTML-felsida', async () => {
    server.use(
      http.get(
        `${BASE_URL}/news/99999999`,
        () =>
          new HttpResponse('<!doctype html><title>Sidan kunde inte hittas</title>', {
            status: 404,
            headers: { 'Content-Type': 'text/html' },
          }),
      ),
    );
    const result = await svedata.krisinformation.lookup('99999999');
    expect(result.data).toBeNull();
    expect(result.meta.error).toBe('not_found');
  });
});
