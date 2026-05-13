---
'@svedata/data': minor
'@svedata/types': minor
---

Add Polisen source: `svedata.polisen.events(options?)` returns the
police's recent event announcements (up to ~500) with filters on
location name and event type. No API key required (User-Agent header
is set automatically). Datetime is normalized to ISO 8601, GPS string
is split into `latitude`/`longitude` numbers (WGS84), relative URLs
are upgraded to absolute HTTPS.
