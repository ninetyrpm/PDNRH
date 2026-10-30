# PLEASE DO NOT REMAIN HERE

## PD05A — Observational evidence (no adaptive learning yet)

The database migration `db/migrations/0002_evidence_views.sql` creates three read-only views:

- `pdnrh_session_evidence`: one row per round, including assignment, exposure completeness, observed duration, confirmed loss, uncertain/censored status.
- `pdnrh_cohort_evidence`: raw counts by *randomized* assignment, with uncertain/active sessions reported separately.
- `pdnrh_tactic_observations`: exposure order and duration, observed final exposure before a reported loss. This is **temporal association, not causal attribution**.

Stable tactic identities are stored in `tactics`: `baseline`, `scripted_<strategy>`, `model_fallback`, and `model_exploratory`. The model-provided `mutation.strategy` string is retained as a claimed strategy label, but it is not treated as a reproducible treatment. Model-generated copy is grouped under an explicitly exploratory category.

**Do not compare simple confirmed-loss average durations as unbiased causal estimates.** Those omit censored/ongoing observations and users can appear in multiple sessions. Our current few sessions do not justify a learning policy.

PD05A does not alter the existing game selector. PD05B should introduce a finite, versioned tactic library with predeclared variants, consistent exposure windows, and sufficient randomized samples before using a bandit algorithm. No admin dashboard or automatic scheduling is added.

## Development

```bash
npm install
npm test
npm run typecheck
npm run lint
npm run build
```

## PD05C — Conservative selection

Migration `0003_tactic_assignment.sql` adds immutable per-session `tactic_family` and `tactic_policy` fields. For adaptive sessions, the server checks completed experimental observations and preassigns a treatment when opening the session. New sessions use `uniform-v1` while any tactic family has fewer than 30 confirmed-loss observations or baseline control has fewer than 30. After the threshold, `bounded-v1` retains 20% allocation for every family and 40% additional probability for the family with shortest observed mean time to loss. This is an exploratory observational heuristic, **not** evidence of a causal difference or proof of improvement. Session selection is stable once recorded and controls remain allocated 80/10/10.

The policy explicitly excludes active and uncertain records, but confirmed-loss-only means remain subject to censoring, repeated-player effects, exposure timing artifacts and self-selection. This policy must be reviewed before calling it scientifically validated. No background scheduler is added.
