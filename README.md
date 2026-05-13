# Svedata

A TypeScript SDK for Swedish government open APIs — one install,
typesafe access to seven sources, consistent `{ data, meta }` envelope
across all of them.

## Install

```bash
npm install @svedata/data
# or
bun add @svedata/data
```

## Quickstart

```ts
import { svedata } from '@svedata/data';

const { data, meta } = await svedata.smhi.current('Malmö');

if (data) {
  console.log(`${data.air_temperature}°C in ${data.location}`);
}
console.log(`Source: ${meta.source}, fetched at: ${meta.fetched_at}`);
```

Every call returns the same shape:

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

When data isn't found you get `{ data: null, meta }` — the SDK does
not throw for missing data. It only throws for auth and configuration
errors (e.g. a missing API key for Trafikverket).

## Sources

### SMHI — weather

```ts
await svedata.smhi.current('Stockholm');
```

### Riksbanken — exchange rates and policy rate

```ts
await svedata.riksbanken.exchange();             // EUR/USD/GBP/NOK/DKK → SEK
await svedata.riksbanken.policy();                // current styrränta + last change
await svedata.riksbanken.history('EURSEK', '2026-05-01', '2026-05-12');
```

### SCB — Statistical database (PxWebAPI 2.0)

```ts
await svedata.scb.search('Population by region');
await svedata.scb.table('TAB638');
await svedata.scb.data('TAB638');                 // returns JSON-Stat 2.0
```

### Riksdagen — documents and members

```ts
await svedata.riksdagen.documents({ query: 'klimat', type: 'mot' });
await svedata.riksdagen.members({ party: 'M' });
```

### Nord Pool — Swedish day-ahead spot prices

```ts
await svedata.nordpool.prices('SE3');             // 96 × 15-min points for today
```

### Trafikverket — traffic information (requires API key)

```ts
svedata.trafikverket.configure({ apiKey: process.env.TRAFIKVERKET_API_KEY! });

await svedata.trafikverket.trains({ station: 'Cst' });
await svedata.trafikverket.situations({ county: 1 });
```

[Register for a free key at trafikinfo.trafikverket.se](https://api.trafikinfo.trafikverket.se/Account/Register).

### Polisen — police event announcements

```ts
await svedata.polisen.events({ location: 'Stockholm', type: 'Rån' });
```

## Why this exists

Swedish public-sector APIs are fragmented. Each agency has its own
conventions, its own auth model, its own pagination quirks. Documentation
is often only in Swedish or only in English (rarely both, never consistently).
Endpoints get deprecated with little notice — SMHI's PMP3gv2 went away
on 31 March 2026; many integrations broke that day.

Svedata is the glue layer. It calls the same upstream endpoints you would,
gives you typed responses with field names that make sense in either Swedish
or English contexts, and absorbs the breakage when an upstream changes shape.

The open-source SDK works entirely against agencies' own endpoints — there
is no Svedata server in the call path. You can use this offline-ish without
trusting us with anything.

## What's coming

A paid cloud tier at [svedata.dev](https://svedata.dev) will add caching,
higher rate limits, webhooks for change notifications, historical data,
audit logs, and a hosted MCP server. v0.2 will introduce an OAuth 2
client-credentials pattern enabling Bolagsverket (company information)
and additional Skatteverket endpoints. The OSS SDK will keep working
without any of that — the cloud features are a convenience layer, not
a gate.

## Contributing

Issues and PRs welcome at [github.com/Svedata/svedata](https://github.com/Svedata/svedata).
If an agency you need isn't included, open an issue — we are
prioritizing based on what real users ask for.

For local development:

```bash
git clone https://github.com/Svedata/svedata
cd svedata
bun install
bun run build
bun test
```

## License

MIT. See [LICENSE](./LICENSE).

---

[Documentation](https://docs.svedata.dev) · [GitHub](https://github.com/Svedata/svedata) · [npm](https://www.npmjs.com/package/@svedata/data)
