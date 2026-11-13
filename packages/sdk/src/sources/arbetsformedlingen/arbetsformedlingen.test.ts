import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { svedata } from '../../index.js';
import { BASE_URL } from './index.js';

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const sampleAd = (id: string) => ({
  relevance: 1.0,
  id,
  webpage_url: `https://arbetsformedlingen.se/platsbanken/annonser/${id}`,
  headline: 'Junior .NET utvecklare',
  application_deadline: '2027-04-24T23:59:59',
  number_of_vacancies: 1,
  description: { text: 'Är du i början av din utvecklarkarriär?' },
  employment_type: { concept_id: 'PFZr_Syz_cUq', label: 'Vanlig anställning' },
  working_hours_type: { concept_id: '6YE1_gAC_R2G', label: 'Heltid' },
  employer: {
    phone_number: '0701234567',
    email: 'rekryterare@example.se',
    url: null,
    organization_number: '5565493268',
    name: 'CANEA Partner Group Aktiebolag',
    workplace: 'CANEA',
  },
  occupation: { concept_id: 'fg7B_yov_smw', label: 'Systemutvecklare/Programmerare' },
  occupation_group: { concept_id: 'DJh5_yyF_hEM', label: 'Mjukvaru- och systemutvecklare m.fl.' },
  occupation_field: { concept_id: 'apaJ_2ja_LuF', label: 'Data/IT' },
  workplace_address: {
    municipality: 'Göteborg',
    municipality_code: '1480',
    region: 'Västra Götalands län',
    region_code: '14',
    coordinates: [11.9667, 57.7089],
  },
  application_contacts: [
    { name: 'Anna Andersson', email: 'anna@example.se', telephone: '0701234567' },
  ],
  publication_date: '2026-10-26T09:30:46',
});

describe('svedata.arbetsformedlingen.search', () => {
  it('skickar filter som query-parametrar och mappar annonser', async () => {
    server.use(
      http.get(`${BASE_URL}/search`, ({ request }) => {
        const p = new URL(request.url).searchParams;
        expect(p.get('q')).toBe('utvecklare');
        expect(p.getAll('municipality')).toEqual(['1480', '1281']);
        expect(p.get('region')).toBe('14');
        expect(p.get('published-after')).toBe('1440');
        expect(p.get('limit')).toBe('5');
        expect(p.get('offset')).toBe('10');
        expect(request.headers.get('User-Agent')).toContain('svedata');
        return HttpResponse.json({ total: { value: 127 }, hits: [sampleAd('31642824')] });
      }),
    );

    const result = await svedata.arbetsformedlingen.search({
      query: 'utvecklare',
      municipality: ['1480', '1281'],
      region: '14',
      publishedWithinMinutes: 1440,
      limit: 5,
      offset: 10,
    });

    expect(result.meta.source).toBe('arbetsformedlingen');
    expect(result.data?.total).toBe(127);
    expect(result.data?.offset).toBe(10);
    const job = result.data?.jobs[0];
    expect(job).toMatchObject({
      id: '31642824',
      headline: 'Junior .NET utvecklare',
      employer_name: 'CANEA Partner Group Aktiebolag',
      workplace: 'CANEA',
      occupation: 'Systemutvecklare/Programmerare',
      occupation_field: 'Data/IT',
      employment_type: 'Vanlig anställning',
      working_hours: 'Heltid',
      vacancies: 1,
      municipality: 'Göteborg',
      municipality_code: '1480',
      region_code: '14',
      published: '2026-10-26T09:30:46',
      application_deadline: '2027-04-24T23:59:59',
    });
  });

  it('vänder GeoJSON [lon, lat] till latitude/longitude', async () => {
    server.use(
      http.get(`${BASE_URL}/search`, () =>
        HttpResponse.json({ total: { value: 1 }, hits: [sampleAd('1')] }),
      ),
    );
    const job = (await svedata.arbetsformedlingen.search()).data?.jobs[0];
    expect(job?.latitude).toBeCloseTo(57.7089);
    expect(job?.longitude).toBeCloseTo(11.9667);
  });

  it('returnerar inga kontaktpersoner, telefonnummer eller organisationsnummer', async () => {
    server.use(
      http.get(`${BASE_URL}/search`, () =>
        HttpResponse.json({ total: { value: 1 }, hits: [sampleAd('1')] }),
      ),
    );
    const job = (await svedata.arbetsformedlingen.search()).data?.jobs[0];
    const serialized = JSON.stringify(job);
    expect(serialized).not.toContain('Anna Andersson');
    expect(serialized).not.toContain('0701234567');
    expect(serialized).not.toContain('5565493268');
    expect(serialized).not.toContain('@example.se');
  });

  it('klämmer limit till 1–100 (API:t svarar 400 över 100)', async () => {
    const seen: string[] = [];
    server.use(
      http.get(`${BASE_URL}/search`, ({ request }) => {
        seen.push(new URL(request.url).searchParams.get('limit')!);
        return HttpResponse.json({ total: { value: 0 }, hits: [] });
      }),
    );
    await svedata.arbetsformedlingen.search({ limit: 500 });
    await svedata.arbetsformedlingen.search({ limit: 0 });
    await svedata.arbetsformedlingen.search();
    expect(seen).toEqual(['100', '1', '20']);
  });

  it('hanterar saknade valfria fält som null', async () => {
    server.use(
      http.get(`${BASE_URL}/search`, () =>
        HttpResponse.json({
          total: { value: 1 },
          hits: [{ id: '9', headline: 'Lagerarbetare', publication_date: '2026-11-01T08:00:00' }],
        }),
      ),
    );
    const job = (await svedata.arbetsformedlingen.search()).data?.jobs[0];
    expect(job?.url).toBe('https://arbetsformedlingen.se/platsbanken/annonser/9');
    expect(job?.latitude).toBeNull();
    expect(job?.occupation).toBeNull();
    expect(job?.application_deadline).toBeNull();
    expect(job?.description).toBe('');
  });

  it('sätter meta.error = "rate_limited" med rate_limit_remaining = 0', async () => {
    server.use(http.get(`${BASE_URL}/search`, () => new HttpResponse(null, { status: 429 })));
    const result = await svedata.arbetsformedlingen.search({ query: 'x' });
    expect(result.data).toBeNull();
    expect(result.meta.rate_limit_remaining).toBe(0);
    expect(result.meta.error).toBe('rate_limited');
  });

  it('sätter meta.error = "upstream_error" vid 400/500 och oväntad body', async () => {
    server.use(http.get(`${BASE_URL}/search`, () => new HttpResponse(null, { status: 500 })));
    const a = await svedata.arbetsformedlingen.search();
    expect(a.data).toBeNull();
    expect(a.meta.error).toBe('upstream_error');

    server.use(http.get(`${BASE_URL}/search`, () => HttpResponse.json({ nope: true })));
    const b = await svedata.arbetsformedlingen.search();
    expect(b.data).toBeNull();
    expect(b.meta.error).toBe('upstream_error');
  });
});

describe('svedata.arbetsformedlingen.lookup', () => {
  it('hämtar en annons på id', async () => {
    server.use(http.get(`${BASE_URL}/ad/31642824`, () => HttpResponse.json(sampleAd('31642824'))));
    const result = await svedata.arbetsformedlingen.lookup('31642824');
    expect(result.data?.headline).toBe('Junior .NET utvecklare');
  });

  it('sätter meta.error = "not_found" vid 404', async () => {
    server.use(
      http.get(`${BASE_URL}/ad/1`, () =>
        HttpResponse.json({ message: 'Ad not found.', status: 404 }, { status: 404 }),
      ),
    );
    const result = await svedata.arbetsformedlingen.lookup('1');
    expect(result.data).toBeNull();
    expect(result.meta.error).toBe('not_found');
  });
});
