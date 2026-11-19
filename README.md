# Svedata

A TypeScript SDK for Swedish government open APIs — one install,
typesafe access to fourteen sources, consistent `{ data, meta }` envelope
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

Fourteen sources. Only Trafikverket needs an API key; every other source
works out of the box.

| Namespace | Organisation | Data | Key | Licence / terms | Attribution |
| --- | --- | --- | --- | --- | --- |
| `smhi` | SMHI | Weather forecasts | No | [CC BY 4.0](https://www.smhi.se/data/om-smhis-data/villkor-for-anvandning) | "SMHI" |
| `riksbanken` | Sveriges Riksbank | Exchange rates, policy rate | No | [Riksbank API terms](https://developer.api.riksbank.se/) | See terms |
| `scb` | Statistics Sweden | Statistical database (PxWebAPI 2.0) | No | [CC0](https://www.scb.se/vara-tjanster/oppna-data/) | Optional ("Källa: SCB") |
| `riksdagen` | Sveriges riksdag | Documents, members | No | [Free use](https://www.riksdagen.se/sv/dokument-och-lagar/riksdagens-oppna-data/) | "Sveriges riksdag" |
| `nordpool` | elprisetjustnu.se (Nord Pool / ENTSO-E data) | Day-ahead spot prices | No | [elprisetjustnu.se](https://www.elprisetjustnu.se/elpris-api) | See terms |
| `trafikverket` | Trafikverket | Trains, traffic situations | **Yes** (free) | [Trafikverket open data](https://data.trafikverket.se/) | See terms |
| `polisen` | Polismyndigheten | Police event announcements | No | [polisen.se/api](https://polisen.se/om-polisen/om-webbplatsen/oppna-data/) | See terms |
| `kolada` | RKA (Kolada) | Municipal and regional key figures | No | [Free, incl. commercial](https://kolada.se/om-oss/api/) | "Källa: Kolada" |
| `arbetsformedlingen` | Arbetsförmedlingen (JobTech) | Job ads | No | [CC0](https://data.jobtechdev.se/dataservice/jobsearch/) | Optional |
| `krisinformation` | Myndigheten för civilt försvar | Crisis and emergency news | No | [Open API terms](https://www.krisinformation.se/om-krisinformation.se/oppen-data/) | "Krisinformation.se" |
| `svk` | Svenska kraftnät | Cross-border power flows, historical day-ahead prices | No | [CC BY 4.0](https://data.svk.se/sv/about) | "Källa: Svenska kraftnät (data.svk.se)" |
| `skolverket` | Skolverket (Susa-navet) | Education offerings, events, providers | No | [CC0](https://www.skolverket.se/om-skolverket/webbplatser-och-tjanster/oppna-data/api-for-utbildningstillfallen-susa-navet) | Optional |
| `visitsweden` | Visit Sweden | Tourism: lodging, food, events, places | No | Open data, no named licence — [see note](#visit-sweden--tourism-data) | Recommended |
| `hav` | Havs- och vattenmyndigheten | Bathing waters, sample results, water temperature forecasts | No | [HaV open data terms](https://www.havochvatten.se/data-kartor-och-rapporter/data-och-statistik/data-och-apier/api-badplatser-och-badvatten.html) — no named data licence | "Havs- och vattenmyndigheten" |

Licence links point to each organisation's own terms. Svedata's MIT
licence covers the SDK code only, not the data you fetch with it.
Check the provider's terms before you republish data.

### SMHI — weather

```ts
await svedata.smhi.current('Stockholm');
await svedata.smhi.current({ latitude: 59.3293, longitude: 18.0686 });
await svedata.smhi.forecast('Stockholm');           // alias — same data, clearer name
```

Note: backed by SMHI's forecast endpoint, not the observation API.
`timeSeries[0]` is the next short-range forecast point (≤ 1 hour out),
which matches "current weather" for typical UI use.

### Riksbanken — exchange rates and policy rate

```ts
await svedata.riksbanken.exchange();             // EUR/USD/GBP/NOK/DKK → SEK
await svedata.riksbanken.policy();                // current styrränta + last change
await svedata.riksbanken.history('EURSEK', '2026-05-01', '2026-05-12');
```

### SCB — Statistical database (PxWebAPI 2.0)

```ts
await svedata.scb.search('befolkning');                          // default sv
await svedata.scb.search('Population by region', { lang: 'en' });
await svedata.scb.table('TAB638');
await svedata.scb.data('TAB638');                                // returns JSON-Stat 2.0
```

Note: `lang` controls both presentation and search linguistics, and
different languages return different result counts because SCB's
metadata coverage varies. See [the SCB source docs](https://docs.svedata.dev/sources/scb#language-and-search-results)
for details.

### Riksdagen — documents and members

```ts
await svedata.riksdagen.documents({ query: 'klimat', type: 'mot' });
await svedata.riksdagen.members({ party: 'M' });
```

### Nord Pool — Swedish day-ahead spot prices

```ts
await svedata.nordpool.prices('SE3');             // 96 × 15-min points for today
```

Backed by `elprisetjustnu.se`, a free community proxy that republishes
ENTSO-E / Nord Pool data. Nord Pool's own API is commercial. `meta.source`
is `'elprisetjustnu'` to make the actual data origin visible in the
envelope.

### Trafikverket — traffic information (requires API key)

```ts
svedata.trafikverket.configure({ apiKey: process.env.TRAFIKVERKET_API_KEY! });

await svedata.trafikverket.trains({ station: 'Cst' });
await svedata.trafikverket.situations({ county: 1 });
```

[Register for a free key at data.trafikverket.se](https://data.trafikverket.se/oauth2/Account/register).

### Polisen — police event announcements

```ts
await svedata.polisen.events({ location: 'Stockholm', type: 'Rån' });
```

### Kolada — municipal and regional key figures

```ts
await svedata.kolada.kpis('invånare');                       // search key figures
await svedata.kolada.municipalities('lund');                 // → id '1281'
await svedata.kolada.data('N01951', ['1281', '0180'], { years: [2023] });
```

Kolada (RKA) data is free to reuse, including commercially. Show
`Källa: Kolada` when you display it.

### Arbetsförmedlingen — job ads (JobTech JobSearch)

```ts
await svedata.arbetsformedlingen.search({ query: 'utvecklare', municipality: '1281' });
await svedata.arbetsformedlingen.lookup('31642824');
```

Ads are CC0 open data. The SDK leaves out recruiter contact details
and organisation numbers (a sole trader's is their personnummer).

### Krisinformation — crisis and emergency news

```ts
await svedata.krisinformation.news({ counties: '24', days: 30 });
await svedata.krisinformation.lookup(1263);
```

Attribute the information to Krisinformation.se when you show it.

### Svenska kraftnät — power flows and historical prices

```ts
await svedata.svk.flows({ from: 'SE3', to: 'SE4' });               // today, 15-min net flows in MW
await svedata.svk.flows({ date: '2026-11-19' });                   // all routes
await svedata.svk.prices('SE3', { date: '2026-06-15' });           // EUR/MWh, historical
await svedata.svk.datasets();                                       // what Data Service publishes
```

Svenska kraftnät's Data Service (CKAN). CC BY 4.0: show
"Källa: Svenska kraftnät (data.svk.se)". SVK says the data must not be
used as operational input for decisions or time-critical functions. The
day-ahead price dataset is an archive (it ended on 1 July 2026 when this
was written); use `nordpool.prices()` for today's prices.

### Skolverket — education offerings (Susa-navet)

```ts
await svedata.skolverket.educations({ schoolType: 'YH', pageSize: 50 });
await svedata.skolverket.events({ schoolType: 'YH', updatedSince: '2026-11-01' });
await svedata.skolverket.providers({ schoolType: 'FHS' });
await svedata.skolverket.education('i.myh.yh.8917');
```

Skolverket's Susa-navet API (EMIL 3). CC0. Paginated (`page` from 0,
`pageSize` up to 2000); there is no free-text search upstream.

### Visit Sweden — tourism data

```ts
await svedata.visitsweden.search({ type: 'lodging', region: 'skane' });
await svedata.visitsweden.search({ type: 'event', query: 'Göteborg', lang: 'en' });
await svedata.visitsweden.lookup('210/4613');
```

Visit Sweden's national tourism API (EntryStore, JSON-LD), public
search without a key. **Licence note:** Visit Sweden describes the data
as open data that can be used, reused and shared "without licence cost
and without licence restrictions", but names no specific licence (such
as a CC licence). Images and texts come from many tourism businesses,
and image rights can be separate. The SDK returns text, coordinates and
links only, not images. Credit Visit Sweden and check
[their terms](https://corporate.visitsweden.com/nationellt-api/) before
commercial republication.

### Havs- och vattenmyndigheten — bathing waters

```ts
await svedata.hav.bathingWaters({ municipality: '1280' });            // Malmö
await svedata.hav.bathingWaters({ adviceAgainstBathing: true });       // active advisories
await svedata.hav.lookup('SE0441264000000306');
await svedata.hav.results('SE0441264000000306');                       // E. coli, enterococci, algae
await svedata.hav.forecasts({ municipality: '1280' });                 // water temp, next hours
```

HaV's bathing water API v2, open with no key (1000 requests per minute).
HaV's terms put the API specification under CC0 and refer to its website
for the data; no named data licence was found. Credit HaV as the source.

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
audit logs, and a hosted MCP server. A later release will introduce an
OAuth 2 client-credentials pattern enabling Bolagsverket (company
information) and additional Skatteverket endpoints. The OSS SDK will keep working
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
