---
'@svedata/data': minor
'@svedata/types': minor
---

Add Riksbanken source with three methods:

- `svedata.riksbanken.exchange()` — current EUR/USD/GBP/NOK/DKK rates against SEK
- `svedata.riksbanken.policy()` — current policy rate (styrränta) and date of last change
- `svedata.riksbanken.history(pair, from, to)` — historical exchange rates for a currency pair

Backed by the public Riksbank REST API at `api.riksbank.se/swea/v1/`.
No API key required. 429 responses are treated as empty envelopes with
`rate_limit_remaining: 0`.
