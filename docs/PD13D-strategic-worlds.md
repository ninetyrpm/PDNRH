# PD13D — Strategic model-authored world revisions (admin laboratory)

PD13D adds **STRATEGIC REVISION** alongside the freeform PD13C revision action. The model receives the full current authored world, aggregate named click counts, elapsed time and the prior bounded strategy history. It returns a structured hypothesis plus a code revision:

`{plan:{version:1,approach,hypothesis,intendedDepartureSignal,observation,changeReason},revision:{version:1,rationale,html?,css?,js?}}`

The approach vocabulary is curiosity, closure, subtraction, direct, disruption, alternative, negotiation.

## Objective and experimental limits

The strategic prompt orients the model to *voluntary departure*, not simply amusing the participant. However, this laboratory has **no live game or genuine exit mechanism**. Any controls labelled exit, leave, depart, concede or outbound are **inert local indicators**. Their clicks count as weak departure-proximity proxies only; they cannot trigger actual navigation, concession, or focus loss. Raw clicks and even these proxies cannot establish persuasive effectiveness.

The directive compares the last two recorded strategic revisions for evidence of departure-related interaction. After two zero-signal cycles, it requires a changed approach and a materially altered HTML or JavaScript program. Merely changing an approach label or recoloring a scene is insufficient. The guard uses a simple source-text difference proxy (minimum 80 changed characters and meaningful interaction/markup change); it does not prove semantic novelty and may reject useful minimalist interventions. This is an initial guard, not outcome evaluation.

The admin lab displays the plan, observed interaction counts, intervention rationale, exit-labelled counts and changed-source estimate for each revision. Strategy history is in-memory and bounded to eight entries. A freeform revision, restoring an earlier version, or generating a fresh world resets strategic history.

## Boundaries and validation

- Model-authored code still executes only inside the administrator lab's opaque-origin iframe.
- The protected game shell, production PD12D mutation endpoint, session policy and whitelisted navigation are unchanged.
- No anonymous browser data or model-generated source is persisted to Neon by this feature.
- The strategic revision API is authenticated, same-origin restricted, input bounded, cooldown restricted and code validated.
- The iframe's 120-second lifecycle is only a UI watchdog, not a guarantee of CPU, memory or malicious-code isolation.

## Acceptance

1. Generate or open a world in /sandbox-lab, click its named controls repeatedly, then choose STRATEGIC REVISION.
2. Verify the model provides a readable hypothesis, assessment and reason for changing its environment.
3. Repeat across multiple versions without clicking exit-labelled controls. After two zero-proxy revisions the next accepted strategy must switch approach and materially change the world program.
4. Compare source versions and confirm the code—not merely the written plan—changed.
5. Confirm selecting an older version, restoring fixture or making a freeform revision resets the strategic history.
6. Verify no public PD12D session uses the generated source and no exported local state grants host privileges.
7. Review model failures separately: preview build is only structural acceptance. A real browser test is still required to verify generated revisions execute coherently.

Post-lab roadmap: independent execution isolation with resource limits, trusted host action bridge subject to fixed game rules, revision persistence/replay, then conditional live trials; outcome evaluation remains separately scoped.
