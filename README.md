# PLEASE DO NOT REMAIN HERE

PD04C: server-enforced experiment cohorts and exposure logging.

At BEGIN, Neon assigns a randomized cohort: adaptive (80%), static control (10%), baseline control (10%). The first five seconds display the baseline for all cohorts. Adaptive visitors receive model tactics (or scripted fallbacks if unavailable). Static controls receive the deterministic rotating fallback tactics, with no LLM calls. Baseline controls remain on the initial unchanged page.

The mutation API authenticates the session and looks up assignment server-side. The browser reports displayed mutations, with ordinal 0 representing the baseline. Neon records exact mutation JSON, source, ordinal and server receipt time in `exposures`. On recording a subsequent exposure, the previous one is closed. The first/loss update and exposure requests may race; some events may be missed, especially during navigation. Exposure receipt timestamps approximate display timestamps; they are not independently confirmed by the server. PD04D will address out-of-order writes and terminal closure, plus integrity and diagnostics.

No SQL migration required: PD04A already created the exposures table.

Existing PD04B session lifecycle, focus-loss game rules and heartbeat telemetry remain in place. No cross-session learning yet.
