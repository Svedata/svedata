---
'@svedata/data': minor
'@svedata/types': minor
---

Add Riksdagen source with two methods:

- `svedata.riksdagen.documents(options?)` — search documents (motioner, propositioner, betänkanden, etc.) with filters on query, type, year, and pagination
- `svedata.riksdagen.members(options?)` — list members of parliament, filterable by party or constituency

Backed by the open API at `data.riksdagen.se`. No API key required.
Numeric strings in the raw XML-backed JSON (`@traffar`, `fodd_ar`) are
normalized to `number`. Protocol-relative document URLs are upgraded to
absolute HTTPS. Single-object responses (when only one match) are
normalized to arrays so consumers always get a consistent shape.
