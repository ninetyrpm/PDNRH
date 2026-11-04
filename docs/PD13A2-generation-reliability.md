# PD13A.2 — Sandbox generation reliability

The administrator Sandbox Lab originally requested complete HTML/CSS/JS in JSON mode with a 3,800-token output cap and unconditionally passed the returned message to JSON.parse. It did not inspect the completion finish reason, so truncated outputs and malformed outputs produced the same generic error.

## Repair

- Use a concise source target: 1,200–2,200 HTML characters, 1,500–2,800 CSS characters, and 1,000–2,200 JS characters. These are targets, not relaxed security limits. Structural limits in sandbox-world remain unchanged.
- Raise completion cap to 6,500 tokens and provider request abort time to 50 seconds.
- Centralize response classification in sandbox-generation.ts; distinguish `truncated` (finish_reason length), `malformed_json`, `empty`, `refused`, and `invalid_world`. Always verify structure with the existing validateWorld.
- Log only failure category, completion status, token usage and output length; never log generated source code, creative direction or admin credentials.
- Preserve admin authentication, iframe isolation and separation from the production adversarial engine.

## Acceptance

1. Log into the Observatory and open /sandbox-lab.
2. Submit a short creative direction and confirm a working model-authored environment is rendered.
3. If generation fails, verify a specific error appears rather than `Generated response was not valid JSON`.
4. Inspect Vercel logs for `[pdnrh:sandbox] generation_result`: finishReason, outputLength, completionTokens and category should be present without source content.
5. Repeated generations must remain admin-gated and cooldown-limited.

Build tests cover each classification branch. The passing preview build does **not** establish that the provider will return complete JSON during a real authenticated request; that remains a live acceptance check.
