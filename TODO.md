# Roadmap

Public technical roadmap for Svedata. See README for project overview.

## Current milestone: v0.1.0

### Sources to ship
- [x] SMHI — weather (migrated to SNOW1gv1 after PMP3gv2 deprecation)
- [ ] Riksbanken — exchange rates, policy rate, history
- [ ] Polisen — public events feed
- [ ] Nord Pool — electricity prices
- [ ] SCB — statistics database (PxWebAPI 2.0)
- [ ] Bolagsverket — company information
- [ ] Riksdagen — parliamentary documents
- [ ] Trafikverket — traffic, transport (requires API key)

### Infrastructure
- [ ] Build pipeline for npm publish (dist generation)
- [ ] MCP server packaging
- [ ] CLI tool
- [ ] Documentation site

### Quality
- [ ] Smoke tests against live endpoints (weekly CI workflow)
- [ ] Public status page (svedata.dev/status)
- [ ] CHANGELOG via changesets

## Future milestones

- **v0.2**: Caching layer, webhooks
- **v0.3**: Historical data, advanced search, full MCP suite
- **v1.0**: Stable API, paid cloud tier, enterprise features
