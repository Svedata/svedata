import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { svedata } from '../../index.js';
import { buildSmhiForecastUrl } from './index.js';
import { findCity } from './cities.js';

const stockholm = findCity('Stockholm')!;
const stockholmUrl = buildSmhiForecastUrl(stockholm.latitude, stockholm.longitude);

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('svedata.smhi.current', () => {
  it('returnerar väderdata vid 200 (SNOW1gv1-format med 9999-sentinel → null)', async () => {
    server.use(
      http.get(stockholmUrl, () =>
        HttpResponse.json({
          createdTime: '2026-05-13T09:00:00Z',
          referenceTime: '2026-05-13T08:45:00Z',
          geometry: {
            type: 'Point',
            coordinates: [stockholm.longitude, stockholm.latitude],
          },
          timeSeries: [
            {
              time: '2026-05-13T10:00:00Z',
              data: {
                air_temperature: 12.5,
                wind_speed: 3.2,
                wind_from_direction: 180,
                relative_humidity: 65,
                air_pressure_at_mean_sea_level: 1013.2,
                symbol_code: 3,
                predominant_precipitation_type_at_surface: 9999,
                precipitation_amount_mean: 0.5,
              },
            },
          ],
        }),
      ),
    );

    const result = await svedata.smhi.current('Stockholm');

    expect(result.data).not.toBeNull();
    expect(result.data?.location).toBe('Stockholm');
    expect(result.data?.air_temperature).toBe(12.5);
    expect(result.data?.wind_speed).toBe(3.2);
    expect(result.data?.relative_humidity).toBe(65);
    expect(result.data?.symbol_code).toBe(3);
    expect(result.data?.predominant_precipitation_type_at_surface).toBeNull();
    expect(result.data?.precipitation_amount_mean).toBe(0.5);
    expect(result.meta.source).toBe('smhi');
    expect(result.meta.cached).toBe(false);
    expect(typeof result.meta.fetched_at).toBe('string');
  });

  it('returnerar { data: null, meta.error = "not_found" } vid 404', async () => {
    server.use(http.get(stockholmUrl, () => new HttpResponse(null, { status: 404 })));

    const result = await svedata.smhi.current('Stockholm');

    expect(result.data).toBeNull();
    expect(result.meta.error).toBe('not_found');
  });

  it('hanterar 429 rate limit med rate_limit_remaining = 0 och meta.error = "rate_limited"', async () => {
    server.use(http.get(stockholmUrl, () => new HttpResponse(null, { status: 429 })));

    const result = await svedata.smhi.current('Stockholm');

    expect(result.data).toBeNull();
    expect(result.meta.rate_limit_remaining).toBe(0);
    expect(result.meta.error).toBe('rate_limited');
  });

  it('sätter meta.error = "not_found" för okänd stad utan nätverksanrop', async () => {
    // No MSW handler registered — would error on unhandledRequest if hit.
    const result = await svedata.smhi.current('Trelleborg');
    expect(result.data).toBeNull();
    expect(result.meta.error).toBe('not_found');
  });

  it('accepterar koordinater istället för stadsnamn', async () => {
    const coordsUrl = stockholmUrl; // same lat/lon as Stockholm
    server.use(
      http.get(coordsUrl, () =>
        HttpResponse.json({
          createdTime: '2026-05-18T09:00:00Z',
          referenceTime: '2026-05-18T08:45:00Z',
          geometry: { type: 'Point', coordinates: [stockholm.longitude, stockholm.latitude] },
          timeSeries: [
            {
              time: '2026-05-18T10:00:00Z',
              data: { air_temperature: 17.5, wind_speed: 4.0 },
            },
          ],
        }),
      ),
    );

    const result = await svedata.smhi.current({
      latitude: stockholm.latitude,
      longitude: stockholm.longitude,
    });

    expect(result.data?.air_temperature).toBe(17.5);
    expect(result.data?.latitude).toBe(stockholm.latitude);
    expect(result.data?.location).toContain('59.3293');
  });

  it('exposes forecast() as alias of current()', async () => {
    server.use(
      http.get(stockholmUrl, () =>
        HttpResponse.json({
          createdTime: '2026-05-18T09:00:00Z',
          referenceTime: '2026-05-18T08:45:00Z',
          geometry: { type: 'Point', coordinates: [stockholm.longitude, stockholm.latitude] },
          timeSeries: [{ time: '2026-05-18T10:00:00Z', data: { air_temperature: 17 } }],
        }),
      ),
    );

    const result = await svedata.smhi.forecast('Stockholm');
    expect(result.data?.air_temperature).toBe(17);
  });
});
