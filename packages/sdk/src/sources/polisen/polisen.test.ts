import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { svedata } from '../../index.js';
import { BASE_URL } from './index.js';

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const sampleEvent = (id: number, gps: string) => ({
  id,
  datetime: '2026-05-13 17:51:45 +02:00',
  name: '13 maj 16.04, Rån, Stockholm',
  summary: 'En kvinna i 85-årsåldern har blivit rånad.',
  url: '/aktuellt/handelser/2026/maj/13/13-maj-16.04-ran-stockholm/',
  type: 'Rån',
  location: { name: 'Stockholms län', gps },
});

describe('svedata.polisen.events', () => {
  it('mappar händelser: parsar gps, absolutifierar url, normaliserar datetime', async () => {
    server.use(
      http.get(`${BASE_URL}/api/events`, ({ request }) => {
        const url = new URL(request.url);
        expect(url.searchParams.get('locationname')).toBe('Stockholm;Göteborg');
        return HttpResponse.json([sampleEvent(1, '59.602496,18.138438')]);
      }),
    );

    const result = await svedata.polisen.events({
      location: ['Stockholm', 'Göteborg'],
    });

    expect(result.data?.total).toBe(1);
    const ev = result.data?.events[0];
    expect(ev?.id).toBe(1);
    expect(ev?.latitude).toBeCloseTo(59.602496);
    expect(ev?.longitude).toBeCloseTo(18.138438);
    expect(ev?.url).toBe(
      'https://polisen.se/aktuellt/handelser/2026/maj/13/13-maj-16.04-ran-stockholm/',
    );
    expect(ev?.datetime).toBe('2026-05-13T17:51:45+02:00');
    expect(ev?.location_name).toBe('Stockholms län');
  });

  it('skickar User-Agent-header (krävs av API:t)', async () => {
    server.use(
      http.get(`${BASE_URL}/api/events`, ({ request }) => {
        expect(request.headers.get('User-Agent')).toContain('svedata');
        return HttpResponse.json([]);
      }),
    );

    await svedata.polisen.events();
  });

  it('respekterar limit-option (klipper resultatet)', async () => {
    server.use(
      http.get(`${BASE_URL}/api/events`, () =>
        HttpResponse.json([
          sampleEvent(1, '59.0,18.0'),
          sampleEvent(2, '59.0,18.0'),
          sampleEvent(3, '59.0,18.0'),
        ]),
      ),
    );

    const result = await svedata.polisen.events({ limit: 2 });
    // total reflects the upstream count (3), not the truncated count (2),
    // matching the convention in scb.search and riksdagen.documents.
    expect(result.data?.total).toBe(3);
    expect(result.data?.events).toHaveLength(2);
    expect(result.data!.total).toBeGreaterThanOrEqual(result.data!.events.length);
  });

  it('hanterar trasig gps-sträng som null/null', async () => {
    server.use(
      http.get(`${BASE_URL}/api/events`, () =>
        HttpResponse.json([sampleEvent(1, 'broken')]),
      ),
    );

    const result = await svedata.polisen.events();
    expect(result.data?.events[0]?.latitude).toBeNull();
    expect(result.data?.events[0]?.longitude).toBeNull();
  });

  it('sätter meta.error = "not_found" vid 404', async () => {
    server.use(http.get(`${BASE_URL}/api/events`, () => new HttpResponse(null, { status: 404 })));
    const result = await svedata.polisen.events();
    expect(result.data).toBeNull();
    expect(result.meta.error).toBe('not_found');
  });

  it('sätter meta.error = "rate_limited" med rate_limit_remaining = 0', async () => {
    server.use(http.get(`${BASE_URL}/api/events`, () => new HttpResponse(null, { status: 429 })));
    const result = await svedata.polisen.events();
    expect(result.data).toBeNull();
    expect(result.meta.rate_limit_remaining).toBe(0);
    expect(result.meta.error).toBe('rate_limited');
  });

  it('sätter meta.error = "upstream_error" vid 500', async () => {
    server.use(http.get(`${BASE_URL}/api/events`, () => new HttpResponse(null, { status: 500 })));
    const result = await svedata.polisen.events();
    expect(result.data).toBeNull();
    expect(result.meta.error).toBe('upstream_error');
  });
});
