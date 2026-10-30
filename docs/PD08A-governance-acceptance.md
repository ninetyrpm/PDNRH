# PD08A Governance Acceptance — 2026-10-30

## Scope
Production Neon database transition and audit acceptance. Production Vercel deployment at `904a3db4c25ae6132fa97a5995eae52767e55659` reported READY.

## Results
1. Initial singleton policy: `uniform`, revision 1. Empty audit trail.
2. Transitioned database state to `eligible_preference`, revision 2.
3. Recorded revision 2 audit: `uniform → eligible_preference`, rationale `PD08A acceptance test`.
4. Restored `uniform`, revision 3, and recorded revision 3 audit with rationale `PD08A restore randomized policy`.
5. Attempted update with stale expected revision 1. Database returned zero rows. Current policy remained `uniform`, revision 3.
6. Verified both audit rows persisted in revision order.

## Acceptance boundary
This tests the Neon revision guard and persistent audit history. The actual admin-authenticated `POST /observatory/policy` browser flow and atomic CTE logging were **not** exercised. The transition used direct SQL and therefore does not prove route authentication, HTTP responses, form UX, or CTE atomicity.

**Final state:** `uniform`, revision 3, preference selection disabled.

## Follow-up
Complete browser-admin smoke test without disclosing password. Validate rejection of unauthenticated requests and stale-form submissions; confirm reason and revision on screen. Review transition + audit atomicity and concurrency before promoting broader governance changes.
