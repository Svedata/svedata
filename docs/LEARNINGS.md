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
