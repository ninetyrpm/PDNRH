# PLEASE DO NOT REMAIN HERE

A visitor tries to stay focused; an adversarial webpage tries to persuade them to leave.

## PD04D — Integrity and reconciliation

- Baseline exposure is inserted by the server immediately after the session is created, not via an unreliable client-side race.
- Mutation exposures are authenticated, validated, idempotent by session/ordinal, and their windows are rederived from ordinal ordering.
- A terminal loss closes open exposures. Timing is server-observed, not guaranteed browser render time.
- `db/maintenance/diagnostics.sql` provides read-only operational diagnostics.
- `db/maintenance/reconcile.sql` is a **manual, repeatable** maintenance routine to close historical exposures and classify stale active sessions as **uncertain** after 3 minutes without a heartbeat. Periodic scheduling is not implemented.
- Missing historical baseline exposures are not fabricated. Outcomes are client reports; lost telemetry cannot prove voluntary departure.

The PD04A schema has already been applied to Neon. PD04D adds no new schema or Vercel secrets.

## Development

```bash
npm install
npm test
npm run typecheck
npm run lint
npm run build
```

## Roadmap

PD05: randomized experimental evaluation, stable tactic identities, and evidence-based learning.
