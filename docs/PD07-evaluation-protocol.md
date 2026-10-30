# PD07 — Experimental evaluation protocol (v1)

## Research question
Does assignment to a particular **versioned tactic family** change the duration of a voluntary browser-focus challenge compared with the predeclared controls? This is distinct from asking whether a specific LLM-generated phrase caused departure.

## Unit and treatment
A round is the recorded unit; users can repeat rounds, so rounds may not be independent. Record the original random assignment and session-level tactic family as the intent-to-treat exposure. Do not reassign groups based on what the model generated or what was ultimately displayed.

## Outcome and horizon
Primary candidate endpoint: confirmed focus loss or concession **within 120 seconds** of session start. For each round, separately report: confirmed event within horizon, confirmed event after horizon, still-active/unknown before horizon, and missing/unusable elapsed time. Do not silently count unobserved outcomes as survival or defeat. The current dashboard presents **descriptive counts**, not inferential effect estimates.

Secondary descriptors: elapsed time for confirmed losses, distribution of reported loss reasons, exposure count, and data completeness. Mean time among completed losses is not an unbiased measure of treatment efficacy.

## Analysis rules
1. Preserve baseline_control and static_control as independent cohorts.
2. Compare adaptive assigned tactic families from PD05C onward; exclude prior rounds without stored family and policy assignment from family-level inference.
3. Do not infer causality from the last displayed mutation: sequential exposures are selected by survival and history.
4. Report denominators, unknowns, active sessions, and legacy omissions alongside each metric.
5. Because repeated visitor identity is unavailable, formal confidence intervals treating rounds as independent are unjustified until duplication is assessed or the experiment defines the unit accordingly.
6. Report assignment-policy changes, model versions, fallback frequency, and calendar period; a policy change can invalidate naive randomized estimates.
7. PD05C's 30-completion gate is **not** a statistical power calculation. Reaching it must not be represented as conclusive evidence or automatic authority to declare a winner.
8. Do not invent retrospective baselines, focus events, exact render times, or inferred reasons for failure.

## Before inferential claims
Pre-register a target effect and fixed observation horizon, sample-size/power rationale, exclusion criteria, censoring handling, multiplicity correction, decision thresholds, and repeated-user mitigation. Add durable assignment propensities and evaluation freeze dates before analyzing bounded-v1 outcomes. Prefer an independently reviewed analysis plan rather than tuning conclusions against live dashboard data.

## What PD07 implements
Read-only /observatory evaluation readiness, including horizon-based counts, incomplete-session visibility, legacy-policy counts, and selector threshold status. **No change** to the existing online selection policy, and no hypothesis testing or causal effect claims.
