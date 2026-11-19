import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { svedata } from '../../index.js';
import { BASE_URL } from './index.js';

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const page = { pageNumber: 2, size: 1, totalElements: 1902, totalPages: 1902 };
const s = (value: string) => ({
  strings: [
    { lang: 'eng', value: `${value} (en)` },
    { lang: 'swe', value },
  ],
});
const education = {
  id: 'i.myh.yh.8917',
  status: 'ACTIVE',
  content: {
    code: 'YH00978-2023',
    type: { code: 'YH', type: 'C_SchoolType' },
    title: s('Trafiklärare'),
    description: s('Utbildning till trafiklärare.'),
    educationLevels: [{ code: 'ISCED_5', type: 'C_EducationLevel' }],
    url: { urls: [{ lang: 'swe', value: 'https://example.se/trafiklarare' }] },
    lastEdited: '2026-03-03T08:24:10',
  },
};

describe('svedata.skolverket.educations', () => {
  it('skickar paginering och skolformer, väljer svensk text', async () => {
    server.use(
      http.get(`${BASE_URL}/educationInfos`, ({ request }) => {
        const p = new URL(request.url).searchParams;
        expect(p.getAll('schoolType')).toEqual(['YH', 'HS']);
        expect(p.get('page')).toBe('2');
        expect(p.get('size')).toBe('1');
        expect(p.get('updatedSince')).toBe('2026-11-01');
        expect(request.headers.get('User-Agent')).toContain('svedata');
        return HttpResponse.json({ links: [], educationInfos: [education], page });
      }),
    );
    const result = await svedata.skolverket.educations({
      schoolType: ['YH', 'HS'],
      page: 2,
      pageSize: 1,
      updatedSince: '2026-11-01',
    });
    expect(result.meta.source).toBe('skolverket');
    expect(result.data).toEqual({
      page: 2,
      page_size: 1,
      total: 1902,
      educations: [
        {
          id: 'i.myh.yh.8917',
          code: 'YH00978-2023',
          title: 'Trafiklärare',
          description: 'Utbildning till trafiklärare.',
          school_type: 'YH',
          education_levels: ['ISCED_5'],
          url: 'https://example.se/trafiklarare',
          status: 'ACTIVE',
          last_edited: '2026-03-03T08:24:10',
        },
      ],
    });
  });

  it('klämmer pageSize till 1–2000', async () => {
    const seen: string[] = [];
    server.use(
      http.get(`${BASE_URL}/educationInfos`, ({ request }) => {
        seen.push(new URL(request.url).searchParams.get('size')!);
        return HttpResponse.json({ educationInfos: [], page: { totalElements: 0 } });
      }),
    );
    await svedata.skolverket.educations({ pageSize: 5000 });
    await svedata.skolverket.educations({ pageSize: 0 });
    expect(seen).toEqual(['2000', '1']);
  });

  it('ger upstream_error för oväntad body', async () => {
    server.use(http.get(`${BASE_URL}/educationInfos`, () => HttpResponse.json({ nope: true })));
    expect((await svedata.skolverket.educations()).meta.error).toBe('upstream_error');
  });
});

describe('svedata.skolverket.events', () => {
  it('mappar utbildningstillfällen med kommunkod och sista ansökningsdag', async () => {
    server.use(
      http.get(`${BASE_URL}/educationEvents`, ({ request }) => {
        expect(new URL(request.url).searchParams.get('providerId')).toBe('p.myh.2462');
        return HttpResponse.json({
          educationEvents: [
            {
              id: 'e.myh.yh.24481',
              status: 'ACTIVE',
              content: {
                education: 'i.myh.yh.8917',
                providers: ['p.myh.2462'],
                execution: { start: '2027-01-18', end: '2028-03-24' },
                application: { last: '2026-09-10' },
                places: 24,
                paceOfStudy: { percentage: 100 },
                locations: [{ town: 'Helsingborg', country: 'SE', areaCode: '1283' }],
                languageOfInstructions: ['swe'],
                lastEdited: '2026-03-03T08:24:10',
              },
            },
          ],
          page,
        });
      }),
    );
    const event = (await svedata.skolverket.events({ providerId: 'p.myh.2462' })).data?.events[0];
    expect(event).toMatchObject({
      id: 'e.myh.yh.24481',
      education_id: 'i.myh.yh.8917',
      start: '2027-01-18',
      end: '2028-03-24',
      application_deadline: '2026-09-10',
      places: 24,
      pace_percent: 100,
      locations: [{ town: 'Helsingborg', municipality_code: '1283' }],
    });
  });
});

describe('svedata.skolverket.providers', () => {
  it('returnerar namn, ort och huvudmannatyp men inga telefonnummer', async () => {
    server.use(
      http.get(`${BASE_URL}/educationProviders`, () =>
        HttpResponse.json({
          educationProviders: [
            {
              id: 'p.AF.1',
              status: 'ACTIVE',
              content: {
                name: s('Arbetsförmedlingen'),
                phones: [{ number: s('0771-416 416') }],
                visitAddresses: [{ town: 'Solna' }],
                responsibleBody: { type: { code: 'statlig' } },
              },
            },
          ],
          page,
        }),
      ),
    );
    const provider = (await svedata.skolverket.providers()).data?.providers[0];
    expect(provider).toMatchObject({
      id: 'p.AF.1',
      name: 'Arbetsförmedlingen',
      town: 'Solna',
      responsible_body: 'statlig',
    });
    expect(JSON.stringify(provider)).not.toContain('0771');
  });
});

describe('svedata.skolverket.education', () => {
  it('hämtar en utbildning på id', async () => {
    server.use(
      http.get(`${BASE_URL}/educationInfos/i.myh.yh.8917`, () => HttpResponse.json(education)),
    );
    expect((await svedata.skolverket.education('i.myh.yh.8917')).data?.title).toBe('Trafiklärare');
  });

  it('sätter not_found vid 404', async () => {
    server.use(
      http.get(`${BASE_URL}/educationInfos/i.nope`, () =>
        HttpResponse.json({ status: 404, type: 'Not Found' }, { status: 404 }),
      ),
    );
    const result = await svedata.skolverket.education('i.nope');
    expect(result.data).toBeNull();
    expect(result.meta.error).toBe('not_found');
  });

  it('sätter rate_limited vid 429', async () => {
    server.use(
      http.get(`${BASE_URL}/educationInfos/x`, () => new HttpResponse(null, { status: 429 })),
    );
    const result = await svedata.skolverket.education('x');
    expect(result.meta.error).toBe('rate_limited');
    expect(result.meta.rate_limit_remaining).toBe(0);
  });
});
