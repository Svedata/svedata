import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { svedata } from '../../index.js';
import { BASE_URL } from './index.js';

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const page = <T>(values: T[], next_url: string | null = null) => ({
  values,
  next_url,
  previous_url: null,
  count: values.length,
});

const sampleKpi = (id: string) => ({
  id,
  title: 'Invånare totalt, antal',
  description: 'Antal invånare totalt den 31/12. Källa: SCB.',
  is_divided_by_gender: true,
  municipality_type: 'A',
  auspice: 'X',
  operating_area: 'Befolkning',
  perspective: 'Volymer',
  prel_publication_date: null,
  publication_date: '2027-02-24',
  publ_period: '2026',
  has_ou_data: false,
  search_score: null,
});

const row = (municipality: string, period: number, total: number | null) => ({
  kpi: 'N01951',
  period,
  municipality,
  values: [
    { gender: 'K', count: 1, status: '', value: 66091, isdeleted: false },
    { gender: 'M', count: 1, status: '', value: 64197, isdeleted: false },
    {
      gender: 'T',
      count: 1,
      status: total === null ? 'Missing' : '',
      value: total,
      isdeleted: false,
    },
  ],
});

describe('svedata.kolada.kpis', () => {
  it('söker nyckeltal på titel och mappar fälten', async () => {
    server.use(
      http.get(`${BASE_URL}/kpi`, ({ request }) => {
        expect(new URL(request.url).searchParams.get('title')).toBe('invånare');
        return HttpResponse.json(page([sampleKpi('N01951'), sampleKpi('N01952')]));
      }),
    );

    const result = await svedata.kolada.kpis('invånare', { limit: 1 });
    expect(result.meta.source).toBe('kolada');
    expect(result.data?.total).toBe(2);
    expect(result.data?.kpis).toHaveLength(1);
    expect(result.data?.kpis[0]).toEqual({
      id: 'N01951',
      title: 'Invånare totalt, antal',
      description: 'Antal invånare totalt den 31/12. Källa: SCB.',
      operating_area: 'Befolkning',
      is_divided_by_gender: true,
      municipality_type: 'A',
      publication_date: '2027-02-24',
    });
  });

  it('skickar User-Agent-header', async () => {
    server.use(
      http.get(`${BASE_URL}/kpi`, ({ request }) => {
        expect(request.headers.get('User-Agent')).toContain('svedata');
        return HttpResponse.json(page([]));
      }),
    );
    const result = await svedata.kolada.kpis('x');
    expect(result.data).toEqual({ query: 'x', total: 0, kpis: [] });
  });
});

describe('svedata.kolada.municipalities', () => {
  it('mappar typ K/L till municipality/region', async () => {
    server.use(
      http.get(`${BASE_URL}/municipality`, () =>
        HttpResponse.json(
          page([
            { id: '1281', title: 'Lund', type: 'K' },
            { id: '0012', title: 'Region Skåne', type: 'L' },
          ]),
        ),
      ),
    );
    const result = await svedata.kolada.municipalities();
    expect(result.data?.total).toBe(2);
    expect(result.data?.municipalities.map((m) => m.type)).toEqual(['municipality', 'region']);
  });
});

describe('svedata.kolada.data', () => {
  it('bygger sökväg med flera kommuner och år, mappar kön och sorterar', async () => {
    server.use(
      http.get(`${BASE_URL}/data/kpi/N01951/municipality/1281,0180/year/2022,2023`, () =>
        HttpResponse.json(page([row('1281', 2023, 130288), row('0180', 2022, 984748)])),
      ),
    );

    const result = await svedata.kolada.data('N01951', ['1281', '0180'], { years: [2022, 2023] });
    expect(result.data?.kpi).toBe('N01951');
    expect(result.data?.points).toHaveLength(6);
    expect(result.data?.points[0]).toEqual({
      municipality: '0180',
      period: 2022,
      gender: 'female',
      value: 66091,
      status: '',
    });
    const total2023 = result.data?.points.find((p) => p.period === 2023 && p.gender === 'total');
    expect(total2023?.value).toBe(130288);
    expect(result.data?.points.some((p) => p.gender === 'male')).toBe(true);
  });

  it('ger value = null och behåller status när värdet saknas', async () => {
    server.use(
      http.get(`${BASE_URL}/data/kpi/N01951/municipality/1281/year/2023`, () =>
        HttpResponse.json(page([row('1281', 2023, null)])),
      ),
    );
    const result = await svedata.kolada.data('N01951', '1281', { years: 2023 });
    const total = result.data?.points.find((p) => p.gender === 'total');
    expect(total?.value).toBeNull();
    expect(total?.status).toBe('Missing');
  });

  it('följer next_url på Koladas egen domän', async () => {
    let calls = 0;
    server.use(
      http.get(`${BASE_URL}/data/kpi/N01951/municipality/1281`, ({ request }) => {
        calls++;
        const p = new URL(request.url).searchParams.get('page');
        if (p === '2') return HttpResponse.json(page([row('1281', 2024, 2)]));
        return HttpResponse.json(
          page([row('1281', 2023, 1)], `${BASE_URL}/data/kpi/N01951/municipality/1281?page=2`),
        );
      }),
    );
    const result = await svedata.kolada.data('N01951', '1281');
    expect(calls).toBe(2);
    expect(new Set(result.data?.points.map((p) => p.period))).toEqual(new Set([2023, 2024]));
  });

  it('följer inte next_url till en annan domän', async () => {
    server.use(
      http.get(`${BASE_URL}/data/kpi/N01951/municipality/1281`, () =>
        HttpResponse.json(page([row('1281', 2023, 1)], 'https://evil.example/steal')),
      ),
    );
    // onUnhandledRequest: 'error' would fail the test if the SDK followed it.
    const result = await svedata.kolada.data('N01951', '1281');
    expect(result.data?.points).toHaveLength(3);
  });

  it('sätter meta.error = "not_found" när Kolada saknar värden', async () => {
    server.use(
      http.get(`${BASE_URL}/data/kpi/BOGUS/municipality/1281/year/2023`, () =>
        HttpResponse.json(page([])),
      ),
    );
    const result = await svedata.kolada.data('BOGUS', '1281', { years: 2023 });
    expect(result.data).toBeNull();
    expect(result.meta.error).toBe('not_found');
  });

  it('sätter meta.error = "rate_limited" med rate_limit_remaining = 0', async () => {
    server.use(http.get(`${BASE_URL}/kpi`, () => new HttpResponse(null, { status: 429 })));
    const result = await svedata.kolada.kpis('skola');
    expect(result.data).toBeNull();
    expect(result.meta.rate_limit_remaining).toBe(0);
    expect(result.meta.error).toBe('rate_limited');
  });

  it('sätter meta.error = "upstream_error" vid 410 (avvecklad version) och trasig body', async () => {
    server.use(
      http.get(`${BASE_URL}/municipality`, () =>
        HttpResponse.json({ error: 'deprecated' }, { status: 410 }),
      ),
      http.get(`${BASE_URL}/kpi`, () => HttpResponse.json({ unexpected: true })),
    );
    const a = await svedata.kolada.municipalities('lund');
    expect(a.data).toBeNull();
    expect(a.meta.error).toBe('upstream_error');
    const b = await svedata.kolada.kpis('skola');
    expect(b.data).toBeNull();
    expect(b.meta.error).toBe('upstream_error');
  });

  it('sätter meta.error = "not_found" vid 404', async () => {
    server.use(http.get(`${BASE_URL}/kpi`, () => new HttpResponse(null, { status: 404 })));
    const result = await svedata.kolada.kpis('skola');
    expect(result.data).toBeNull();
    expect(result.meta.error).toBe('not_found');
  });
});
