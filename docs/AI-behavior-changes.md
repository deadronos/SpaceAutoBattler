# AI Behavior Changes (Release Notes)

Date: 2025-08-29

## Summary

This short note documents a few focused, low-risk changes to the AI subsystem that improve deterministic behavior during tests and clustered spawns, and make an internal separation helper accessible for testing.

## What changed

- `AIController.calculateSeparationForceWithCount` is now public.
  - Returns: { force: Vector3, neighborCount: number }
  - Reason: Tests and tools can now call this deterministically to inspect separation behavior and scale idle separation appropriately.

- `behaviorConfig.globalSettings.enableSpawnJitter` (default: true)
  - Purpose: Controls a tiny deterministic spawn-time velocity jitter applied to spawned ships.
  - Effect: Breaks perfect symmetry for tightly clustered spawns so separation forces and initial movement behave robustly in deterministic tests.

- `globalSettings.evadeOnlyOnDamage` default preserved for test compatibility
  - We intentionally preserved the legacy default to avoid surprising test regressions. The flag remains configurable in `src/config/behaviorConfig.ts`.

## Why

- Symmetric initial conditions can cause averaged separation vectors to cancel out, producing no net movement and causing tests or early simulation frames to appear "stuck".
- A tiny deterministic jitter plus a public separation helper reduces flakiness and makes the behavior more observable and testable.

## Notes for release managers

- The changes are backward-compatible and controlled via a config flag (`enableSpawnJitter`) if you prefer to disable the jitter in production builds.
- Tests were updated/added and the full vitest suite passes locally when these changes are applied.

## Files touched

- `src/core/aiController.ts` — made separation helper public
- `src/core/gameState.ts` — applied optional spawn jitter at ship creation
- `src/config/behaviorConfig.ts` — added `enableSpawnJitter` to `globalSettings`
- `test/vitest/ai-separation-helper.spec.ts` — added unit tests for separation helper
- `README.md` — short developer note

## How to revert

- To disable the spawn jitter change, set `behaviorConfig.globalSettings.enableSpawnJitter = false`.
- To hide the separation helper again, revert the method visibility in `AIController`.

## Contact

If you'd like this documented in a changelog file with a formal semver entry or included in release notes, I can create a formatted CHANGELOG.md entry and a PR.
