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

## När jag säger /goal

Följ .claude/skills/goal.md. Definiera success criteria, fråga inte om
detaljer med rimliga defaults, kör tills färdigt, summera.

## När jag säger "ship"

Följ .claude/skills/ship.md. Kör tester, bygg, kontrollera version,
kör changeset, publicera till npm om allt grönt.

## MVP-prioriteringar (i ordning)

1. SMHI (väder + havsobservationer) — enklast, ger snabb vinst
2. Riksbanken (växelkurser + räntor) — REST + JSON, lättarbetat
3. Bolagsverket (företagsinfo)
4. SCB (statistikdatabasen via PxWebAPI 2.0)
5. Riksdagen (dokument + ledamöter)
6. Nord Pool (elpriser via deras öppna feed)
7. Trafikverket (kräver API-nyckel — hantera i config)
8. Polisen (öppen feed, enkel)

Stoppa vid 8 källor för v0.1.0. Lansera. Lägg till fler baserat på issues.

## Vad vi INTE bygger i v0.1

- Inga skrivande operationer mot myndigheter (bara läs)
- Ingen Lantmäteriet (kräver formellt avtal, för komplicerat för MVP)
- Ingen Skatteverket privat-data (kräver myndighetsroll)
- Ingen BankID-integration (separat paket senare)
- Ingen GraphQL — pure REST i v1
