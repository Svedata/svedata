import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { svedata } from '../../index.js';
import { BASE_URL, FX_GROUP_ID, FX_SERIES, POLICY_SERIES } from './index.js';

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('svedata.riksbanken.exchange', () => {
  it('returnerar växelkurser för EUR/USD/GBP/NOK/DKK', async () => {
    server.use(
      http.get(`${BASE_URL}/Observations/Latest/ByGroup/${FX_GROUP_ID}`, () =>
        HttpResponse.json([
          { seriesId: FX_SERIES.EUR, date: '2026-05-12', value: 10.89 },
          { seriesId: FX_SERIES.USD, date: '2026-05-12', value: 9.27 },
          { seriesId: FX_SERIES.GBP, date: '2026-05-12', value: 12.45 },
          { seriesId: FX_SERIES.NOK, date: '2026-05-12', value: 0.91 },
          { seriesId: FX_SERIES.DKK, date: '2026-05-12', value: 1.46 },
          { seriesId: 'SEKAUDPMI', date: '2026-05-12', value: 6.7 },
        ]),
      ),
    );

    const result = await svedata.riksbanken.exchange();

    expect(result.data).not.toBeNull();
    expect(result.data?.date).toBe('2026-05-12');
    expect(result.data?.rates.EUR).toBe(10.89);
    expect(result.data?.rates.USD).toBe(9.27);
    expect(result.data?.rates.GBP).toBe(12.45);
    expect(result.data?.rates.NOK).toBe(0.91);
    expect(result.data?.rates.DKK).toBe(1.46);
    expect(result.meta.source).toBe('riksbanken');
  });

  it('returnerar { data: null } vid 404', async () => {
    server.use(
      http.get(
        `${BASE_URL}/Observations/Latest/ByGroup/${FX_GROUP_ID}`,
        () => new HttpResponse(null, { status: 404 }),
      ),
    );

    const result = await svedata.riksbanken.exchange();

    expect(result.data).toBeNull();
  });

  it('hanterar 429 med rate_limit_remaining = 0 och meta.error = "rate_limited"', async () => {
    server.use(
      http.get(
        `${BASE_URL}/Observations/Latest/ByGroup/${FX_GROUP_ID}`,
        () => new HttpResponse(null, { status: 429 }),
      ),
    );

    const result = await svedata.riksbanken.exchange();

    expect(result.data).toBeNull();
    expect(result.meta.rate_limit_remaining).toBe(0);
    expect(result.meta.error).toBe('rate_limited');
  });

  it('retry:ar en gång när 429-body säger "try again in 0 seconds" och lyckas', async () => {
    let calls = 0;
    server.use(
      http.get(`${BASE_URL}/Observations/Latest/ByGroup/${FX_GROUP_ID}`, () => {
        calls++;
        if (calls === 1) {
          return HttpResponse.json(
            { statusCode: 429, message: 'Rate limit is exceeded. Try again in 0 seconds.' },
            { status: 429 },
          );
        }
        return HttpResponse.json([
          { seriesId: FX_SERIES.EUR, date: '2026-05-12', value: 10.89 },
          { seriesId: FX_SERIES.USD, date: '2026-05-12', value: 9.27 },
          { seriesId: FX_SERIES.GBP, date: '2026-05-12', value: 12.45 },
          { seriesId: FX_SERIES.NOK, date: '2026-05-12', value: 0.91 },
          { seriesId: FX_SERIES.DKK, date: '2026-05-12', value: 1.46 },
        ]);
      }),
    );

    const result = await svedata.riksbanken.exchange();

    expect(calls).toBe(2);
    expect(result.data?.rates.EUR).toBe(10.89);
    expect(result.meta.error).toBeUndefined();
  });

  it('retry:ar inte när 429 säger längre wait än 10 sekunder', async () => {
    let calls = 0;
    server.use(
      http.get(`${BASE_URL}/Observations/Latest/ByGroup/${FX_GROUP_ID}`, () => {
        calls++;
        return HttpResponse.json(
          { statusCode: 429, message: 'Rate limit is exceeded. Try again in 39 seconds.' },
          { status: 429 },
        );
      }),
    );

    const result = await svedata.riksbanken.exchange();

    expect(calls).toBe(1);
    expect(result.data).toBeNull();
    expect(result.meta.error).toBe('rate_limited');
  });

  it('respekterar Retry-After-header (i sekunder) framför body-meddelande', async () => {
    let calls = 0;
    server.use(
      http.get(`${BASE_URL}/Observations/Latest/ByGroup/${FX_GROUP_ID}`, () => {
        calls++;
        if (calls === 1) {
          return new HttpResponse(null, { status: 429, headers: { 'Retry-After': '0' } });
        }
        return HttpResponse.json([
          { seriesId: FX_SERIES.EUR, date: '2026-05-12', value: 10.89 },
        ]);
      }),
    );

    const result = await svedata.riksbanken.exchange();

    expect(calls).toBe(2);
    expect(result.data?.rates.EUR).toBe(10.89);
  });
});

describe('svedata.riksbanken.policy', () => {
  it('returnerar styrränta och datum för senaste ändring', async () => {
    server.use(
      http.get(`${BASE_URL}/Observations/Latest/${POLICY_SERIES}`, () =>
        HttpResponse.json({ date: '2026-05-13', value: 1.75 }),
      ),
      http.get(`${BASE_URL}/Observations/${POLICY_SERIES}/:from/:to`, () =>
        HttpResponse.json([
          { date: '2025-06-25', value: 2.0 },
          { date: '2025-09-30', value: 2.0 },
          { date: '2025-10-01', value: 1.75 },
          { date: '2026-05-13', value: 1.75 },
        ]),
      ),
    );

    const result = await svedata.riksbanken.policy();

    expect(result.data?.rate).toBe(1.75);
    expect(result.data?.date).toBe('2026-05-13');
    expect(result.data?.last_change_date).toBe('2025-10-01');
  });

  it('returnerar { data: null } vid 404 på latest', async () => {
    server.use(
      http.get(
        `${BASE_URL}/Observations/Latest/${POLICY_SERIES}`,
        () => new HttpResponse(null, { status: 404 }),
      ),
    );

    const result = await svedata.riksbanken.policy();

    expect(result.data).toBeNull();
  });

  it('hanterar 429 med rate_limit_remaining = 0', async () => {
    server.use(
      http.get(
        `${BASE_URL}/Observations/Latest/${POLICY_SERIES}`,
        () => new HttpResponse(null, { status: 429 }),
      ),
    );

    const result = await svedata.riksbanken.policy();

    expect(result.data).toBeNull();
    expect(result.meta.rate_limit_remaining).toBe(0);
  });
});

describe('svedata.riksbanken.history', () => {
  it('returnerar observationer för EUR/SEK', async () => {
    server.use(
      http.get(`${BASE_URL}/Observations/${FX_SERIES.EUR}/:from/:to`, () =>
        HttpResponse.json([
          { date: '2026-05-08', value: 10.84 },
          { date: '2026-05-11', value: 10.87 },
          { date: '2026-05-12', value: 10.89 },
        ]),
      ),
    );

    const result = await svedata.riksbanken.history('EURSEK', '2026-05-01', '2026-05-13');

    expect(result.data?.pair).toBe('EUR/SEK');
    expect(result.data?.from).toBe('2026-05-01');
    expect(result.data?.observations).toHaveLength(3);
    expect(result.data?.observations[0]).toEqual({ date: '2026-05-08', rate: 10.84 });
  });

  it('accepterar "EUR/SEK" och "eur-sek" som pair', async () => {
    server.use(
      http.get(`${BASE_URL}/Observations/${FX_SERIES.EUR}/:from/:to`, () =>
        HttpResponse.json([{ date: '2026-05-12', value: 10.89 }]),
      ),
    );

    const a = await svedata.riksbanken.history('EUR/SEK', '2026-05-12', '2026-05-12');
    const b = await svedata.riksbanken.history('eur-sek', '2026-05-12', '2026-05-12');
    expect(a.data?.pair).toBe('EUR/SEK');
    expect(b.data?.pair).toBe('EUR/SEK');
  });

  it('returnerar { data: null } för okänt valutapar utan nätverksanrop', async () => {
    const result = await svedata.riksbanken.history('ZZZ', '2026-05-01', '2026-05-13');
    expect(result.data).toBeNull();
  });

  it('hanterar 429 med rate_limit_remaining = 0', async () => {
    server.use(
      http.get(
        `${BASE_URL}/Observations/${FX_SERIES.EUR}/:from/:to`,
        () => new HttpResponse(null, { status: 429 }),
      ),
    );

    const result = await svedata.riksbanken.history('EURSEK', '2026-05-01', '2026-05-13');
    expect(result.data).toBeNull();
    expect(result.meta.rate_limit_remaining).toBe(0);
  });
});
