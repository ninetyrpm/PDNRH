# PD13E — Autonomous authored-world production experiment

## Runtime

The root route now renders the PD13E live game by default. The previous PD12D client is preserved at `/legacy` and as a root rollback via `PDNRH_GAME_ENGINE=pd12d` (redeploy required). The new client creates an explicit `pd13e-v1` adaptive session; legacy bodyless session creation still yields PD12D.

After the participant starts a round:
1. The protected shell starts its clock, focus/visibility/pagehide monitoring, concede control and 15-second heartbeats.
2. The session-authenticated `POST /api/world/mutate` generates an original HTML/CSS/JS world. The initial world is recorded as ordinal 1.
3. An opaque-origin `iframe sandbox="allow-scripts"` runs the world. No frame-controlled concession, top-level navigation or parent DOM access is granted.
4. The parent captures bounded named on-frame clicks and optionally a small anonymous state export. After a scheduled 45-second exposure—or earlier after eight clicks and a minimum 25-second exposure—it automatically requests a strategy-guided revision.
5. The server reads the previously recorded world, recent strategies, assigned tactic and current bounded observations; validates a model-authored revision and stores the complete resulting source. A new iframe receives the previous bounded state if exported.
6. Failure leaves the last authored world visible, reports the failure class to the participant and retries after 20 seconds. The client never silently substitutes a scripted world.

An initial session can require tens of seconds for generation. All requests use a 48-second provider timeout and Vercel maxDuration 60s.

## Data

The migration `db/migrations/0009_pd13_world_exposures.sql` creates `pd13_world_exposures`. It has been applied to Neon. Rows are immutable per `(session_id,ordinal)`, contain the complete authored source, optional plan and triggering observations, and are only written for an active `pd13e-v1` session with the correct credential. Duplicate submissions cannot overwrite a prior source.

The Observatory list shows PD13E world counts and links to `/observatory/worlds/[id]`, an authenticated **read-only** inspector displaying source, plans and observations without executing stored code.

The PD13E adaptive cohort is excluded from the existing PD12D tactic-selection evidence to avoid contaminating the previous experimental arm statistics. Formal model effectiveness evaluation remains deferred.

## Guardrails and known limitations

- The shell alone records terminal events and controls the concession button. Frame clicks are interaction signals, not evidence of persuasive success.
- The iframe remains a browser permission boundary, NOT hard CPU/memory isolation; malformed generated JavaScript can still hang a browser process.
- The old 120-second iframe lifetime may unload a world if generation repeatedly fails; restarting the round or successful revision reactivates the world. This is a runtime limitation requiring acceptance testing.
- Browser focus when entering an iframe needs real cross-browser acceptance. The parent defers its blur verdict by 100 ms and verifies top-level `document.hasFocus()` before declaring a blur loss. Do not weaken the focus-loss policy to accommodate a frame without testing.
- World generation is model-authored, not a predefined scripted fallback. It does not yet expose a controlled external-link capability. Protected concession remains the only deliberate in-app terminal action.
- A live game is not a guarantee of a private deployment: the domain is reachable by anyone with its URL unless deployment authentication or other access restrictions are configured.
- The Observatory's source audit is reconstructive, not a full interactive replay. Browser state, frame timing and undocumented interactions cannot yet be reproduced.
- Switching the root `PDNRH_GAME_ENGINE` environment value to `pd12d` and redeploying restores the previous PD12D engine. Existing recorded sessions remain unchanged.

## Acceptance test

**Route: `/`**
1. Start a new round. Expect `PD13E` in the header, a session connection status, then `Generating environment`.
2. After generation, expect an original authored iframe, `exposure 1`, and an active timer. Interact with its elements; the parent timer and protected concede control must remain visible.
3. Click inside the frame, then move within it; the round must remain active while the browser window is genuinely focused.
4. Continue for 45 seconds after first exposure or interact at least eight times over 25 seconds. Expect `Strategic reassessment`, followed by `World revised · cycle 2` and a changed environment.
5. If generation fails, the last environment should remain and the status should say it is retrying rather than reverting to scripted fallback.
6. Focus a different window or switch tabs. The round must terminate, and the terminal reason should be recorded. Re-entering the frame itself must not end the round.
7. Test concession via the shell's `I GIVE UP` control; verify exactly one terminal outcome.

**Route: `/observatory`**
8. Find the newest `pd13e-v1` session. The authored world count should match accepted exposures.
9. Open `/observatory/worlds/<id>`; confirm each world source, plan and triggering observations are present. Do not execute stored code in the inspector.
10. Verify PD12D legacy pages and API remain available separately at `/legacy`.

**Required before external launch:** browser focus tests in Chrome, Firefox and Safari; hostile-code and resource-exhaustion isolation testing; production access control; safer source replay and failure recovery.

Build/typing tests are necessary but cannot independently establish browser-level model reliability or sandbox execution safety.
