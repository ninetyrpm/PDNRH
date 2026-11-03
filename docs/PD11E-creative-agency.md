# PD11E — Adversarial Creative Agency

## Why this revision exists
PD11C produced seven genuine model mutations across two adaptive rounds, yet no model-authored scenes. All changes were primarily headline, typography, and background shifts. The model had observable telemetry, but did not use it to test interactive hypotheses.

## New adaptive contract
For sessions created at engine version `pd11e-v1`, every successful **model** mutation must include:
- A validated `scene.version=1` with at least three blocks.
- At least one non-textual block: `void`, `meter`, `glyph`, or `rule`.
- At least one local reveal/toggle button.
- A `hypothesis`, `expectedReaction`, and validated `experiment: {targetId,event,minimum}` whose target exists in the new scene.
- A structurally different composition or block sequence from the preceding recorded mutation.

The model remains assigned to the original experimental tactic family, but that family's instruction governs the persuasive thesis, **not** typography, composition, or graphical direction. Supported new layouts include poster, terminal, and mosaic, with new visual components `void`, `meter` and `marquee`.

## Observations and feedback
SceneCanvas records only aggregate hover-enter and click counts keyed by **exposure ordinal and allowlisted block ID**. The client does not send pointer coordinates, click positions, raw text, keypresses, or browser-wide activity. Counts are added to existing authenticated heartbeat and mutation telemetry. The next mutation request receives verified recorded history, a summary of component-interaction changes since the last heartbeat, and an explicit comparison of the last model-predicted interaction threshold against observed counts so far. These are *client-reported indicators*, not proof of intent or emotional state.

## What happens if a model response is inadequate?
The server rejects malformed, text-only, noninteractive, or structurally identical adaptive output and returns a clearly labeled **scripted visual fallback**, never a model-labeled result. Current static and baseline controls are unchanged. No arbitrary JavaScript or CSS is executed; no OS impersonation, access to external accounts, force-navigation, or modification of experiment rules is permitted.

## Experimental integrity
New rounds are labeled `pd11e-v1`, distinct from `pd11c-v1` and `legacy-v1`. Tactic assignment remains governed by the existing Uniform / Frozen policy; this change must not be pooled with PD11C outcomes for causal inference.

## Acceptance checklist
1. Start a new round and verify that any **adaptive model** mutation visibly replaces the content with a multi-element, interactive visual scene—not simply a headline change.
2. If the provider fails or returns invalid output, the fallback must still display a non-text visual composition and its status must explicitly read scripted fallback.
3. Move the pointer into a generated block and click a reveal/toggle button. Verify it never changes the focus rule or navigates automatically.
4. After at least one heartbeat and a following mutation, inspect the round in Observatory: verify `engine_version=pd11e-v1`, exposure mutation includes `scene` and `experiment`, and aggregate `sceneInteractions` contains only exposure ordinal, block ID, hover/click counters.
5. Confirm the later mutation includes a hypothesis/prediction informed by the previous test; the server provides a quantified previous-test result to the model, but the actual quality of reasoning still requires human judgment.
6. Verify scene replay is noninteractive and restoring the browser focus-loss rule still works.
7. Verify static and baseline controls remain text-based as before, and governance remains Uniform / Frozen.

## Limits and deferred improvements
Visual templates are purposefully bounded. Model imagination is constrained to the documented scene DSL. First-party counters can be spoofed and do not measure actual gaze. Provider latency and generation length may require a separate load/performance pass. The current API may still fall back often if the model cannot generate valid scenes; audit model/fallback exposure ratios before claiming successful creative agency. More complex graphics, procedural motion and instrumented interactive artifacts are candidate next iterations.
