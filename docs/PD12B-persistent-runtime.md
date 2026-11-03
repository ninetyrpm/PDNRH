# PD12B — Persistent Page Runtime

Engine: `pd12b-v1`. PD12A controls and fixed outbound destination remain intact.

An adaptive model may still author a complete scene, but may instead submit a **declarative page patch** as `scenePatch:{version:1,steps:[...]}`. Allowed operations:
- `create` — append a validated block or insert before a named block.
- `update` — change allowlisted component text, appearance, or interaction affordance.
- `move` — reorder a named existing component.
- `delete` — remove a named component.

Up to 10 operations apply atomically to the latest **server-recorded** scene. No HTML, JavaScript, CSS selectors, arbitrary URLs, or DOM APIs enter this runtime. Invalid references, invalid block schema, duplicate IDs, and invalid resulting scenes reject the entire patch and yield a labeled fallback, not a partially applied document.

The model receives the actual last stored scene in its prompt. The server resolves patches against that scene, returns the complete rendered snapshot, and logs both `scene` and `scenePatch` in each exposure so replay does not depend on reexecuting patch history. Browser SceneCanvas no longer remounts on every mutation, preserving state on retained block IDs.

## Acceptance
1. Start an adaptive session and let at least two successful model mutations occur.
2. Inspect the exposure payloads: full snapshots must be present for all generated scenes, while patch-based frames also include `scenePatch`.
3. For a patch, verify retained component IDs are preserved and elements can be updated, moved, removed or inserted. Reveal/toggle state on retained IDs should survive.
4. Verify malformed/no-op patches produce explicit fallback and cannot alter game chrome or whitelist navigation.
5. Confirm Observatory replay shows the recorded scene at each exposure without invoking external links.
6. Compare only within this engine version; no historical efficacy inference is supported yet.

`npm run build` executes `node --test tests/pd12*.test.mjs` before the Next.js build. Browser-level acceptance of mutation behavior remains separate.
