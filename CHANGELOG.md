# Changelog

## Unreleased

### Added

- **Polisen source.** `svedata.polisen.events(options?)` returns the police's
  recent event announcements (up to ~500) with filters on `location` and `type`.
  No API key required. Datetime normalized to ISO 8601; GPS string split into
  `latitude` and `longitude` (WGS84); relative URLs upgraded to absolute HTTPS.
- **Trafikverket source.** First source requiring an API key.
  `svedata.trafikverket.trains(options?)` and `svedata.trafikverket.situations(options?)`.
  Configure via `svedata.trafikverket.configure({ apiKey })` or
  `TRAFIKVERKET_API_KEY` env variable. Throws on missing-key, 401, 403, and
  structured API errors. Backed by XML POST against
  `api.trafikinfo.trafikverket.se/v2/data.json`, mapped to snake_case JSON.
- **Nord Pool source.** `svedata.nordpool.prices(area, options?)` returns Swedish
  day-ahead spot prices for SE1–SE4 in 15-minute intervals (96 points per day since
  October 2025). Defaults to today in Europe/Stockholm. Backed by the free open
  feed at `elprisetjustnu.se` since Nord Pool's official API is commercial.
- **Riksdagen source.** `svedata.riksdagen.documents(options?)` searches motioner,
  propositioner, betänkanden, etc. by query/type/year. `svedata.riksdagen.members(options?)`
  lists members of parliament filterable by party or constituency. Backed by
  `data.riksdagen.se`, no API key. Numeric-string fields normalized to `number`;
  protocol-relative URLs upgraded to absolute HTTPS; single-object responses
  normalized to arrays.
- **SCB source.** `svedata.scb.search(query, options?)`,
  `svedata.scb.table(tableId, options?)`, and `svedata.scb.data(tableId, options?)`.
  Backed by PxWebAPI 2.0 at `statistikdatabasen.scb.se/api/v2/`. No API key
  required. Supports `lang: 'en' | 'sv'`. Data returned as JSON-Stat 2.0 in the
  `jsonstat` field.
- **Riksbanken source.** `svedata.riksbanken.exchange()` (current EUR/USD/GBP/NOK/DKK
  rates against SEK), `svedata.riksbanken.policy()` (current styrränta and date of
  last change), and `svedata.riksbanken.history(pair, from, to)` (historical
  exchange rates for a currency pair). Backed by the public REST API at
  `api.riksbank.se/swea/v1/`, no API key required. 429 responses are treated as
  empty envelopes with `rate_limit_remaining: 0`.

### Changed

- **SMHI: migrerad från PMP3gv2 till SNOW1gv1.** SMHI deprecerade PMP3gv2 den
  31 mars 2026. `svedata.smhi.current(city)` anropar nu
  `category/snow1g/version/1` istället för `category/pmp3g/version/2`.
  - Responsstrukturen har platt `timeSeries[].data.{key}` (tidigare
    `timeSeries[].parameters[]`).
  - Tidsfältet heter `time` (tidigare `validTime`).
  - `geometry.coordinates` är platt `[lon, lat]` (tidigare `[[lon, lat]]`).
  - Sentinel-värdet `9999` tolkas som `null` i `SmhiCurrentWeather`.
  - `SmhiCurrentWeather`-typen använder nu SMHI:s officiella fältnamn
    (`air_temperature`, `wind_from_direction`, `relative_humidity`,
    `air_pressure_at_mean_sea_level`, `symbol_code`,
    `predominant_precipitation_type_at_surface`, `precipitation_amount_mean`).
  - Numeriska väderfält är nu `number | null` för att rymma saknade värden.

API:t `svedata.smhi.current(city)` är oförändrat — envelope, citymap och
felhantering (404 → `data: null`, 429 → `rate_limit_remaining: 0`) fungerar
som tidigare.
