# Svedata

Open-source TypeScript SDK + managed backend för svenska myndighets-API:er.

## Vision

En enda npm-installation ska ge utvecklare typesafe åtkomst till SMHI,
SCB, Bolagsverket, Skatteverket, Riksdagen, Trafikverket, Nord Pool,
Polisen och fler — utan att läsa 15 olika API-dokumentationer.

Gratis open-source-mode anropar myndigheternas API:er direkt.
Betald cloud-mode (svedata.dev) ger caching, webhooks, högre rate limits,
historisk data, audit logs och MCP-server.

## Domäner & namnrymder

- Webb: svedata.dev (marknad), app.svedata.dev (dashboard), api.svedata.dev (backend), docs.svedata.dev (dokumentation)
- npm-org: @svedata (paket: @svedata/data, @svedata/mcp, @svedata/cli)
- GitHub-org: github.com/svedata
- Mejl: hello@svedata.dev

## Stack (icke-förhandlingsbart)

- Monorepo: Turborepo + Bun workspaces
- SDK: TypeScript strict mode, ESM, target Node 20+ och modern browsers
- Tester: Vitest med MSW för API-mocks
- Backend: Bun + Hono på Fly.io
- DB: Postgres (Supabase) + Redis (Upstash) för cache
- Dashboard: Next.js 15 App Router på Vercel
- Auth: Supabase Auth med magic links
- Billing: Stripe Billing i SEK
- MCP: @modelcontextprotocol/sdk
- CI: GitHub Actions
- Publishing: npm under @svedata

## Repo-struktur

```
svedata/
├── packages/
│   ├── sdk/              # @svedata/data — huvudpaketet
│   ├── mcp/              # @svedata/mcp — MCP-server
│   ├── cli/              # @svedata/cli — kommandoradsverktyg
│   └── types/            # Delade TypeScript-typer
├── apps/
│   ├── dashboard/        # app.svedata.dev (Next.js)
│   ├── backend/          # api.svedata.dev (Bun + Hono)
│   └── docs/             # docs.svedata.dev (Nextra)
├── examples/
│   └── ...               # Demo-projekt som dogfooding
└── .claude/
    └── skills/
        ├── goal.md
        ├── add-source.md
        └── ship.md
```

## Designprinciper

1. Konsistent envelope överallt: alla anrop returnerar `{ data, meta }`.
   `meta` innehåller `source`, `fetched_at`, `cached`, `rate_limit_remaining`.
2. Engelska fältnamn som default, `{ lang: 'sv' }` ger svenska.
3. Aldrig kasta exceptions för "data ej hittad" — returnera `{ data: null, meta }`.
   Kasta endast för programmerings-/auth-fel.
4. Allt har TypeScript-typer auto-genererade från OpenAPI-spec där det finns,
   handskrivna där det inte finns.
5. Source-koden ska kunna läsas och förstås av en svensk junior-utvecklare
   på 30 minuter. Inga onödiga abstraktioner.
6. Aldrig API-nyckel i source-kod, alltid via env eller config-objekt.
7. OSS-läget måste fungera helt utan vår backend — vi får inte vara en
   single point of failure för OSS-användare.

## Konventioner

- Källor namnges efter myndighetens svenska namn: `svedata.smhi`, `svedata.scb`,
  `svedata.bolagsverket`, `svedata.riksdagen`
- Metoder är engelska verb: `.current()`, `.search()`, `.lookup()`, `.history()`
- Datum returneras som ISO 8601-strängar, aldrig som Date-objekt
- Pengar returneras som `{ amount: number, currency: 'SEK' }`
- Koordinater i WGS84, aldrig SWEREF
- Personnummer maskeras alltid i loggar (ÅÅMMDD-XXXX → ÅÅMMDD-****)
- Variabelnamnet i import är `svedata`

## Commit-stil

Conventional commits: `feat(smhi):`, `fix(scb):`, `docs:`, `chore:`, `test:`.
En logisk ändring per commit. Inga generated-by-Claude-meddelanden.

## När jag säger "lägg till källa X"

Följ .claude/skills/add-source.md. Undersök officiell API-dokumentation,
skriv types, skriv klient, skriv tester med MSW-mocks, dokumentera,
exportera från huvud-index.

Innan du börjar:
1. Läs docs/LEARNINGS.md i sin helhet — där finns lärdomar från tidigare källor
2. Sök på webben efter "<källa> API deprecated 2026" och "<källa> API
   breaking changes 2026" — verifiera att dokumentationen är aktuell
3. Lista success criteria

Under bygget — verifiera inkrementellt, inte i slutet:

a) När du har skrivit klienten men innan tester: kör en live-curl mot
   produktions-endpointen för att verifiera URL-format och responsstruktur.
   Om HTTP är 4xx eller 5xx, eller om responsen inte matchar förväntad
   struktur, stanna och felsök innan du fortsätter.

b) När tester är skrivna: kör testerna. Om de inte är gröna, debugga
   max 3 gånger innan du eskalerar till mig.

c) När tester är gröna: kör en live-verifiering med riktig input
   (`bun --print` eller skript). Om resultatet är `{ data: null }` eller
   uppenbart fel, stanna och felsök innan du committar.

Efter bygget:
- Om du stötte på något icke-trivialt fel som någon annan source-build
  också kan stöta på, lägg till en kort entry i docs/LEARNINGS.md
- Följ skills/add-source.md för slutsteg (changeset, dokumentation, export)

Felsökningsstrategi:
- Max 3 retry-cykler innan eskalering till mig
- Vid eskalering: rapportera exakt felmeddelande, exakt URL anropad,
  HTTP-status, och första 500 tecken av response body
- Antaganden du gjort: dokumentera dem så jag vet vad du checkade

Innan du börjar:
1. Läs docs/LEARNINGS.md i sin helhet — där finns lärdomar från tidigare källor
2. Sök på webben efter "<källa> API deprecated 2026" och "<källa> API
   breaking changes 2026" — verifiera att dokumentationen är aktuell
3. Lista success criteria

Under bygget — verifiera inkrementellt, inte i slutet:

a) När du har skrivit klienten men innan tester: kör en live-curl mot
   produktions-endpointen för att verifiera URL-format och responsstruktur.
   Om HTTP är 4xx eller 5xx, eller om responsen inte matchar förväntad
   struktur, stanna och felsök innan du fortsätter.

b) När tester är skrivna: kör testerna. Om de inte är gröna, debugga
   max 3 gånger innan du eskalerar till mig.

c) När tester är gröna: kör en live-verifiering med riktig input
   (`bun --print` eller skript). Om resultatet är `{ data: null }` eller
   uppenbart fel, stanna och felsök innan du committar.

Efter bygget:
- Om du stötte på något icke-trivialt fel som någon annan source-build
  också kan stöta på, lägg till en kort entry i docs/LEARNINGS.md
- Följ skills/add-source.md för slutsteg (changeset, dokumentation, export)

Felsökningsstrategi:
- Max 3 retry-cykler innan eskalering till mig
- Vid eskalering: rapportera exakt felmeddelande, exakt URL anropad,
  HTTP-status, och första 500 tecken av response body
- Antaganden du gjort: dokumentera dem så jag vet vad du checkade

## När jag säger /goal

Följ .claude/skills/goal.md. Definiera success criteria, fråga inte om
detaljer med rimliga defaults, kör tills färdigt, summera.

## När jag säger "ship"

Följ .claude/skills/ship.md. Kör tester, bygg, kontrollera version,
kör changeset, publicera till npm om allt grönt.

## MVP-prioriteringar (i ordning)

1. SMHI (väder + havsobservationer) — enklast, ger snabb vinst
2. Riksbanken (växelkurser + räntor) — REST + JSON, lättarbetat
3. SCB (statistikdatabasen via PxWebAPI 2.0)
4. Riksdagen (dokument + ledamöter)
5. Nord Pool (elpriser via deras öppna feed)
6. Trafikverket (kräver API-nyckel — hantera i config)
7. Polisen (öppen feed, enkel)

Stoppa vid 7 källor för v0.1.0. Lansera. Lägg till fler baserat på issues.

**Bolagsverket** är skjutet till v0.2 eftersom även deras "öppna"
Värdefulla-datamängder-API kräver OAuth 2 client-credentials med
registrerad kund. Vi vill etablera ett ordentligt OAuth-mönster
innan vi rör den (delas sannolikt med framtida Skatteverket-källor).

## Vad vi INTE bygger i v0.1

- Inga skrivande operationer mot myndigheter (bara läs)
- **Ingen Bolagsverket** — även deras avgiftsfria "Värdefulla datamängder"-API
  kräver OAuth 2 client-credentials med registrerad kund hos Bolagsverket.
  Att improvisera fram ett OAuth-mönster under v0.1-tidstryck skulle ge dåligt
  resultat; mönstret förtjänar egen designtid och kommer i v0.2.
- Ingen Lantmäteriet (kräver formellt avtal, för komplicerat för MVP)
- Ingen Skatteverket privat-data (kräver myndighetsroll)
- Ingen BankID-integration (separat paket senare)
- Ingen GraphQL — pure REST i v1

## Preliminärt för v0.2

- **OAuth 2 client-credentials-mönster** etableras som delad infrastruktur
  i SDK:n. Förväntas användas av Bolagsverket (Värdefulla datamängder) och
  framtida Skatteverket-källor. Konfigurationsmönstret bör likna det vi
  redan har för Trafikverket (`configure({ clientId, clientSecret })` +
  env-fallback), men med automatisk token-cache och refresh.
- När mönstret är etablerat: lägg till Bolagsverket som åttonde källa.
