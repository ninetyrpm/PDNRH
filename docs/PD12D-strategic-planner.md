# PD12D — Strategic Planner

Engine: `pd12d-v1`. This milestone implements within-session strategic decision-making, **not** outcome/effectiveness evaluation (deferred).

## Departure-oriented strategy loop

Every successful adaptive model output must include a validated `plan`:
`{version:1,approach,exitMechanism,expectedExitSignal,thesis,assessment,changeReason}`.

The allowed approaches are `curiosity`, `closure`, `subtraction`, `direct`, `disruption`, `alternative`, and `negotiation`. The terminal mechanisms are the existing voluntary concession, ordinary focus loss, or a link to the **sole fixed-whitelist destination** `https://www.youtube.com/watch?v=dQw4w9WgXcQ`. The model cannot select a new URL or change the focus-loss rule.

A deterministic server-side planner evaluates only first-party, aggregate indicators:
- near-concede approaches, and hovers on generated *outbound link* components: weak **departure-proximity proxies**;
- clicks on other generated objects: **engagement**, not progress toward departure;
- the previous persisted approach, stalled cycles, and bounded plan history.

After two consecutive accepted cycles with no new departure-proximity signal, the next request requires an approach change. An LLM response that ignores the pivot requirement or omits the structured plan is rejected and replaced with a clearly attributed scripted fallback. The model is instructed to abandon repetitive motifs, use subtraction and genuine offers to leave, and avoid unproductive entertainment loops, while retaining its assigned randomized tactic-family thesis.

The server stores each accepted plan's durable state in `session_strategy_state` (`revision`, `state`, `updated_at`) using a monotonic upsert. The mutation's `plan` is additionally persisted with the recorded exposure for review. The state includes the current approach, stalled cycles, pivot count, recent plans (max eight), and aggregate proxy counts. It does not store identity, browser history, raw coordinates, or user text.

## Design caveats

The state is committed when a model mutation is accepted for delivery, *before* browser-confirmed presentation. A focus-loss race may therefore leave a plan in durable strategy state without a corresponding observed exposure. Evaluation of actual displayed behavior must use the exposure record. Client-reported observations are provisional, and even a rising departure-proximity proxy is **not** proof of persuasion. This milestone deliberately leaves treatment-effect estimation and self-reported reasons for termination to PD12E.

The existing Uniform / Frozen tactic policy (revision 5) remains unchanged. New engine version labels prevent false comparison with earlier runs.

## Acceptance

1. Start a new adaptive round and let several model mutations run. Control rounds must still follow their prior paths.
2. Inspect each model exposure in Observatory. It should contain `plan`, `hypothesis`, `scene` and a targeted interaction experiment. All generated visual scenes and bounded reflexes remain constrained by PD12B/C.
3. After two cycles with no *new* concede proximity or link-hover evidence, verify the next accepted model output changes `plan.approach`, substantially changes its persuasion strategy, and explains the pivot in `changeReason`. An invalid non-pivoting response must become a labeled fallback.
4. Inspect **ADVERSARY STRATEGIC STATE** in the session Inspector. Confirm revision, stalled cycles, pivots, and recent plan history appear and persist after refresh.
5. Check `session_strategy_state` in Neon and ensure no row is created for a control-only session.
6. Verify normal links still use the single hardcoded YouTube URL; focus changes, concessions, and the fixed outcome rules remain unchanged.
7. Review model-versus-fallback ratios. A successful build does **not** guarantee that the model can reliably produce valid strategy and scene JSON within its timeout.

The Vercel prebuild runs `tests/pd12*.test.mjs` before the Next.js build.
