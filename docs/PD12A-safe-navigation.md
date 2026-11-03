# PD12A — Single-destination external navigation

## Destination and safety boundary

The only outbound URL in the adversary-authored scene renderer is:
`https://www.youtube.com/watch?v=dQw4w9WgXcQ`

The model can add a scene block with `kind: "link"`, `action: "navigate"`, and a text label, but it **cannot** select the URL, alter a target, supply an href, or run script. `validateScene` normalizes to allowlisted fields and rejects mismatched kinds/actions and embedded URLs. SceneCanvas uses a **code-owned** `DEPARTURE_URL` constant without forcing an on-page destination warning. The ordinary browser status-bar URL remains inspectable on hover. Links navigate in the same tab by default, only after an explicit user action. Control and replay surfaces do not gain functional outgoing links.

The `pd12a-v1` engine preserves mandatory generative scenes and prior randomized tactic assignment. A link can satisfy the interactive scene requirement, but the model may also choose reveal/toggle buttons.

## Outcomes and telemetry

Original focus-loss rules are unchanged: an intentional same-tab outbound click ends the round as `confirmed_loss` with `loss_reason=pagehide`. An independent, optional `sessions.exit_channel='allowlisted_external_link'` identifies the outbound affordance. This channel is also included in loss event payload and outcome evidence. Existing pagehide data remain unchanged; no original loss-reason constraint is modified.

The terminal event is posted with keepalive *before* the browser follows the native link. Delivery remains best-effort under abrupt navigation or network failure. Modified-key clicks that open new tabs are not explicitly classified as same-tab link departures; any focus loss continues to apply existing rules.

## Deployment and acceptance

Migration `0007_departure_channel` adds the nullable `sessions.exit_channel` column without dropping constraints or rewriting outcomes. It must be applied prior to deploying code which writes that column.

Manual test:
1. Start a round. Only adaptive rounds have model-generated scenes; controls retain their existing behavior.
2. If the model provides an outgoing link, confirm there is no forced destination warning; hover or inspect the link and verify the browser link target is **exactly** `https://www.youtube.com/watch?v=dQw4w9WgXcQ`.
3. Click it normally. The browser should navigate in the same tab. Avoid testing with unsaved browser content, because this ends the round.
4. Return to the Observatory via a new tab or browser back navigation; inspect the round. It should be a confirmed loss with reason `pagehide` and exit channel `allowlisted_external_link`.
5. Verify an ordinary tab switch/reload remains a loss without the outbound channel; verify local reveal and toggle interactions remain on-page.
6. Verify the replay renders any outgoing-link affordance as **noninteractive**.
7. Verify Neon governance remains Uniform / Frozen, revision 5.

This is capability validation, **not** evidence that external navigation improves persuasion. The model may never offer a link during a particular run. The user's reasons for leaving remain unmeasured and may require a separate, explicitly collected post-round survey.
