import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { svedata } from '../../index.js';
import { BASE_URL, buildPricesUrl } from './index.js';

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const samplePrice = (start: string, end: string, sek: number, eur: number) => ({
  SEK_per_kWh: sek,
  EUR_per_kWh: eur,
  EXR: 10.89,
  time_start: start,
  time_end: end,
});

describe('svedata.nordpool.prices', () => {
  it('mappar 15-min-intervaller och normaliserar fältnamn', async () => {
    const url = buildPricesUrl('SE3', '2026-05-13');
    server.use(
      http.get(url, () =>
        HttpResponse.json([
          samplePrice('2026-05-13T00:00:00+02:00', '2026-05-13T00:15:00+02:00', 1.33, 0.12),
          samplePrice('2026-05-13T00:15:00+02:00', '2026-05-13T00:30:00+02:00', 1.25, 0.115),
        ]),
      ),
    );

    const result = await svedata.nordpool.prices('SE3', { date: '2026-05-13' });

    expect(result.data?.area).toBe('SE3');
    expect(result.data?.date).toBe('2026-05-13');
    expect(result.data?.prices).toHaveLength(2);
    expect(result.data?.prices[0]).toEqual({
      start: '2026-05-13T00:00:00+02:00',
      end: '2026-05-13T00:15:00+02:00',
      sek_per_kwh: 1.33,
      eur_per_kwh: 0.12,
      exr: 10.89,
    });
    expect(result.meta.source).toBe('nordpool');
  });

  it('bygger URL:en med rätt år/månad/dag-format', () => {
    expect(buildPricesUrl('SE4', '2026-05-13')).toBe(
      `${BASE_URL}/api/v1/prices/2026/05-13_SE4.json`,
    );
    expect(buildPricesUrl('SE1', '2026-01-01')).toBe(
      `${BASE_URL}/api/v1/prices/2026/01-01_SE1.json`,
    );
  });

  it('returnerar { data: null } vid 404 (t.ex. morgondagens pris ej publicerat)', async () => {
    const url = buildPricesUrl('SE3', '2099-01-01');
    server.use(http.get(url, () => new HttpResponse(null, { status: 404 })));

    const result = await svedata.nordpool.prices('SE3', { date: '2099-01-01' });
    expect(result.data).toBeNull();
  });

  it('hanterar 429 med rate_limit_remaining = 0', async () => {
    const url = buildPricesUrl('SE3', '2026-05-13');
    server.use(http.get(url, () => new HttpResponse(null, { status: 429 })));

    const result = await svedata.nordpool.prices('SE3', { date: '2026-05-13' });
    expect(result.data).toBeNull();
    expect(result.meta.rate_limit_remaining).toBe(0);
  });

  it('returnerar { data: null } vid tom array', async () => {
    const url = buildPricesUrl('SE2', '2026-05-13');
    server.use(http.get(url, () => HttpResponse.json([])));

    const result = await svedata.nordpool.prices('SE2', { date: '2026-05-13' });
    expect(result.data).toBeNull();
  });
});
