# PLEASE DO NOT REMAIN HERE

A human wants to stay. A website wants the human to leave.

## PD001 / PD02

Next.js 16, React 19, TypeScript. The visitor page has a live visible-tab timer, five survival milestones (1, 3, 10, 30, 60 minutes), local click/scroll/idle instrumentation, a session identifier, and an explicit concede action. This is **not yet an LLM-driven experience**.

Sessions are in memory only; reloading starts a new session. Closing or navigating away cannot be conclusively attributed as an AI win and is not persisted. No cookies, accounts, third-party analytics, remote event collection, or persistence are implemented.

## Run locally

Requires Node.js 20.9+.

```bash
npm install
npm run dev
npm run test
npm run typecheck
npm run lint
npm run build
```

## Deploy

Import `ninetyrpm/PDNRH` into Vercel using the Next.js framework and repository root. No environment variables are required for PD001/PD02. Deploying now makes the prototype public, but **does not enable LLM page mutations or global leaderboards**.

## Future increments

- **PD03** — validated page mutation DSL and LLM integration; model cannot run arbitrary JavaScript or close/redirect tabs.
- **PD04** — Neon persistence for experiments, tactics and visitor outcomes.
- **PD05** — contextual bandit strategy selection and evolutionary learning.
- **PD06** — admin observatory, analytics and controls.
