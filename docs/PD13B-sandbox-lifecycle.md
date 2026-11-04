# PD13B — Sandbox lifecycle and focus observations

This change is scoped to the authenticated Sandbox Lab. It does not alter the production PD12D mutation engine or experiment loss rules.

- The generated iframe uses `sandbox="allow-scripts"` without same-origin, popups or top-navigation permissions.
- Each activation receives a fresh random nonce. Bridge messages must match source, opaque origin, protocol, nonce, event type and bounded identifier.
- Frame state reports `starting`, `ready`, `unresponsive`, `stopped` or `expired`.
- If the frame does not report readiness within eight seconds, it is marked unresponsive. The lab can manually stop or restart it.
- A frame is automatically unloaded after 120 seconds. A restart creates a fresh iframe rather than preserving its execution context.
- A separate readout reports focus within the frame. This is diagnostic only; the protected page's loss policy is unchanged.

**Security limitation:** The iframe prevents origin-level access to the host application but cannot guarantee a dedicated process, a CPU budget, or termination of synchronous runaway JavaScript. An event-loop hang may prevent the watchdog from firing promptly. The existing CSP and lack of privileged host actions remain essential. This is not sufficient for public, untrusted live game integration.

## Acceptance

1. Open the admin Sandbox Lab; verify frame shows ready after the example loads.
2. Click within the frame; confirm focus indicator and bounded signals.
3. Stop frame; ensure the iframe unmounts. Restart; verify the example starts from initial state.
4. After two minutes, verify the lab unloads the frame; manual restart works.
5. A deliberately nonresponsive fixture should show unresponsive status after startup deadline, provided the browser's UI thread is responsive.
6. Confirm opening or clicking the Sandbox Lab does not start or end a production PD12D session.

Regression tests run during Vercel prebuild.
