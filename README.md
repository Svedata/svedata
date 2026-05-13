# Svedata

Open-source TypeScript SDK + managed backend för svenska myndighets-API:er.

En enda npm-installation ger typesafe åtkomst till SMHI, SCB, Bolagsverket,
Riksdagen, Trafikverket, Nord Pool, Polisen och fler — utan att läsa
15 olika API-dokumentationer.

## Installation

```bash
npm install @svedata/data
# eller
bun add @svedata/data
```

## Snabbstart

```ts
import { svedata } from '@svedata/data';

const { data, meta } = await svedata.smhi.current('Stockholm');

if (data) {
  console.log(`${data.temperature}°C i ${data.location}`);
}
console.log(`Källa: ${meta.source}, hämtad: ${meta.fetched_at}`);
```

Alla anrop returnerar ett konsistent envelope:

```ts
type Envelope<T> = {
  data: T | null;
  meta: {
    source: string;
    fetched_at: string;
    cached: boolean;
    rate_limit_remaining: number | null;
  };
};
```

Vid "data ej hittad" får du `{ data: null, meta }` — inga exceptions.

## Tillgängliga källor (v0.1)

- `svedata.smhi` — väder (SMHI Open Data)

Fler källor på väg: Riksbanken, Bolagsverket, SCB, Riksdagen, Nord Pool,
Trafikverket, Polisen.

## OSS-läge vs Cloud

Gratis OSS-läget anropar myndigheternas API:er direkt — fungerar utan
någon backend från oss.

Cloud-läget på [svedata.dev](https://svedata.dev) ger caching, webhooks,
högre rate limits, historisk data, audit logs och en MCP-server.

## Utveckling

Kräver [Bun](https://bun.sh) ≥ 1.3 och Node ≥ 20.

```bash
bun install
bun test
bun typecheck
bun run lint
```

## Licens

MIT
