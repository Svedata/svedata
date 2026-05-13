---
'@svedata/data': minor
'@svedata/types': minor
---

Add Nord Pool source: `svedata.nordpool.prices(area, options?)` returns
Swedish day-ahead spot prices for SE1–SE4 in 15-minute intervals
(96 points per day since October 2025). No API key required. Default
date is today in Europe/Stockholm. Backed by the open feed at
`elprisetjustnu.se` (which mirrors ENTSO-E data from Nord Pool).
