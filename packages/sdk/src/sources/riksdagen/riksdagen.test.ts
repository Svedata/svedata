import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { svedata } from '../../index.js';
import { BASE_URL } from './index.js';

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('svedata.riksdagen.documents', () => {
  it('mappar dokumentlistan med strängar-till-tal och protokoll-relativa URL:er', async () => {
    server.use(
      http.get(`${BASE_URL}/dokumentlista/`, () =>
        HttpResponse.json({
          dokumentlista: {
            '@traffar': '22171',
            '@sida': '1',
            dokument: [
              {
                id: 'hd024162',
                dok_id: 'HD024162',
                doktyp: 'mot',
                titel: 'med anledning av skr. 2025/26:259',
                undertitel: 'av Aylin Nouri m.fl. (S)',
                datum: '2026-05-13',
                publicerad: '2026-05-13',
                rm: '2025/26',
                organ: 'TU',
                dokument_url_html: '//data.riksdagen.se/dokument/HD024162.html',
                dokument_url_text: '//data.riksdagen.se/dokument/HD024162.text',
              },
            ],
          },
        }),
      ),
    );

    const result = await svedata.riksdagen.documents({ query: 'klimat', type: 'mot' });

    expect(result.data?.total).toBe(22171);
    expect(result.data?.page).toBe(1);
    expect(result.data?.documents).toHaveLength(1);
    expect(result.data?.documents[0]?.doc_id).toBe('HD024162');
    expect(result.data?.documents[0]?.url_html).toBe(
      'https://data.riksdagen.se/dokument/HD024162.html',
    );
    expect(result.meta.source).toBe('riksdagen');
  });

  it('hanterar single-object respons (när bara ett dokument matchar)', async () => {
    server.use(
      http.get(`${BASE_URL}/dokumentlista/`, () =>
        HttpResponse.json({
          dokumentlista: {
            '@traffar': '1',
            '@sida': '1',
            dokument: {
              id: 'solo',
              dok_id: 'SOLO',
              doktyp: 'prop',
              titel: 'En proposition',
              datum: '2026-01-01',
              publicerad: '2026-01-01',
              rm: '2025/26',
              organ: 'KU',
            },
          },
        }),
      ),
    );

    const result = await svedata.riksdagen.documents({ query: 'x' });
    expect(result.data?.documents).toHaveLength(1);
    expect(result.data?.documents[0]?.doc_id).toBe('SOLO');
  });

  it('hanterar 0 träffar (dokument saknas)', async () => {
    server.use(
      http.get(`${BASE_URL}/dokumentlista/`, () =>
        HttpResponse.json({
          dokumentlista: { '@traffar': '0', '@sida': '1' },
        }),
      ),
    );

    const result = await svedata.riksdagen.documents({ query: 'asdfqwer' });
    expect(result.data?.total).toBe(0);
    expect(result.data?.documents).toEqual([]);
  });

  it('returnerar { data: null } vid 404', async () => {
    server.use(
      http.get(`${BASE_URL}/dokumentlista/`, () => new HttpResponse(null, { status: 404 })),
    );
    const result = await svedata.riksdagen.documents();
    expect(result.data).toBeNull();
  });

  it('hanterar 429 med rate_limit_remaining = 0', async () => {
    server.use(
      http.get(`${BASE_URL}/dokumentlista/`, () => new HttpResponse(null, { status: 429 })),
    );
    const result = await svedata.riksdagen.documents();
    expect(result.data).toBeNull();
    expect(result.meta.rate_limit_remaining).toBe(0);
  });
});

describe('svedata.riksdagen.members', () => {
  it('mappar personlistan med fodd_ar som tal', async () => {
    server.use(
      http.get(`${BASE_URL}/personlista/`, () =>
        HttpResponse.json({
          personlista: {
            '@hits': '2',
            person: [
              {
                intressent_id: '0838085832923',
                tilltalsnamn: 'Ann-Sofie',
                efternamn: 'Lifvenhage',
                sorteringsnamn: 'Lifvenhage,Ann-Sofie',
                parti: 'M',
                valkrets: 'Södermanlands län',
                status: 'Tjänstgörande riksdagsledamot',
                kon: 'kvinna',
                fodd_ar: '1976',
                bild_url_192:
                  'https://data.riksdagen.se/filarkiv/bilder/ledamot/abc_192.jpg',
              },
              {
                intressent_id: '0123456789012',
                tilltalsnamn: 'Per',
                efternamn: 'Andersson',
                sorteringsnamn: 'Andersson,Per',
                parti: 'S',
                valkrets: 'Stockholms län',
                status: 'Tjänstgörande riksdagsledamot',
                kon: 'man',
                fodd_ar: '1965',
              },
            ],
          },
        }),
      ),
    );

    const result = await svedata.riksdagen.members({ party: 'M' });

    expect(result.data?.total).toBe(2);
    expect(result.data?.members).toHaveLength(2);
    expect(result.data?.members[0]?.born_year).toBe(1976);
    expect(result.data?.members[0]?.image_url).toContain('https://');
    expect(result.data?.members[1]?.image_url).toBeNull();
  });

  it('hanterar single-object respons', async () => {
    server.use(
      http.get(`${BASE_URL}/personlista/`, () =>
        HttpResponse.json({
          personlista: {
            '@hits': '1',
            person: {
              intressent_id: 'solo',
              tilltalsnamn: 'Solo',
              efternamn: 'Person',
              sorteringsnamn: 'Person,Solo',
              parti: 'C',
              valkrets: 'Skåne',
              status: 'X',
              kon: 'annat',
              fodd_ar: '1990',
            },
          },
        }),
      ),
    );

    const result = await svedata.riksdagen.members();
    expect(result.data?.members).toHaveLength(1);
    expect(result.data?.members[0]?.party).toBe('C');
  });

  it('hanterar 429 med rate_limit_remaining = 0', async () => {
    server.use(
      http.get(`${BASE_URL}/personlista/`, () => new HttpResponse(null, { status: 429 })),
    );
    const result = await svedata.riksdagen.members();
    expect(result.data).toBeNull();
    expect(result.meta.rate_limit_remaining).toBe(0);
  });
});
