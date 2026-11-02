# PD09A — Operations acceptance and data integrity audit

Date: 2026-11-02. Source: production Neon `weathered-star-16299018`; verified against the PD09 operations queries.

## Observed database totals
- Sessions: **10**; confirmed losses: **10**; uncertain: **0**; active: **0**.
- Adaptive legacy/unassigned: **5** confirmed losses.
- Adaptive assigned `curiosity_reversal`: **1** confirmed loss, `uniform-v1`.
- Baseline control: **4** confirmed losses, including **3** legacy sessions without selection-policy label.
- Static control: **0**.
- Policy inventory: `uniform-v1` 1, `control-v1` 1, null/legacy 8.
- Integrity: missing baseline exposure **7**; missing adaptive tactic **5**; unclosed terminal exposures **0**; invalid completed durations **0**; stale active sessions **0**.
- Governance: `uniform`, revision **5**.

## Finding PD09A-01: hidden legacy adaptive group
The original PD09 query grouped 5 unassigned adaptive sessions under `adaptive`, but the UI enumerated only named tactic families and two control cohorts, silently omitting those five rows from the collection progress display. This PR groups these records as `legacy_adaptive` and shows the cohort explicitly, without applying the 30-completion tactic target to historical unassigned observations.

## Interpretation
The 7 missing baseline exposures and 5 missing assigned tactics are historical instrumentation limitations, not evidence of current-session failures. No retrospective baseline or tactic assignment was invented. The operational dashboard is descriptive, **not** sufficient to infer learning or treatment effectiveness.

## Acceptance boundary
Production Neon SQL cross-check completed. Vercel preview build checked separately. Authenticated browser comparison of rendered values is still pending and should be performed after deployment. No data was modified during audit.
