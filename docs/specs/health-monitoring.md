# Health Monitoring Specification

## Goal

Detect upstream API failures, deprecations, and unexpected behavior 
before users do. Publish health publicly to build trust.

## Architecture

### Components

1. **Smoke test workflow** (`.github/workflows/health-check.yml`)
   - Cron: every hour
   - Runs `bun run health:check` from packages/sdk
   - Posts results to status backend
   - Triggers Slack webhook on failure

2. **Health check command** (`packages/sdk/scripts/health-check.ts`)
   - For each source, run 1–3 known-good queries
   - Validate response structure matches expected schema
   - Validate response time under threshold (5s default)
   - Output JSON: `{ source, status, latency_ms, error? }[]`

3. **Status backend** (`apps/backend/src/routes/status.ts`)
   - POST /internal/health (auth-protected) — receives smoke test results
   - GET /status — public, returns current status per source
   - GET /status/history?source=smhi — per-source uptime history
   - Stores in Postgres with 30-day retention

4. **Status page** (`apps/dashboard/src/app/status/page.tsx`)
   - Reads from /status endpoint
   - Per-source: name, current status, last 30d uptime %, last incident
   - Auto-refreshes every 60s

### Status levels

- **healthy**: smoke test passed, response time normal
- **degraded**: smoke test passed but response time >2x normal, OR 
  response structure has unexpected fields
- **down**: smoke test failed (non-2xx status, timeout, or schema mismatch)

### Alerting

- Maintainer: Slack webhook + email on any source → down or degraded
- Paid customers (future): webhook to their endpoint on sources they use
- Public: status page reflects within 60 seconds

### Implementation phases

**Phase 1 (before v0.1 launch)**: 
- Smoke tests in CI, alerts to maintainer only
- No public page yet

**Phase 2 (at v0.1 launch)**:
- Public status page live
- Manual incident reports

**Phase 3 (paid tier launch)**:
- Customer webhooks
- SLA-backed tier
- Migration assistant API
