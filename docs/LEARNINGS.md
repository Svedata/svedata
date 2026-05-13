# Engineering Learnings

A living log of lessons learned while building Svedata sources.
Claude Code should read this file before adding any new source.
Every time we hit a non-obvious problem, document it here so the
next source build avoids the same trap.

## How to use this file

- Read this file before starting any new source integration
- Add a new entry whenever you encounter a non-trivial gotcha
- Keep entries short and actionable — the lesson, not the story
- Group entries by source or by category (network, parsing, testing)

---

## Lessons from SMHI integration

### Verify against live endpoint before declaring done

Tests can be green while the source is fundamentally broken if
mocks return what we think the API returns. Always run at least
one real query against the production endpoint as part of the
build, not after.

Practical: every source build must include a live verification
step that hits the real API with a real-world input and prints
the actual response. If the response is `{ data: null }` or
unexpected, debug before committing.

### Swedish government APIs deprecate without notice

SMHI deprecated PMP3gv2 on 31 March 2026 with minimal public
warning. The PMP3gv2 endpoint returned HTTP 404 across all
coordinates after that date. Any source we build today might
deprecate tomorrow.

Practical:

- Always verify the documented endpoint is still live as the
  first step of source build
- If documentation references an endpoint version, search for
  "<source> API deprecated <current year>" before implementing
- Default to the newest documented API version, not the one most
  StackOverflow answers reference

### MSW mocks do not catch real-world structural changes

Our SMHI MSW tests passed because they returned data shaped like
the old PMP3gv2 API. The real endpoint was returning HTML 404 by
then. Mocks reflect our assumptions, not reality.

Practical: smoke tests against real endpoints are not optional.
They belong in a separate `health-check` workflow that runs hourly.
See docs/specs/health-monitoring.md.

### Diacritic normalization needs explicit tests

City lookup with Swedish characters (Malmö, Göteborg, Linköping)
works only if both the lookup table key and the input get
normalized identically. Test this explicitly with both forms
(`Malmö` and `malmo`) in every lookup-based source.

### Tystfels-mönstret är vanligt i defensive code

Designprincipen "returnera `{ data: null }` istället för att kasta"
är rätt för API-konsumenter men gör debugging svårare under
utveckling. Om du får null tillbaka oväntat, instrumentera
fetch-anropet med console.log för status, content-type, och
första 500 tecken av body innan du antar att det är en
parse-bugg.

---

## General patterns

### Bun workspace package resolution

Workspace packages (`@svedata/*`) resolves only inside folders
listed under `workspaces` in root `package.json`. If you want to
run example scripts that import workspace packages, the example
folder must be added to `workspaces` AND have its own
`package.json` declaring the dependency.

Practical: run ad-hoc verification from inside `packages/sdk` with
direct path imports (`./src/index.ts`), not from project root with
package name imports.

### TypeScript without build step

We use Bundler-mode in tsconfig with main/types pointing directly
to `src/index.ts`. This works for internal development but breaks
external `npm publish`. Before first publish, add tsup or similar
to generate `dist/` and update package.json fields.

### Envelope pattern requires explicit nulls

The `{ data, meta }` envelope means every code path must return
the envelope shape, even error paths. Use the helpers
`empty(makeMeta(SOURCE))` and `ok(data, makeMeta(SOURCE))`
consistently. Never return raw data or throw inside source code
unless it is a programmer error (auth missing, bad config).

---

## Lessons from Riksbanken integration

### Riksbank REST API has aggressive per-endpoint rate limits

`api.riksbank.se/swea/v1/` returns HTTP 429 after a small number of
quick successive calls. The limit appears to be per-endpoint, not
global, and the cooldown is typically 30–60 seconds. The body is
JSON `{ statusCode: 429, message: "Try again in N seconds." }`.

Practical:

- Prefer aggregated endpoints (`/Observations/Latest/ByGroup/{id}`)
  over fan-out (5× `/Observations/Latest/{seriesId}`). One call is
  always safer than five for the same data.
- Don't poll the live endpoint in tight loops during development —
  it just resets the cooldown timer.
- Live-verification scripts should call one method at a time with
  delays, not bundle all methods into a single Promise.all.

### Money type does not fit interest rates

The shared `Money = { amount, currency: 'SEK' }` type works for
prices but not for percentages. Policy rate is a `number` (the
percent value), not Money. Don't force the type just because the
domain says "rate" — percentages and currency amounts are different.

### Riksbanken SWEA has sticky rate limiting

During discovery and live verification we hit aggressive 429 responses
where the retry-after window kept resetting on every request, suggesting
a longer cooldown than the documented per-minute limit.

Practical:

- For discovery against Riksbanken, use raw curl with deliberate delays
  (60s+) between requests, not rapid iteration via `bun -e`
- Live verification of new Riksbanken methods should be spread across
  the day, not done in one burst
- Production SDK code should default to exponential backoff on 429, not
  immediate retry

**TODO:** the Riksbanken wrapper needs live re-verification of `policy()`
and `history()` from a clean IP (different network, VPN, or next day).
The `exchange()` method has been verified live and returned real data
on 2026-05-13.

### Aggregated endpoint returns mixed-freshness data

`/Observations/Latest/ByGroup/130` returns the latest value per
series, but those latest values can be from different dates
(retired currencies like CYP still appear with their 2007 date).
Always derive the response `date` from the max of per-series dates,
not the first row.

---

## Lessons from SCB integration

### PxWebAPI 2.0 prod URL is on statistikdatabasen.scb.se, not api.scb.se

The beta v2 lived at `api.scb.se/ov0104/v2beta/api/v2/`. Production
PxWebAPI 2.0 (launched October 2025) lives at
`statistikdatabasen.scb.se/api/v2/`. Searching for "SCB API" surfaces
both URLs — always confirm with a live `curl` before coding against
either.

### SCB tables endpoint returns helpful pagination metadata

`/tables` returns a `page` object with `pageNumber`, `pageSize`, and
`totalElements`. Use `totalElements` for "X results" UI, not
`tables.length`. The same is true for any PxWeb 2.0 list endpoint.

### JSON-Stat 2.0 is dense — return as opaque blob in v0.1

`/tables/{id}/data` returns JSON-Stat 2.0. Parsing it into flat rows
requires walking `dimension`, `id`, `size`, and `value` together —
non-trivial. v0.1 returns it as the opaque `jsonstat` field;
consumers who need rows can use a JSON-Stat lib. Flatten in v0.2 if
demand exists.

---

## Lessons from Riksdagen integration

### XML-backed JSON returns numbers as strings

`data.riksdagen.se` is an XML API with a JSON view bolted on. Numeric
metadata like `@traffar` (hit count), `fodd_ar` (birth year), and `@sida`
(page) are JSON *strings*. Always `parseInt` and validate — never trust
the JSON shape to imply native types.

### Single-result responses collapse arrays to objects

When a Riksdagen list query matches exactly one record, `dokument` /
`person` is a single object, not a one-element array. Wrap with an
`ensureArray()` helper on every list field. This bites in production
where most queries return many results during testing but single
results in edge cases (e.g. searching a unique doc_id).

### Protocol-relative URLs need upgrading

`dokument_url_html` etc. come back as `//data.riksdagen.se/...` —
protocol-relative. Browser users handle it; Node SDK consumers don't.
Always prepend `https:` in the mapper, return absolute URLs.

---

## Process learnings

### Verify current state before planning fixes

When the user reports a bug, run a quick live check to confirm the
bug still exists before drafting a fix plan. State observed at
time T can differ from state at time T+5min if commits or
deployments happened between.

Practical: before writing migration prompts or refactor plans,
run the single-line smoke test that reproduces the reported
symptom. If the symptom is gone, escalate to the user with
current evidence instead of executing the plan.

---

## Anti-patterns to avoid

### Do not catch and swallow errors in source code

When the underlying fetch fails, log enough context to debug
later. Returning empty envelope is fine, but the fetch error
itself should appear in the meta or in console.error so we can
diagnose post-incident.

### Do not assume API documentation is current

Even official docs lag the actual API by weeks or months.
Cross-reference with recent GitHub issues, Home Assistant
integrations, or Stack Overflow questions from the last 3 months.

### Do not skip rate-limit handling on first build

Even if the API has no rate limits today, implement 429 handling
from the start. Adding it later means refactoring tests and code
paths.
