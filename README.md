# PLEASE DO NOT REMAIN HERE

A human tries to stay focused; an adaptive page tries to persuade them to leave.

## PD04A — Persistence foundation

The Vercel Neon integration provides `DATABASE_URL` (pooled connection). Do not prefix it with `NEXT_PUBLIC_` or commit its contents.

1. Open the **Neon SQL Editor**, select the production database, and execute `db/migrations/0001_initial.sql`. This is a versioned, transactional migration.
2. Deploy current `main` on Vercel. `POST /api/sessions` then creates an opaque server-side session with a 256-bit credential, a hashed credential in Postgres, and a randomized experiment assignment (80% adaptive / 10% static control / 10% baseline control). The credential is returned once and must not be logged.
3. Optionally run `DATABASE_URL='...' node scripts/check-schema.mjs` in a secure environment to check the migration.
4. The game client is **not yet connected** to the session API; PD04B will integrate lifecycle telemetry and require authorization for session updates. No visitor events are saved by this increment.

The tables `sessions`, `tactics`, `exposures`, `events`, and `outcomes` are prepared for subsequent PD04 increments. SQL migration must be applied before calling the session creation endpoint. Schema initialization is intentionally not done at runtime.

## PD03 — LLM mutation

Set `OPENAI_API_KEY` and optionally `OPENAI_MODEL` in Vercel. Mutations use a validated text-only DSL, and the game still operates with scripted fallback if model access is unavailable.

## Development

Node.js 20.9+:
```bash
npm install
npm test
npm run typecheck
npm run lint
npm run build
```

## Game rules

Switching window, tab, minimizing, navigating, reloading, or conceding ends an active round. The focus loss signal is client-observed and may be triggered by OS interruptions; definitive attribution and durable outcome classification are future work.
