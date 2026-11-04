# PD12D.1 — Model timeout recovery

## Observed production incident (2026-11-03, America/Kentucky/Louisville)

The first PD12D adaptive test session `f6a016ca-91bd-4bbf-a099-c4779eac9d53` recorded three fallback exposures and zero model exposures. Vercel production logs confirmed three `provider_timeout AbortError` events at 00:05:45, 00:06:30, and 00:07:16 UTC on November 4 (19:05–19:07 EST November 3). Neon contained no durable session_strategy_state rows.

### Root cause

PD12D combined a lengthy multi-version system prompt with repeated detailed instructions in the JSON user input. Its model was asked to produce a page, bounded reflexes, an interactive experiment, and a strategy plan in one completion, under a fixed 15-second abort window and a 4,200-token completion allowance. All three calls expired before model output could be validated.

## Correction

- For `pd12d-v1` only, use one authoritative compact system contract. Preserve tactic constraints, structured strategic plan, reflexes, whitelist, no arbitrary executable code, and the protected game rules.
- Send only the needed current telemetry, strategy state/directive, current world, last three mutation summaries, and prior test outcome, without repeating long instructions in the input JSON.
- Raise model request timeout to **35 seconds**; cap completion budget at **2,600 tokens**. Legacy engines keep their existing generation settings.
- Add structured provider-completion logging of elapsed time, finish reason, and output length (no prompt or participant data).
- Include tests for the engine-specific contract and transport selection in the prebuild suite.

## Validation boundary

A Vercel preview READY build verifies that the new code compiles and the PD12 regression suite passes. It does **not** demonstrate successful provider output under production workload or successful visual mutation. Run a fresh PD12D adaptive round, inspect its model/fallback ratio and live runtime diagnostics; investigate invalid-model-output if it replaces the timeouts. No user data or experiment outcomes were rewritten and no database migration was needed.
