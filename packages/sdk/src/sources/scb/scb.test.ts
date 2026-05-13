import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { svedata } from '../../index.js';
import { BASE_URL } from './index.js';

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const sampleTable = {
  id: 'TAB638',
  label: 'Population by region, year and sex',
  description: '',
  updated: '2025-02-21T07:00:00Z',
  firstPeriod: '1968',
  lastPeriod: '2024',
  variableNames: ['region', 'sex', 'year'],
  source: 'Statistics Sweden',
  subjectCode: 'BE',
  timeUnit: 'Annual',
  paths: [[{ id: 'BE', label: 'Population' }]],
};

describe('svedata.scb.search', () => {
  it('returnerar matchande tabeller med snake_case-fält', async () => {
    server.use(
      http.get(`${BASE_URL}/tables`, ({ request }) => {
        const url = new URL(request.url);
        expect(url.searchParams.get('query')).toBe('befolkning');
        return HttpResponse.json({
          language: 'sv',
          tables: [sampleTable],
          page: { pageNumber: 1, pageSize: 20, totalElements: 1 },
        });
      }),
    );

    const result = await svedata.scb.search('befolkning', { lang: 'sv' });

    expect(result.data?.total).toBe(1);
    expect(result.data?.tables[0]?.id).toBe('TAB638');
    expect(result.data?.tables[0]?.first_period).toBe('1968');
    expect(result.data?.tables[0]?.subject_code).toBe('BE');
    expect(result.meta.source).toBe('scb');
  });

  it('returnerar { data: null } vid 404', async () => {
    server.use(http.get(`${BASE_URL}/tables`, () => new HttpResponse(null, { status: 404 })));

    const result = await svedata.scb.search('whatever');
    expect(result.data).toBeNull();
  });

  it('hanterar 429 med rate_limit_remaining = 0', async () => {
    server.use(http.get(`${BASE_URL}/tables`, () => new HttpResponse(null, { status: 429 })));

    const result = await svedata.scb.search('whatever');
    expect(result.data).toBeNull();
    expect(result.meta.rate_limit_remaining).toBe(0);
  });
});

describe('svedata.scb.table', () => {
  it('returnerar metadata för en tabell inklusive paths', async () => {
    server.use(
      http.get(`${BASE_URL}/tables/TAB638`, () => HttpResponse.json(sampleTable)),
    );

    const result = await svedata.scb.table('TAB638');

    expect(result.data?.id).toBe('TAB638');
    expect(result.data?.paths).toHaveLength(1);
    expect(result.data?.paths[0]?.[0]?.id).toBe('BE');
  });

  it('returnerar { data: null } för okänd tabell (404)', async () => {
    server.use(
      http.get(`${BASE_URL}/tables/UNKNOWN`, () => new HttpResponse(null, { status: 404 })),
    );

    const result = await svedata.scb.table('UNKNOWN');
    expect(result.data).toBeNull();
  });
});

describe('svedata.scb.data', () => {
  it('returnerar JSON-Stat-data inklusive label och updated', async () => {
    server.use(
      http.get(`${BASE_URL}/tables/TAB638/data`, ({ request }) => {
        const url = new URL(request.url);
        expect(url.searchParams.get('outputFormat')).toBe('json-stat2');
        return HttpResponse.json({
          version: '2.0',
          class: 'dataset',
          label: 'Population by region, year and sex',
          source: 'Statistics Sweden',
          updated: '2025-02-21T07:00:00Z',
          value: [100, 200, 300],
        });
      }),
    );

    const result = await svedata.scb.data('TAB638');

    expect(result.data?.table_id).toBe('TAB638');
    expect(result.data?.label).toBe('Population by region, year and sex');
    expect(result.data?.source).toBe('Statistics Sweden');
    expect(result.data?.jsonstat).toMatchObject({ class: 'dataset', value: [100, 200, 300] });
  });

  it('hanterar 429 med rate_limit_remaining = 0', async () => {
    server.use(
      http.get(
        `${BASE_URL}/tables/TAB638/data`,
        () => new HttpResponse(null, { status: 429 }),
      ),
    );

    const result = await svedata.scb.data('TAB638');
    expect(result.data).toBeNull();
    expect(result.meta.rate_limit_remaining).toBe(0);
  });
});
