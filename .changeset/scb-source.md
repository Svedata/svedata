---
'@svedata/data': minor
'@svedata/types': minor
---

Add SCB source with three methods backed by PxWebAPI 2.0:

- `svedata.scb.search(query, options?)` — search the Statistical database for tables
- `svedata.scb.table(tableId, options?)` — get full table metadata including subject paths
- `svedata.scb.data(tableId, options?)` — fetch table data as JSON-Stat 2.0

No API key required. Supports `lang: 'en' | 'sv'`. Backed by
`statistikdatabasen.scb.se/api/v2/`. 429 responses are treated as
empty envelopes with `rate_limit_remaining: 0`.
