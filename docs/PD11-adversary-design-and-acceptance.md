# PD11 — Behavioral adversary implementation

## Capability boundaries

### PD11A (privacy-constrained observation)
Browser observations are cumulative aggregate counters: pointer travel distance, pointer reversals, approaches near the existing concede control, concede clicks, scroll direction/reversals, viewport size band, and existing elapsed/click/idle counters. Positions are transient browser-side only; no raw coordinates, typed characters, key names, microphone, camera, location, or interactions outside the page are collected. Behavior schema is version 1 and is validated server-side before heartbeat/loss persistence.

### PD11B (source-authoring illusion)
The adversary may create an entirely new screen composition using a validated `scene.version=1` object with up to 12 component blocks. It may add/remove/reorder panels, headings, paragraphs, labels, rules, graphics glyphs, buttons, and animations. Buttons have only 4 allowlisted actions: none, reveal, toggle (local state), and concede (the existing protected voluntary concession). No arbitrary JavaScript, HTML, CSS, external links, network calls, OS impersonation, or rules modification is accepted. The server validates the scene and the browser renders it using fixed components; historical text-only mutations still work. Session replay renders scene blocks read-only.

### PD11C (session-level strategy memory)
The mutation API loads the recent **recorded** exposures and heartbeat aggregates from Neon. It gives the LLM a short window of prior strategies, expressed behavioral hypotheses, expected responses, and measured changes since the prior heartbeat. The LLM is instructed to interpret behavior as tentative evidence, not proof of private states, and to change its approach while remaining within its randomized tactic family. `hypothesis` and `expectedReaction` are bounded mutation metadata recorded in exposure JSON and shown in the Inspector. The prompt may mention actual observed events, but must not claim external surveillance or personal insight.

All newly created rounds carry `sessions.engine_version='pd11c-v1'`; older rounds remain `legacy-v1`. Engine generations must be analyzed separately and not pooled as equivalent treatments. The existing governance policy stays uniform/frozen until explicitly approved.

## Acceptance steps

1. Start a new active round; interact with the page by scrolling, approaching the concede button and moving the pointer. Let at least one 15-second heartbeat and one mutation occur.
2. Confirm there is no focus-loss false positive while moving the pointer within the page; switching tabs still ends the round.
3. In Observatory Session Inspector, confirm heartbeat `behavior` v1 summary contains numeric counters but no coordinates or key text.
4. If the round was assigned adaptive and the model succeeded, confirm the generated exposure contains `hypothesis` and `expectedReaction`, and a `scene` when the model elects to generate one. A fallback or static-control exposure may have none.
5. If the scene contains a reveal/toggle button, click it; it must only reveal/hide its local content. Concede buttons must end the round; no interaction should navigate away automatically.
6. Open the visual replay for that session. Confirm scene layout appears, controls cannot concede, and recorded exposure intervals are shown accurately as server-observed approximations.
7. In Experiment Operations, verify an `pd11c-v1` engine inventory row and unchanged uniform governance.

## Limitations

Browser-derived telemetry remains client-reported and can be spoofed; the model has no independent sensor. The 15-second heartbeat cadence means short-lived reactions are partially aggregated and may be missed. The model does not edit the repository or execute arbitrary code. Dynamic page creation is limited to approved visual components and safe local interactions. Current model effectiveness remains unproven; no cross-session learning is activated.
