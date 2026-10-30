# PLEASE DO NOT REMAIN HERE

An adversarial attention experiment. The visitor must keep the game tab in focus; the AI attempts to persuade a voluntary exit.

## PD03 — First page mutation engine

A round begins with an explicit consent gate. Five seconds after entry, the page requests its first tactic; subsequent mutations are scheduled 15–90 seconds apart. Model output is validated against a fixed, text-only schema. The model can change headline, copy, three predefined visual styles, layout, and the wording of the concession button, but it cannot run JavaScript, navigate, alter the timer, intercept focus, or change win conditions. Model text is always escaped by React.

The server calls OpenAI's Chat Completions API using `OPENAI_API_KEY` and optional `OPENAI_MODEL` (default `gpt-4.1-mini`). The key stays on the server. Without a key, or on provider failures/invalid responses, the endpoint uses locally scripted tactics and identifies that fallback in the UI. Best-effort per-instance 12-second IP cooldown protects the public route; production-scale throttling, persistent experiment outcomes, and durable server-side sessions remain for PD04. Because the endpoint is public, do not configure an uncapped API budget.

The model receives compact counters and recent tactic names, not raw user activity or history. PD03 is adaptive within one round; **it does not yet learn across visitors**.

## Development

Node.js 20.9+:
```bash
npm install
npm test
npm run typecheck
npm run lint
npm run build
```

Copy `.env.example` to `.env.local` for local development or set the same variables in Vercel project Settings → Environment Variables, then redeploy. No Neon database is needed yet.

## Game mechanics

The first `blur`, hidden `visibilitychange`, or `pagehide` after BEGIN ends the round and freezes the clock. Explicit concession also ends it. `sessionStorage` stores a best-effort local active-round marker for reload detection. Cross-tab persistence and definitive departure accounting require a backend.
