import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { svedata } from '../../index.js';
import { BASE_URL } from './index.js';

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const water = (id: string, municipalityId: number, advice: unknown[] = []) => ({
  abnormalSituations: [],
  adviceAgainstBathing: advice,
  bathingWater: {
    id,
    name: 'Mossbylund',
    description: 'Sandstrand.  ',
    euType: true,
    waterTypeIdText: 'Hav',
    municipality: {
      id: municipalityId,
      name: 'Skurup',
      contactInfo: { email: 'kansli@skurup.se', phone: '0411-536000' },
    },
    samplingPointPosition: { latitude: '55.413288992130504', longitude: '13.625274381664624' },
  },
});

describe('svedata.hav.bathingWaters', () => {
  it('mappar badplatser, parsar koordinater och filtrerar kommun i SDK:n', async () => {
    server.use(
      http.get(`${BASE_URL}/bathing-waters`, ({ request }) => {
        expect(request.headers.get('User-Agent')).toContain('svedata');
        return HttpResponse.json({
          watersAndAdvisories: [water('SE1', 1264), water('SE2', 114), water('SE3', 1264)],
        });
      }),
    );
    const result = await svedata.hav.bathingWaters({ municipality: '1264', limit: 1 });
    expect(result.meta.source).toBe('hav');
    expect(result.data?.total).toBe(2);
    expect(result.data?.bathing_waters).toEqual([
      {
        id: 'SE1',
        name: 'Mossbylund',
        description: 'Sandstrand.',
        municipality: 'Skurup',
        municipality_code: '1264',
        water_type: 'Hav',
        eu_bathing_water: true,
        latitude: 55.413288992130504,
        longitude: 13.625274381664624,
        advice_against_bathing: [],
        abnormal_situations: [],
      },
    ]);
    expect(JSON.stringify(result.data)).not.toContain('kansli@skurup.se');
  });

  it('nollpaddar kommunkoder (114 → 0114)', async () => {
    server.use(
      http.get(`${BASE_URL}/bathing-waters`, () =>
        HttpResponse.json({ watersAndAdvisories: [water('SE2', 114)] }),
      ),
    );
    const result = await svedata.hav.bathingWaters({ municipality: 114 });
    expect(result.data?.bathing_waters[0]?.municipality_code).toBe('0114');
  });

  it('skickar avrådan-filtret och mappar avrådan', async () => {
    server.use(
      http.get(`${BASE_URL}/bathing-waters`, ({ request }) => {
        expect(new URL(request.url).searchParams.get('filter')).toBe(
          "(hasAdviceAgainstBathing eq 'true')",
        );
        return HttpResponse.json({
          watersAndAdvisories: [
            water('SE1', 1264, [
              {
                startsAt: '2026-06-18T09:25:24Z',
                typeId: 2,
                typeIdText: 'Avrådan hel badsäsong',
                description: 'Dålig kvalitet. ',
              },
            ]),
          ],
        });
      }),
    );
    const result = await svedata.hav.bathingWaters({ adviceAgainstBathing: true });
    expect(result.data?.bathing_waters[0]?.advice_against_bathing).toEqual([
      {
        starts_at: '2026-06-18T09:25:24Z',
        reason: 'Avrådan hel badsäsong',
        description: 'Dålig kvalitet.',
      },
    ]);
  });

  it('ger upstream_error för oväntad body och vid 500', async () => {
    server.use(http.get(`${BASE_URL}/bathing-waters`, () => HttpResponse.json({ nope: true })));
    expect((await svedata.hav.bathingWaters()).meta.error).toBe('upstream_error');
    server.use(
      http.get(`${BASE_URL}/bathing-waters`, () => new HttpResponse(null, { status: 500 })),
    );
    expect((await svedata.hav.bathingWaters()).meta.error).toBe('upstream_error');
  });
});

describe('svedata.hav.lookup', () => {
  it('hämtar en badplats på id', async () => {
    server.use(
      http.get(`${BASE_URL}/bathing-waters/SE1`, () => HttpResponse.json(water('SE1', 1264))),
    );
    expect((await svedata.hav.lookup('SE1')).data?.name).toBe('Mossbylund');
  });

  it('sätter not_found vid 404', async () => {
    server.use(
      http.get(`${BASE_URL}/bathing-waters/SE0`, () =>
        HttpResponse.json(
          { code: 404001, detail: 'Requested bathing water id could not be found' },
          { status: 404 },
        ),
      ),
    );
    const result = await svedata.hav.lookup('SE0');
    expect(result.data).toBeNull();
    expect(result.meta.error).toBe('not_found');
  });

  it('sätter rate_limited vid 429', async () => {
    server.use(
      http.get(`${BASE_URL}/bathing-waters/SE1`, () => new HttpResponse(null, { status: 429 })),
    );
    const result = await svedata.hav.lookup('SE1');
    expect(result.meta.error).toBe('rate_limited');
    expect(result.meta.rate_limit_remaining).toBe(0);
  });
});

describe('svedata.hav.results', () => {
  it('mappar provresultat, nyast först', async () => {
    const sample = (takenAt: string) => ({
      algalIdText: 'Ingen blomning',
      escherichiaColiAssessIdText: 'Tjänligt',
      escherichiaColiCount: 10,
      escherichiaColiPrefix: '<',
      intestinalEnterococciAssessIdText: 'Tjänligt',
      intestinalEnterococciCount: 20,
      intestinalEnterococciPrefix: '=',
      sampleAssessIdText: 'Tjänligt',
      takenAt,
      waterTemp: '17.5',
      weatherIdText: 'Mulet',
    });
    server.use(
      http.get(`${BASE_URL}/bathing-waters/SE1/results`, () =>
        HttpResponse.json({
          results: [sample('2026-06-01T08:00:00Z'), sample('2026-08-04T22:00:00Z')],
        }),
      ),
    );
    const result = await svedata.hav.results('SE1');
    expect(result.data?.results.map((r) => r.taken_at)).toEqual([
      '2026-08-04T22:00:00Z',
      '2026-06-01T08:00:00Z',
    ]);
    expect(result.data?.results[0]).toEqual({
      taken_at: '2026-08-04T22:00:00Z',
      assessment: 'Tjänligt',
      e_coli: { count: 10, prefix: '<', assessment: 'Tjänligt' },
      intestinal_enterococci: { count: 20, prefix: '=', assessment: 'Tjänligt' },
      algae: 'Ingen blomning',
      water_temp: 17.5,
      weather: 'Mulet',
    });
  });
});

describe('svedata.hav.forecasts', () => {
  it('skickar municId utan nollpaddning och parsar timme/temperatur', async () => {
    server.use(
      http.get(`${BASE_URL}/forecasts`, ({ request }) => {
        expect(new URL(request.url).searchParams.get('municId')).toBe('114');
        return HttpResponse.json({
          forecasts: [
            {
              bathingWaterId: 'SE1',
              waterForecasts: [
                { measHour: '16', waterTemp: '7.8' },
                { measHour: 'x', waterTemp: '7.7' },
              ],
            },
          ],
        });
      }),
    );
    const result = await svedata.hav.forecasts({ municipality: '0114' });
    expect(result.data?.forecasts).toEqual([
      { bathing_water_id: 'SE1', points: [{ hour: 16, water_temp: 7.8 }] },
    ]);
  });
});
