# PLEASE DO NOT REMAIN HERE

A human wants to stay. A website wants the human to leave.

## PD02.1 — Focus is survival

Rounds have an explicit **BEGIN EXPERIMENT** gate. Once begun, the first browser `blur`, hidden-document `visibilitychange`, or `pagehide` ends the game; **I GIVE UP** does the same. The clock freezes permanently on loss and the page shows the reason. A reload of an active game displays a notice that the previous round ended. Reloading after a loss starts a fresh ready state.

Important constraints: browser focus/visibility events can fire for operating system interruptions and are not proof of voluntary departure; closing a tab cannot display the loss page. PD02.1 persists only a local active-round marker in sessionStorage (not analytics or a durable record). Clearing storage or opening a different tab bypasses cross-load accounting. A backend is required for tamper-resistant outcome tracking.

## Development

Node.js 20.9+:
```bash
npm install
npm test
npm run typecheck
npm run lint
npm run build
```

## Deploy

Import `ninetyrpm/PDNRH` into Vercel using Next.js. No environment variables yet.

## Roadmap

- **PD001** — Next.js foundation
- **PD02** — visitor timer and milestones
- **PD02.1** — focus-based terminal outcome and explicit entry
- **PD03** — schema-validated LLM page mutation
- **PD04–PD06** — Neon persistence, experiment learning, observatory
