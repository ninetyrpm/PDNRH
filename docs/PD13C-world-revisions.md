# PD13C — Versioned model-authored world revisions

The authenticated Sandbox Lab now offers **REVISE CURRENT WORLD**. Revision generation takes the existing HTML, CSS and JavaScript, the creative direction, and aggregate on-frame interaction counts. The model returns replacement source only for the sections it wants to change. Unspecified source sections are preserved. Each revision must change at least one section and pass existing strict size/type validation.

A maximum of eight source versions is held in the browser React session. Previous versions can be selected and rerendered. Version history is not persisted in Neon or browser storage and is lost on refresh; this is a deliberate laboratory limitation.

## Limited continuity across code replacements

Worlds may optionally expose `window.PDNRH_EXPORT_STATE=()=>({...})`. The untrusted iframe responds to parent snapshot requests only through a nonce-bound message. The parent accepts only a flat object with at most sixteen bounded numeric, boolean or short safe-string properties. These values are reintroduced into the next iframe as `window.PDNRH_SEED_STATE`. This does **not** snapshot arbitrary DOM, canvas, animation queues or JavaScript closures. A model must explicitly implement export/restore semantics for its relevant local state.

The state is not sent to the model by default or stored externally. The model receives only aggregate counts for up to 24 named click targets, ready-event count, and elapsed seconds. It receives no pointer coordinates or typed content.

The revision endpoint is administrator authenticated and same-origin restricted. It uses the same configured model, completion budget and deadline as the initial generation lab. Failure categories distinguish truncation, invalid JSON and invalid/no-op revisions.

## Manual acceptance

1. Generate a world, interact repeatedly with one named object, then choose **REVISE CURRENT WORLD**.
2. Verify a new source version appears, model rationale is visible, and unchanged code sections remain byte-for-byte identical.
3. Choose a previous version to verify it can be rendered independently.
4. For a world with state export support, perform actions, revise, and confirm the new world can read the bounded seed state.
5. Verify source and history are lost on browser refresh; no revisions appear in live PD12D sessions or their Observatory.
6. Repeated clicks must not be treated as proof of persuasion; they are local observation signals.

Build checks cover the new code and isolation boundaries. Browser acceptance and security review remain prerequisites for live deployment of authored code.
