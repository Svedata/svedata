---
name: add-source
description: Lägg till en ny myndighetskälla i SDK:n
---

Lägg till källa: $ARGUMENTS

Följ denna sekvens:

1. Undersök officiell API-dokumentation. Notera bas-URL, autentisering,
   rate limits, format, exempel-respons.
2. Skapa packages/types/src/<källa>.ts med TypeScript-interfaces.
3. Skapa packages/sdk/src/sources/<källa>/index.ts. Använd fetch (inte axios).
   Hantera retry, timeout, 429-rate-limits.
4. Wrappa alltid svar i { data, meta }-envelope enligt CLAUDE.md.
5. Skapa <källa>.test.ts. Mocka 3 scenarier med MSW: success, 404, 429.
6. Lägg till källan i packages/sdk/src/index.ts.
7. Lägg till markdown-fil i apps/docs/content/sources/<källa>.mdx.
8. Kör bunx changeset add med en minor bump.

Stoppa efter punkt 8. Visa diff-summering.
