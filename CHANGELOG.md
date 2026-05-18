# Changelog

## 0.1.2

Two user-experience fixes.

**SCB now defaults to Swedish search.** `svedata.scb.search` (and
`svedata.scb.table` / `svedata.scb.data` for consistency) now default
to `lang: 'sv'` instead of `'en'`. SCB matches the `query` parameter
against table labels in the requested language, so the English default
returned 0 results for obvious Swedish input like `search('befolkning')`.
English queries still work — pass `{ lang: 'en' }` explicitly.

**Riksbanken handles rate limits more gracefully.** When the Riksbank
API returns 429, the SDK now:

- Parses `Retry-After` header or the body's "Try again in N seconds"
  message
- If the wait is ≤ 10 seconds, sleeps and retries once
- If the retry succeeds, the user gets data with no visible error
- If the retry fails (or the wait would be > 10 seconds), returns
  `{ data: null, meta: { rate_limit_remaining: 0, error: 'rate_limited' } }`

A new optional `meta.error` field (`'rate_limited' | 'not_found' |
'upstream_error'`) lets consumers distinguish a rate-limit from
genuinely-missing data. The field is set by Riksbanken's 429 path
in v0.1.2; other sources will adopt it incrementally.

The retry is deliberately conservative — Riksbanken's "try again"
timer resets on every 429, so aggressive retries make the problem
worse. Long waits stay the consumer's responsibility.

### Documentation

- Documented that SCB's `lang` parameter affects search linguistics,
  not just presentation. Different languages return different result
  counts because SCB's metadata coverage varies — e.g.
  `search('befolkning')` (sv) returns ~173 tables, while
  `search('population', { lang: 'en' })` returns ~315. See the
  [SCB source docs](https://docs.svedata.dev/sources/scb#language-and-search-results)
  for guidance on which language to pick.

## 0.1.1

Fix: published tarballs now resolve workspace dependencies to concrete
versions. v0.1.0 was published with `npm publish` directly from each
package directory, which uses `npm pack` internally and does not
rewrite the `workspace:` protocol; the resulting tarballs on the
registry left `"@svedata/types": "workspace:*"` (and the equivalent
for `@svedata/data`) in `dependencies`, breaking install in any
non-workspace environment.

v0.1.1 is published from tarballs produced by `bun pm pack`, which
does rewrite `workspace:` to the concrete version at pack time. A
CI guard (`publish-check.yml`) now greps every packed tarball's
`package.json` for `"workspace:` and fails the workflow if a match
is found. See `docs/RELEASE.md` for the publish runbook.

v0.1.0 of all four packages has been deprecated on the registry.

## 0.1.0

The first public release of Svedata. One npm install brings typed
access to seven Swedish government open APIs, all wrapped in the
same `{ data, meta }` envelope so calling SMHI feels the same as
calling Riksdagen feels the same as calling Nord Pool.

### Sources

- **SMHI** — current weather for Swedish cities via the SMHI forecast
  endpoint (SNOW1gv1, the replacement for the PMP3gv2 endpoint
  deprecated on 31 March 2026). Sentinel value `9999` is normalized
  to `null`.
- **Riksbanken** — current exchange rates against SEK (EUR, USD, GBP,
  NOK, DKK), current policy rate (styrränta) with the date of its
  most recent change, and historical exchange rates for any of the
  supported pairs between two dates.
- **SCB** — full search across the Statistical database, table
  metadata lookup, and data fetch via PxWebAPI 2.0. Data is returned
  as JSON-Stat 2.0.
- **Riksdagen** — document search across motioner, propositioner,
  betänkanden, and other parliamentary document types, plus a member
  listing filterable by party or constituency.
- **Nord Pool** — Swedish day-ahead spot prices for SE1–SE4. Since
  October 2025 the feed publishes 96 quarter-hourly points per day
  instead of 24 hourly. Backed by the free `elprisetjustnu.se` mirror
  of the ENTSO-E data Nord Pool publishes upstream (Nord Pool's own
  API is commercial).
- **Trafikverket** — train announcements and road traffic situations.
  Requires a free API key from Trafikverket; configure via
  `svedata.trafikverket.configure({ apiKey })` or
  `TRAFIKVERKET_API_KEY`. The only source in v0.1 that ever throws —
  auth and configuration errors deliberately exit the envelope.
- **Polisen** — recent police event announcements with filters on
  location name and event type. Datetime normalized to ISO 8601, GPS
  string split into `latitude`/`longitude` (WGS84), URLs absolutized.

### Conventions

All sources share a `{ data: T | null, meta }` envelope. `meta`
carries `source`, `fetched_at`, `cached`, and `rate_limit_remaining`.
Field names are English snake_case. Dates are ISO 8601 strings.
Coordinates are WGS84. The SDK never throws for "data not found" —
only for auth/configuration errors.

### Known limitations

- **Bolagsverket is not included in v0.1.** Even the agency's
  "Värdefulla datamängder" tier requires OAuth 2 client-credentials
  with a registered customer. We are deferring it to v0.2 along with
  a shared OAuth pattern that will also support future Skatteverket
  endpoints.
- **Trafikverket requires an API key.** The library is fully wired,
  but live verification of the happy path needs your own registered
  key. The auth-failure path has been live-verified.
- **Riksbanken has sticky rate limits.** During development we
  observed that the `Try again in N seconds` cooldown gets reset on
  every request — including the rate-limited ones. The SDK returns
  `{ data: null, meta: { rate_limit_remaining: 0 } }` on 429; consumers
  should back off rather than retry tightly.

### Thanks

Svedata is only possible because SMHI, Riksbanken, SCB, Riksdagen,
Polisen, Trafikverket, and the teams behind ENTSO-E and
`elprisetjustnu.se` publish their data openly. Tack.
