# PD12C — Local Reactive Intelligence

New sessions use `pd12c-v1`. Adaptive model mutations retain the PD12B full-scene/atomic-patch choices but **must** result in at least one `scene.reflexes` rule. A patch may preserve or replace the rule set.

## Allowed local rule contract
`{id,targetId,trigger,threshold,effect,text}`
- `targetId` must be an existing, validated generated block.
- Triggers: `hover`, `click`, `near` (pointer enters a 72 px region), `idle` (seconds without input).
- Effects: `reveal`, `conceal`, `highlight`, `shift`, `replace` (bounded text).
- Max 8 rules per scene, one-shot per rule per exposure. Event thresholds 1–6; idle threshold 1–30 s.
- Native browser events drive immediate reactions without another network request. No code execution, navigation, concession, focus manipulation, microphone/camera access, device identification, or off-page sensing.

The model can set a meaningful trigger and response, for example acknowledging that an on-page object was repeatedly approached; it cannot claim knowledge of private behavior. Rules are bounded by the same validator and safely execute only inside SceneCanvas. Browser DOM element IDs are never sourced from arbitrary selectors; target references are validated slugs.

## Telemetry and replay

A new optional `behavior.reflexEvents` array summarizes activations as `{exposure,id,count}` (maximum 48 entries), without cursor coordinates or raw keys. A model mutation receives the rule activation deltas in the behavior context, alongside pre-existing scene interaction counts. Read-only Observatory replay never activates local reflexes; exact intermediate local animation states are not reconstructed.

## Acceptance
1. In a new adaptive round, inspect a generated scene with at least one reactive rule.
2. Trigger the specified local gesture by hovering, approaching, clicking, or pausing. Observe an immediate component change *before* any new mutation or network response.
3. Do not interact; verify only idle-based rules may trigger and that the page never redirects or changes game focus state automatically.
4. Verify the same one-shot rule does not repeatedly fire until another model exposure resets it.
5. Inspect the session's heartbeat `reflexEvents` in the Observatory; only aggregate rule ID/count/exposure should appear.
6. Verify the original pagehide/blur/concede rules and single external-link whitelist remain intact.

The `npm run build` prebuild suite includes `tests/pd12-reflex.test.mjs`, but a human browser acceptance pass is required to establish the subjective sense of awareness.
