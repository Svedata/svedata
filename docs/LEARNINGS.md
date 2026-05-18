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

## Lessons from Nord Pool integration

### Nord Pool's "open" API is commercial — use elprisetjustnu.se instead

Nord Pool Group's official Day-Ahead API costs €4 100/year. For free
Swedish spot prices the de facto open feed is `elprisetjustnu.se`,
which pulls from ENTSO-E (the same upstream Nord Pool publishes to).
When CLAUDE.md says "Nord Pool öppna feed" it means this proxy, not
Nord Pool's own commercial product. Document the actual data source
in the SDK's docs page so users understand the chain of custody.

### Time-resolution changed October 2025: 24h → 96 × 15min

Until 2025-09-30 Swedish day-ahead prices were 24 hourly values per
day. Since 2025-10-01 the feed publishes 96 quarter-hourly values
(`time_start` → `time_end` = 15 min). Don't hard-code an array length
assumption; pre-Oct-2025 historical fetches still return 24 rows.

### Default "today" in source timezone, not server timezone

Electricity prices are scheduled in Europe/Stockholm local time. A
server running UTC that defaults `date` to its own "today" gets the
wrong calendar day for ~2 hours after midnight Stockholm time. Use
`Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Stockholm' })` to
get the local YYYY-MM-DD. Applies to any time-of-day-sensitive source.

---

## Lessons from Trafikverket integration

### XML-in-JSON-out is normal for legacy Swedish APIs

Trafikverket's API speaks XML on the request side
(`<REQUEST><LOGIN authenticationkey="..."/><QUERY .../></REQUEST>`)
but returns JSON if you send `Accept: application/json`. SDK consumers
should never see the XML — build it in the client and expose typed
filter options. Similar pattern is likely for other legacy `.gov.se`
APIs migrated to JSON in the last few years.

### globalThis.process trick avoids needing @types/node downstream

A source that wants to read `process.env.X` triggers TS2580 in any
consumer that doesn't have @types/node — including our own
`@svedata/mcp`. Solution:

```ts
const proc = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process;
const value = proc?.env?.[name];
```

Lets browser builds compile cleanly, lets Node/Bun pick up env vars
at runtime, and keeps `@types/node` out of consumer tsconfig.

### Auth errors throw; everything else uses envelope

Per CLAUDE.md design principle #3 we don't throw for "data not found",
but we *do* throw for auth/config errors. Concretely for Trafikverket:

- 401 / 403 / missing API key → `throw new Error(...)`
- 429 → empty envelope with `rate_limit_remaining: 0`
- Other non-2xx → empty envelope
- Structured `RESULT[0].ERROR` body → throw (it's typically auth or
  schema-version mismatch — programmer-fixable issues)

This is the first source applying that distinction; document it in
the source's mdx so users know to wrap `.trains()` / `.situations()`
in try/catch.

### Live verification of paid/key-gated sources can only test the auth-fail path without credentials

Without a registered `TRAFIKVERKET_API_KEY` we can verify that the
wrapper correctly *fails* against the live endpoint (401 → throws),
but not that the happy path produces real data. A green auth-fail
live test is meaningful: it proves the URL, request body, header,
and parser are all reaching production. Full live verification of
the happy path is a TODO for whoever has a key.

---

## Lessons from Polisen integration

### Polisen requires User-Agent — set it from SDK, not consumer

`polisen.se/api/events` rejects requests without a `User-Agent` header.
We set a Svedata-identifying UA inside the SDK rather than asking the
consumer to set it; the API's intent is to know *which app* is calling,
and `svedata/x.y (+https://github.com/Svedata/svedata)` answers that
correctly even for downstream apps. Future Polisen abuse complaints
will land in our inbox first — that is the right routing.

### Normalize timestamps to ISO 8601 at the boundary

Polisen returns `"2026-05-13 17:51:45 +02:00"` (space instead of T).
This still parses with `new Date()` in V8 but not in stricter parsers
or browser Safari. Always `.replace(' ', 'T').replace(/\s/g, '')` at
the SDK boundary so consumers can `Date.parse()` reliably. CLAUDE.md
already says "Datum returneras som ISO 8601-strängar" — this is the
mechanical step that enforces it.

### Strings-as-coordinates is common in Swedish gov APIs

`location.gps = "59.602496,18.138438"` is a single comma-joined string,
not an object. SMHI does similar things in some endpoints. Always parse
to `{ latitude: number | null, longitude: number | null }` at the
boundary with `Number.parseFloat` + `Number.isFinite` checks — never
return the raw string.

---

## Lessons from v0.1.2 (Riksbanken rate-limit UX)

### Conservative retry-once beats aggressive retry-many

Our LEARNINGS already noted that Riksbanken's "Try again in N seconds"
timer resets on every 429. Therefore retry strategy: trust the number
the server gives us *only when it's small*. We parse `Retry-After`
header or the body message, retry exactly once, and only if the wait
is ≤ 10 seconds. If the server says "wait 39 seconds", we don't —
we surface `meta.error: 'rate_limited'` and let the caller decide
whether to back off and retry later.

Why not exponential backoff inside the SDK? Because the SDK call is
typically inside a synchronous user flow (a CLI command, a request
handler, a UI fetch). A 30-second internal sleep hangs the UI.
Surface the error fast, let the consumer schedule its own retry.

### `meta.error` is a load-bearing UX signal

Pre-v0.1.2 the SDK returned `{ data: null }` for both "rate limited"
and "no such record". A user calling `exchange()` right after install
saw `null` and assumed the SDK was broken. The fix is one optional
field on `Meta`: `error?: 'rate_limited' | 'not_found' | 'upstream_error'`,
populated when the SDK has actionable info.

This is non-breaking because the field is optional — TypeScript
consumers see it as `string | undefined`, JavaScript consumers see
it appear when relevant. Other sources should adopt the same field
in their 429 (and ideally 4xx/5xx) paths in subsequent patches.

### Turbo `^build` can race with parallel DTS generation

When `@svedata/data`'s tsup DTS build starts before `@svedata/types`'
DTS finishes writing `dist/index.d.ts`, the consumer gets a stale
type resolution and fails with TS2305 ("no exported member"). A
fresh `bun run build` after deleting all `dist/` directories
typically resolves it; rare but worth knowing when touching the
shared types package.

---

## Lessons from v0.1.2 (SCB Swedish search default)

### SCB matches search queries against table labels in the requested language

`statistikdatabasen.scb.se/api/v2/tables?query=X&lang=Y` matches `X`
against table labels in language `Y`. Swedish search term with
`lang=en` → 0 hits; English search term with `lang=sv` → very few
hits (only words that happen to occur in Swedish labels).

This means the `lang` parameter is not just a presentation choice —
it determines which corpus is being searched. Default was `'en'`
in v0.1.0/v0.1.1; that returned 0 results for the obvious Swedish
input (`'befolkning'`) which is the primary use case for a Swedish
SDK. v0.1.2 flips the default to `'sv'`. Engelska sökord behöver nu
`{ lang: 'en' }` explicit.

Practical: when a source supports `lang`, document explicitly
*what* it controls. If it filters/matches (not just presents), the
default should match the SDK's primary user. For Svedata that is
Swedish.

### Default-value bugs hide in green test suites

The original SCB tests passed both `query: 'befolkning'` and
`lang: 'sv'` explicitly in every assertion. The default behavior
was never tested. The bug only surfaced when a user called the
method the way real users do — without options.

Practical: for every method with optional parameters, add at least
one test that exercises the default path. Cheap to write, catches
this class of bug before users do.

---

## Lessons from v0.1.1 hotfix (workspace:* on registry)

### `npm publish` runs `npm pack` internally — and `npm pack` does NOT rewrite `workspace:`

v0.1.0 was published with `cd packages/<pkg> && npm publish --access public`
from each package directory. The tarballs that ended up on the
registry contained `"@svedata/types": "workspace:*"` verbatim,
breaking install in any non-workspace consumer.

`bun pm pack` rewrites `workspace:^` → `^X.Y.Z` (and `workspace:*`
→ `X.Y.Z`) at pack time; `npm pack` does not — it's a strict-mode
unsupported URL in stock npm. They look identical from the outside
but produce different artifacts.

Practical: **publish from a tarball produced by `bun pm pack`, not
by running `npm publish` in a package directory.** The runbook in
`docs/RELEASE.md` makes this concrete. Earlier LEARNINGS entry about
`bun pm pack` rewriting was correct but only proved that local pack
worked — it did not catch the publish path because nobody had yet
actually published.

### `bun pm pack` reads workspace versions from the lockfile, not from package.json

When bumping versions, just editing `version` in each
`packages/<pkg>/package.json` is **not enough**. `bun install` with
an existing lockfile says "no changes" and the lockfile keeps the
old versions, so `bun pm pack` rewrites `workspace:^` to the *old*
version. Result: tarball v0.1.1 with dep `^0.1.0` — broken.

Practical: after any version bump, **delete `bun.lock` and run
`bun install` again** to force regeneration. The release runbook
documents this as the mandatory next step after editing versions.

### `workspace:^` not `workspace:*` for proper semver caret in published deps

Using `workspace:*` makes `bun pm pack` produce an exact-pin
dependency (`"@svedata/types": "0.1.1"`). Using `workspace:^`
produces a caret range (`"@svedata/types": "^0.1.1"`), which is the
right default for a published SDK — consumers get patch updates of
internal sibling packages without a major bump. Use `workspace:^`
everywhere unless you have a specific reason to pin exact.

### Local pack-test isn't sufficient — `what you test must be what you ship`

The v0.1.0 ship-prep ran clean-room install of locally-packed
tarballs, and the install worked. But the published artifacts were
different (they were packed by `npm pack` during `npm publish`, not
by `bun pm pack`). The test passed; the ship failed.

Practical:

- The publish step must use the same `bun pm pack`-produced
  tarballs that the local verify step used. `npm publish <tarball>`
  guarantees that. `npm publish` without a path argument does not.
- CI must grep packed tarballs' `package.json` for `"workspace:`
  and fail the run if it appears. Added to `publish-check.yml` in
  v0.1.1.

---

## Lessons from v0.1.0 ship-prep

### `bun pm pack` rewrites `workspace:*` to concrete versions

Critical for publish workflows. When we pack `@svedata/data` whose
`dependencies` includes `"@svedata/types": "workspace:*"`, the tarball's
`package.json` contains `"@svedata/types": "0.1.0"`. No manual
version-rewrite step needed before `npm publish`. Document this in
the publish runbook — npm pack does *not* do the same rewrite, only
the Bun/pnpm/changesets toolchain does.

### tsup dual ESM+CJS works out of the box with `external`

For workspace dependencies, marking them `external` in `tsup.config.ts`
ensures they're not bundled, and consumers pick them up from their
own `node_modules`. Without `external`, tsup tries to inline workspace
deps and bloats output. Always external workspace deps.

### Pointing `exports` at `dist/` forces build-before-typecheck

Once `package.json#exports` points to `dist/index.d.ts`, any consumer
package (including sibling packages in the monorepo) needs that file
to exist before TypeScript can resolve types. Turbo's `^build`
dependency for `typecheck` and `test` tasks is therefore mandatory,
not optional, after switching to dist-based exports.

### CLI bin entry needs a separate tsup entry, not just shebang

A `#!/usr/bin/env node` line in a source file is preserved by tsup,
but the dts generation chokes if you ask for types on a file with no
exports. Solution: a separate `bin/cli.ts` entry, configure
`dts: { entry: 'src/index.ts' }` to scope dts generation to the
library entry only.

### README quickstart should be verified by paste

A README example that "looks right" usually has at least one typo
or out-of-date field name. The cheap fix: after writing the README,
copy the quickstart code into a `.mjs` file inside the clean-room
install dir and run it. If it doesn't produce real output, the README
lies — fix the README, not the test.

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
