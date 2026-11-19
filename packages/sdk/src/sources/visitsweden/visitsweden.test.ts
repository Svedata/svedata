import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { svedata } from '../../index.js';
import { BASE_URL } from './index.js';

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const eventMetadata = {
  '@id': 'https://data.visitsweden.com/store/210/metadata/4613',
  '@graph': [
    {
      '@id': 'https://www.visitstockholm.com/events/barbados/',
      '@type': 'schema:Event',
      'schema:name': [
        { '@value': 'Barbados (sv)', '@language': 'sv' },
        { '@value': 'Barbados (en)', '@language': 'en' },
      ],
      'schema:description': { '@value': 'Nostalgifest.', '@language': 'sv' },
      'schema:url': { '@id': 'https://www.visitstockholm.com/events/barbados/' },
      'dcterms:spatial': { '@id': 'http://data.visitsweden.com/region/stockholm' },
      'schema:startDate': { '@value': '2027-10-09', '@type': 'xsd:dateTime' },
      'schema:endDate': { '@value': '2027-10-09', '@type': 'xsd:dateTime' },
      'schema:geo': { '@id': '_:geo' },
      'schema:address': { '@id': '_:addr' },
    },
    {
      '@id': '_:geo',
      '@type': 'schema:GeoCoordinates',
      'schema:latitude': '59.2931',
      'schema:longitude': 18.0818,
    },
    {
      '@id': '_:addr',
      '@type': 'schema:PostalAddress',
      'schema:streetAddress': 'Arenatorget',
      'schema:postalCode': '121 77',
      'schema:addressLocality': 'Johanneshov',
    },
  ],
};

describe('svedata.visitsweden.search', () => {
  it('bygger en escapad Solr-fråga och mappar JSON-LD', async () => {
    server.use(
      http.get(`${BASE_URL}/search`, ({ request }) => {
        const p = new URL(request.url).searchParams;
        expect(p.get('type')).toBe('solr');
        expect(p.get('query')).toBe(
          'public:true AND (rdfType:http\\:\\/\\/schema.org\\/Event) AND all:göteborg AND all:a\\:b\\(c\\) AND metadata.object.uri:http\\:\\/\\/data.visitsweden.com\\/region\\/stockholm',
        );
        expect(p.get('limit')).toBe('100');
        expect(p.get('offset')).toBe('5');
        expect(request.headers.get('User-Agent')).toContain('svedata');
        return HttpResponse.json({
          offset: 5,
          limit: 100,
          results: 9,
          resource: { children: [{ contextId: '210', entryId: '4613', metadata: eventMetadata }] },
        });
      }),
    );

    const result = await svedata.visitsweden.search({
      type: 'event',
      query: 'Göteborg a:b(c)',
      region: 'stockholm',
      limit: 500,
      offset: 5,
    });
    expect(result.meta.source).toBe('visitsweden');
    expect(result.data?.total).toBe(9);
    expect(result.data?.items[0]).toEqual({
      id: '210/4613',
      type: 'Event',
      name: 'Barbados (sv)',
      description: 'Nostalgifest.',
      url: 'https://www.visitstockholm.com/events/barbados/',
      region: 'stockholm',
      latitude: 59.2931,
      longitude: 18.0818,
      street_address: 'Arenatorget',
      postal_code: '121 77',
      locality: 'Johanneshov',
      start_date: '2027-10-09',
      end_date: '2027-10-09',
    });
  });

  it('söker alla sex upplevelsetyper som default och väljer språk', async () => {
    server.use(
      http.get(`${BASE_URL}/search`, ({ request }) => {
        const q = new URL(request.url).searchParams.get('query')!;
        for (const t of [
          'LodgingBusiness',
          'FoodEstablishment',
          'Event',
          'Place',
          'Store',
          'Trip',
        ]) {
          expect(q).toContain(`schema.org\\/${t}`);
        }
        return HttpResponse.json({
          results: 1,
          resource: { children: [{ contextId: '210', entryId: '4613', metadata: eventMetadata }] },
        });
      }),
    );
    const result = await svedata.visitsweden.search({ lang: 'en' });
    expect(result.data?.items[0]?.name).toBe('Barbados (en)');
  });

  it('hoppar över poster utan upplevelsetyp', async () => {
    server.use(
      http.get(`${BASE_URL}/search`, () =>
        HttpResponse.json({
          results: 1,
          resource: {
            children: [
              {
                contextId: '1',
                entryId: '2',
                metadata: { '@graph': [{ '@type': 'schema:ImageObject' }] },
              },
            ],
          },
        }),
      ),
    );
    expect((await svedata.visitsweden.search()).data?.items).toEqual([]);
  });

  it('ger upstream_error vid 400 och oväntad body', async () => {
    server.use(
      http.get(`${BASE_URL}/search`, () => HttpResponse.json({ error: 'x' }, { status: 400 })),
    );
    expect((await svedata.visitsweden.search()).meta.error).toBe('upstream_error');
    server.use(http.get(`${BASE_URL}/search`, () => HttpResponse.json({ nope: true })));
    expect((await svedata.visitsweden.search()).meta.error).toBe('upstream_error');
  });

  it('sätter rate_limited vid 429', async () => {
    server.use(http.get(`${BASE_URL}/search`, () => new HttpResponse(null, { status: 429 })));
    const result = await svedata.visitsweden.search();
    expect(result.meta.error).toBe('rate_limited');
    expect(result.meta.rate_limit_remaining).toBe(0);
  });
});

describe('svedata.visitsweden.lookup', () => {
  it('hämtar en post via context/entry', async () => {
    server.use(http.get(`${BASE_URL}/210/metadata/4613`, () => HttpResponse.json(eventMetadata)));
    expect((await svedata.visitsweden.lookup('210/4613')).data?.locality).toBe('Johanneshov');
  });

  it('sätter not_found vid 404 och ogiltigt id utan anrop', async () => {
    server.use(
      http.get(`${BASE_URL}/210/metadata/99999999`, () =>
        HttpResponse.json({ status: 404 }, { status: 404 }),
      ),
    );
    expect((await svedata.visitsweden.lookup('210/99999999')).meta.error).toBe('not_found');
    // onUnhandledRequest: 'error' would fail if this made a request.
    expect((await svedata.visitsweden.lookup('../../etc')).meta.error).toBe('not_found');
  });
});
