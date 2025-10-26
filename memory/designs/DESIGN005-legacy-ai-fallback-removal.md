# DESIGN005 — Remove Legacy AI Fallback Path

## Summary

Retire the `runLegacyShipBehavior` steering branch so all ships execute the AI v2 command pipeline. Harden configuration and UI glue so disabling AI v2 is no longer possible, while keeping harnesses deterministic and metrics intact.

## Requirements

1. **WHEN** `prepareShips` runs each tick, **THE SYSTEM SHALL** drive every ship with an AI component through `executeAICommand`, regardless of UI toggle state. _(Acceptance: vitest exercises `prepareShips` after forcing the UI toggle off and asserts the ship still advances using its AI command.)_
2. **WHEN** a caller attempts to disable AI v2 via the UI store or configuration flags, **THE SYSTEM SHALL** keep AI enabled and emit a single warning explaining the ignore. _(Acceptance: vitest clicks the HUD "AI V2" toggle and asserts `console.warn` plus the store flag staying `true`; environment override coverage via unit shim.)_
3. **WHEN** `executeAICommand` encounters a ship missing its AI component, **THE SYSTEM SHALL** log an error, keep the ship stationary for that tick, and return `null` without throwing. _(Acceptance: vitest constructs a ship without `ai`, calls `executeAICommand`, and verifies translation is frozen alongside the logged error.)_
4. **WHEN** ships fire using AI v2 commands, **THE SYSTEM SHALL** continue recording first-shot telemetry and range metrics exactly once per firing event. _(Acceptance: existing `ai-metrics.spec.ts` `records shot telemetry via executeAICommand` remains green without legacy helpers.)_

## Architecture & Interfaces

- **`src/game/systems/shipControl.ts`**
  - Remove `runLegacyShipBehavior` export and associated helper logic.
  - Introduce a module-scoped guard (`warnedAiDisable`) to re-enable `state.ai.enabled` whenever it becomes `false`, logging a single warning.
  - Update `executeAICommand` to handle missing `ship.ai` by logging a structured error and re-queuing the ship's current transform through `deferSetNextKinematicTranslation`/`Rotation`.
- **`src/game/systems.ts`**
  - Drop legacy export from `__aiTestHooks` and main bundle imports.
- **`src/game/config.ts`**
  - Force `AI_CONFIG.v2Enabled` to `true`, capturing environment attempts to disable it with a console warning.
- **UI Glue (`src/game/uiStore.ts`, `src/components/hudToggleConfig.ts`, `src/game/context.tsx`)**
  - Guard `toggleAiV2`/`setAiV2Enabled` so attempts to set `false` restore `true` and warn once.
  - Ensure `GameProvider` mirrors the locked-on flag back into `GameState.ai.enabled` (defensive) without relying on consumer toggles.

## Data Flow

1. UI toggles attempt to flip `aiV2Enabled` → store rejects false writes, logs warning, remains `true`.
2. GameProvider effect mirrors the store flag → no change (remains `true`), ensuring simulation `GameState.ai.enabled` stays active.
3. Simulation tick (`prepareShips`) sees `state.ai.enabled` true → executes `executeAICommand` for each ship.
4. `executeAICommand` moves ships, fires projectiles, and records metrics. Missing AI components short-circuit with a logged error but keep physics stable by re-scheduling their current transform.

## Error Handling Matrix

| Condition                        | Detection                                | Response                                                                 |
| -------------------------------- | ---------------------------------------- | ------------------------------------------------------------------------ |
| UI store toggles AI V2 off       | `toggleAiV2` sees requested `false`      | Emit `console.warn` once, keep `aiV2Enabled = true`                      |
| Environment variable disables AI | Config loader sees `AI_V2_DEFAULT=false` | Emit `console.warn` once, force runtime default to `true`                |
| Ship lacks `ai` component        | `executeAICommand` receives `undefined`  | Log `console.error`, keep ship stationary by mirroring current transform |

## Testing Strategy

- Extend `test/vitest/ai-regression.spec.ts` to validate the disable guard and stationary behavior when AI is missing.
- Update `test/vitest/ui-settings-panels.spec.tsx` to expect the AI toggle warning and sticky `true` value.
- Remove legacy-specific assertions from `test/vitest/ai-metrics.spec.ts` while retaining telemetry coverage for the v2 path.
- Adjust mocked exports in `test/vitest/update-game-panic.spec.ts` and smoke import lists to match the new API surface.
- Run `npm run lint`, `npx tsc --noEmit`, and `npm test` to satisfy repository policy.

## Open Questions

- Do any scenario harness fixtures intentionally remove `ship.ai`? Current plan treats it as an error but keeps simulation deterministic. Future work could promote this into validation that enforces component integrity earlier in the spawn pipeline.
