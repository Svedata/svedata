import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { svedata } from '../../index.js';
import { BASE_URL } from './index.js';

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const ckan = (result: unknown) => ({ help: 'x', success: true, result });
const flow = (local: string, utc: string, from = 'SE3', to = 'SE4', power = 2251.43) => ({
  _id: 1,
  start_time_sweden: local,
  start_time_utc: utc,
  from_bidding_zone: from,
  to_bidding_zone: to,
  power,
  power_unit: 'MW',
  soda_hashbyte: 'x',
  soda_identity: 1,
});

describe('svedata.svk.datasets', () => {
  it('listar dataset och skickar User-Agent', async () => {
    server.use(
      http.get(`${BASE_URL}/package_list`, ({ request }) => {
        expect(request.headers.get('User-Agent')).toContain('svedata');
        return HttpResponse.json(ckan(['net_cross_border_physical_flows']));
      }),
    );
    const result = await svedata.svk.datasets();
    expect(result.meta.source).toBe('svk');
    expect(result.data?.datasets).toEqual(['net_cross_border_physical_flows']);
  });
});

describe('svedata.svk.flows', () => {
  it('filtrerar ett helt datum med 96 lokala kvartstider och mappar UTC', async () => {
    server.use(
      http.get(`${BASE_URL}/datastore_search`, ({ request }) => {
        const p = new URL(request.url).searchParams;
        const filters = JSON.parse(p.get('filters')!);
        expect(filters.from_bidding_zone).toBe('SE3');
        expect(filters.to_bidding_zone).toBe('SE4');
        expect(filters.start_time_sweden).toHaveLength(96);
        expect(filters.start_time_sweden[0]).toBe('2026-11-19T00:00:00');
        expect(filters.start_time_sweden[95]).toBe('2026-11-19T23:45:00');
        expect(p.get('sort')).toBe('start_time_utc asc');
        return HttpResponse.json(
          ckan({ total: 1, records: [flow('2026-11-19T00:00:00', '2026-11-18T23:00:00')] }),
        );
      }),
    );
    const result = await svedata.svk.flows({ date: '2026-11-19', from: 'SE3', to: 'SE4' });
    expect(result.data).toEqual({
      date: '2026-11-19',
      flows: [
        {
          start: '2026-11-18T23:00:00Z',
          start_local: '2026-11-19T00:00:00',
          from: 'SE3',
          to: 'SE4',
          power_mw: 2251.43,
        },
      ],
    });
  });

  it('ger not_found för datum utan data', async () => {
    server.use(
      http.get(`${BASE_URL}/datastore_search`, () =>
        HttpResponse.json(ckan({ total: 0, records: [] })),
      ),
    );
    const result = await svedata.svk.flows({ date: '2030-01-01' });
    expect(result.data).toBeNull();
    expect(result.meta.error).toBe('not_found');
  });

  it('ger upstream_error hellre än att tyst klippa ett trunkerat svar', async () => {
    server.use(
      http.get(`${BASE_URL}/datastore_search`, () =>
        HttpResponse.json(
          ckan({ total: 2, records: [flow('2026-11-19T00:00:00', '2026-11-18T23:00:00')] }),
        ),
      ),
    );
    const result = await svedata.svk.flows({ date: '2026-11-19' });
    expect(result.meta.error).toBe('upstream_error');
  });

  it('ger upstream_error vid oväntad enhet', async () => {
    server.use(
      http.get(`${BASE_URL}/datastore_search`, () =>
        HttpResponse.json(
          ckan({
            total: 1,
            records: [{ ...flow('2026-11-19T00:00:00', '2026-11-18T23:00:00'), power_unit: 'GW' }],
          }),
        ),
      ),
    );
    expect((await svedata.svk.flows({ date: '2026-11-19' })).meta.error).toBe('upstream_error');
  });
});

describe('svedata.svk.prices', () => {
  it('mappar historiska day-ahead-priser i EUR/MWh', async () => {
    server.use(
      http.get(`${BASE_URL}/datastore_search`, ({ request }) => {
        const filters = JSON.parse(new URL(request.url).searchParams.get('filters')!);
        expect(filters.bidding_zone).toBe('SE3');
        return HttpResponse.json(
          ckan({
            total: 1,
            records: [
              {
                start_time_sweden: '2026-06-15T00:00:00',
                start_time_utc: '2026-06-14T22:00:00',
                bidding_zone: 'SE3',
                price: 47.04,
                price_unit: 'EUR-MWh',
              },
            ],
          }),
        );
      }),
    );
    const result = await svedata.svk.prices('SE3', { date: '2026-06-15' });
    expect(result.data?.points).toEqual([
      { start: '2026-06-14T22:00:00Z', start_local: '2026-06-15T00:00:00', eur_per_mwh: 47.04 },
    ]);
  });

  it('mappar CKAN success:false Not Found till not_found', async () => {
    server.use(
      http.get(`${BASE_URL}/datastore_search`, () =>
        HttpResponse.json({ success: false, error: { __type: 'Not Found Error' } }),
      ),
    );
    expect((await svedata.svk.prices('SE3', { date: '2026-06-15' })).meta.error).toBe('not_found');
  });

  it('sätter rate_limited med rate_limit_remaining = 0 vid 429', async () => {
    server.use(
      http.get(`${BASE_URL}/datastore_search`, () => new HttpResponse(null, { status: 429 })),
    );
    const result = await svedata.svk.prices('SE3', { date: '2026-06-15' });
    expect(result.meta.error).toBe('rate_limited');
    expect(result.meta.rate_limit_remaining).toBe(0);
  });

  it('sätter upstream_error vid 409 valideringsfel', async () => {
    server.use(
      http.get(`${BASE_URL}/datastore_search`, () =>
        HttpResponse.json(
          { success: false, error: { __type: 'Validation Error' } },
          { status: 409 },
        ),
      ),
    );
    expect((await svedata.svk.prices('SE3', { date: '2026-06-15' })).meta.error).toBe(
      'upstream_error',
    );
  });
});
