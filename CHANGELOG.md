# Changelog

## Unreleased

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
