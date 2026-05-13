---
'@svedata/data': minor
'@svedata/types': minor
---

Add Trafikverket source — first source requiring an API key.

- `svedata.trafikverket.trains(options?)` — TrainAnnouncement query (schema 1.9)
- `svedata.trafikverket.situations(options?)` — Situation query (schema 1.5)
- `svedata.trafikverket.configure({ apiKey })` — explicit API key configuration

Falls back to `process.env.TRAFIKVERKET_API_KEY` if no explicit configure
call has been made. Throws on missing-key, 401, 403, and structured API
errors — auth and configuration errors are exceptions to the envelope
pattern per CLAUDE.md design principle #3.

Backed by `api.trafikinfo.trafikverket.se/v2/data.json` via XML POST
internally, mapped to typed snake_case JSON in the envelope.
