# PD13A — Isolated model-authored environment laboratory

## Scope and non-goals

PD13A introduces an **administrator-only** laboratory at `/sandbox-lab` for generating original model-authored HTML, CSS, and JavaScript environments. It does **not** change production sessions, their engine versions, protected focus-loss rules, concession control, or the Observatory's records.

The prior PD12D scene system continues to power every live adaptive round.

## Interface

An authenticated Observatory administrator can enter a short creative direction and request a generated code artifact. The API asks the currently configured model for a single JSON object:

`{version:1,html:string,css:string,js:string}`

Size limits: 12,000 characters HTML, 12,000 CSS, and 8,000 JS. A local interactive fixture lets administrators validate the sandbox without making a model call.

Generated code is rendered with `<iframe sandbox="allow-scripts" srcDoc={...}>`, without `allow-same-origin`, `allow-top-navigation`, or `allow-popups`. The embedded frame declares a restrictive Content Security Policy disallowing network connections, external scripts, workers, frames, forms, and external assets. Its only communication channel is a nonprivileged, nonce-bound, source-checked postMessage protocol that reports limited on-frame click events using `data-world-id`.

**The lab does not provide any privileged command endpoint:** it cannot call the game's concession handler, choose an outbound navigation URL, read the host's session credentials, or modify protected game chrome.

## Explicit limitations / review gates

This sandbox is a **browser permission boundary, not a CPU- or memory-quota VM**. Model-authored JavaScript may be inefficient or crash/hang its renderer process. The client cannot reliably terminate synchronous runaway script execution on the same event loop. This is why generated JS is not connected to live rounds.

Further security review is required before live adoption: a process-separate origin, hard execution/time budgets, stronger code validation or a metered runtime, explicit separation of untrusted frame focus from true window focus loss, server-side acceptance and versioned artifact persistence, and safe replay without executing stored untrusted code.

The API is gated behind the existing Observatory admin session, rejects cross-origin requests, bounds input length, uses a best-effort per-instance cooldown, does not persist prompts or generated code, and does not log user content. This is a lab experiment, not public generation infrastructure.

## Acceptance procedure

1. Authenticate at `/observatory`, then open `/sandbox-lab`.
2. Confirm the built-in fixture shows a circular glyph that moves when approached and changes when clicked. Its reset button restores state.
3. Check the on-page log: clicking elements with `data-world-id` produces only a bounded click signal. The underlying game session must not start, lose focus, or change state.
4. Enter a creative direction and press **GENERATE A WORLD**. Verify an original HTML/CSS/JS environment appears without reloading the experiment shell.
5. In browser dev tools, verify the iframe's sandbox attribute contains only `allow-scripts`, and the document's origin is opaque. Verify no external network requests, popups, top-level navigation, or privileged game effects occur.
6. Verify model authentication errors, timeout/invalid code, and rate limits are presented in the lab without changing the live PDNRH experiment.
7. Validate an unchanged live adaptive round continues to use the PD12D scene engine.

Tests: `tests/pd13-isolation.test.mjs` executes as part of Vercel prebuild.
