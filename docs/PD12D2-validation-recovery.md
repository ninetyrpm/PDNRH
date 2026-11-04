# PD12D.2 — Recovery from rejected model outputs

## Production diagnosis

After PD12D.1 fixed provider timeouts, the model began completing reliably (approximately 7–11 seconds), but many completed responses were rejected by a generic `invalid_model_output_or_missing_scene` gate. The November 3 run `57c25c69-d20d-4450-8be4-7ecde81a6334` recorded three fallback exposures and no model exposures; another contemporary run successfully recorded a valid PD12D model mutation. Provider runtime logs showed `finishReason: stop` and nonempty response bodies for failed requests. That establishes a **model-output validation** problem, not another timeout.

## Repair

For **PD12D only**, the route now uses a small, deterministic compatibility compiler between JSON decoding and the strict runtime validator:

- Requires a **model-authored strategy plan** with a valid approach and a model-authored scene or a valid patch against a recorded scene.
- Retains the already-approved fixed outbound URL, controlled navigation actions, and scene/patch whitelist.
- Fills missing nonstrategic boilerplate: block defaults, harmless visual/interaction affordances where possible, default one-shot local hover reflexes, and optional cosmetic field defaults.
- Uses final `validateMutation` and `validateScene` checks; never permits HTML, JavaScript, arbitrary URLs, invalid link actions, unbounded content, or an ignored mandatory strategy pivot.
- Rejects malformed or unsafe output, missing strategic plans, impossible patches, and no-op scene changes.
- Logs **categorical reasons and safe normalization codes only**, not raw model content or user-specific telemetry.

The UI still distinguishes model-generated mutations from scripted fallbacks. These repairs are deterministic, bounded application-generated scaffolding around model-authored strategy and copy. They do not constitute user-level learning or an effectiveness evaluation.

## Regression tests and acceptance

The preview build runs `tests/pd12-compiler.test.mjs` along with all previous PD12 tests. Tests cover full outputs, sparse-but-safe outputs, persistent patches, mandatory pivot enforcement, missing plans, and unsafe URLs/scripts/actions.

A new adaptive round remains necessary for runtime acceptance. In Vercel, inspect `output_rejected` codes and `safe_normalization` counts. In Neon, check the model/fallback exposure ratio and that strategy state persists. If fallbacks remain frequent, prefer addressing the dominant logged failure category instead of loosening the safety boundary again.
