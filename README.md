# PLEASE DO NOT REMAIN HERE

A human tries to stay focused; an adaptive page tries to persuade them to leave.

## PD04B — Session lifecycle telemetry

The existing Vercel Neon integration provides `DATABASE_URL`. Apply `db/migrations/0001_initial.sql` before deploying (already applied to the production Neon database).

Each round starts immediately on click and independently attempts to create a durable Neon session through `POST /api/sessions`. The resulting random credential is retained in browser memory only and never written to storage. Every ~15 seconds a compact heartbeat is submitted. On focus loss, visibility loss, navigation, or concession, a terminal loss event is attempted with `fetch(..., keepalive:true)`, even when the session creation request finishes after the loss. The backend checks the hashed credential, validates bounded numeric counters, enforces terminal-once state transitions, and uses unique event keys to deduplicate telemetry.

**Operational caveats:** Network failures never block the game; telemetry status is shown locally. Browser unload delivery is best effort, so abandoned sessions remain `active` until a future lease-reconciliation job (PD04D) classifies them. API-origin sessions are not proof of a real focused visitor; these are client-reported outcomes. The server stores no IP addresses or raw pointer coordinates. Assignment cohorts are recorded but are **not yet applied to mutation selection**; PD04C will implement controls and exposures. No schema changes are required for PD04B.

## Development

Node.js 20.9+:
```bash
npm install
npm test
npm run typecheck
npm run lint
npm run build
```

## Future

PD04C: exposure logging and control assignment enforcement.
PD04D: integrity checks, expiration reconciliation, diagnostics and durable rate limits.
