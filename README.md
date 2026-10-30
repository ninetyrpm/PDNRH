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
