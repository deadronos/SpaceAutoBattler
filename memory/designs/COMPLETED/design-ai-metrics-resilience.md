# Design — AI Metrics Resilience (2025-09-28)

## Context

`npm test` currently fails because the AI metrics suite expects legacy percentile behavior, the lightweight harness stubs lack Rapier/physics shims, and the scenario fixtures do not include the newly-exported metrics payload. This design documents the minimal touch points required to realign metrics behaviour and tests.

## Architecture Overview

- **`aggregateKpis`**: computes KPI summaries from recorded metrics. We will adjust the percentile helper to use a floor-based lookup that matches historical expectations.
- **Test Harness State Stubs**: `test/vitest/ai-metrics.spec.ts` constructs a trimmed `GameState`. We will extend the stubs so `fireProjectile` can execute without requiring the full Rapier runtime while still surfacing projectile entities for downstream consumers.
- **`runAIScenario` Export Path**: includes deterministic command/position logs plus metrics snapshot. We will stabilise the serialized metrics structure and normalise numeric precision for fixtures.

## Data Flow

```text
executeAICommand → fireProjectile → Rapier shim → world.createEntity → metrics histograms
                                ↘ recordShotMetrics → aggregateKpis
runAIScenario → aggregateKpis → snapshotMetrics → JSON fixtures
```

## Interfaces Impacted

- `aggregateKpis(metrics: AIMetrics, tick: number): void`
  - New percentile helper will return the lower-bound sample at `⌊(n-1)·p⌋`.
- `percentile(sortedValues: number[], p: number): number`
  - Replaced with non-interpolating implementation and guards for empty collections.
- `createStubState(): GameState` (test helper)
  - Provides Rapier descriptors, physics world hooks (`createRigidBody`, `createCollider`), and `world.createEntity` that appends projectiles to the query list.
- Scenario fixtures (`test/vitest/fixtures/*.json`)
  - Updated to contain a `metrics` object with KPI summaries, histograms, and timelines.

## Data Models

- **Rapier Shim Objects**: minimal builders exposing `setTranslation`, `setRotation`, `setActiveEvents`, `setActiveCollisionTypes` returning `this` for chaining.
- **Projectile Entities**: appended to `queries.projectiles.entities` with `rigidBody`, `collider`, `transform`, and `projectile` payloads containing deterministic IDs and metadata.
- **Metrics Snapshot**: JSON representation matching `AIScenarioMetrics`, including `kpis`, `firstShotTimes`, `intentTimeline`, `shotDistance`, and `shotDeltaY` fields.

## Error Handling Matrix

| Failure Mode | Detection | Response | Notes |
| --- | --- | --- | --- |
| Percentile helper receives empty array | `sortedValues.length === 0` | Return `0` (maintains historical guard) | Covered by existing reset tests |
| Rapier shim invoked outside tests | `state.rapier` missing required builders | Throwing earlier than shim is acceptable; shim is scoped to tests | Documented in test helper |
| `world.createEntity` shim invoked without projectile config | Fallback default config | Use existing `DEFAULT_PROJECTILE_CONFIG` to ensure deterministic scale/radius | Aligns with production defaults |
| Scenario fixture mismatch | Vitest deep equality assertion | Update fixtures via normalized snapshot | `normalizeLog` helper retains rounding |

## Unit Testing Strategy

- `test/vitest/ai-metrics.spec.ts`
  - Validate percentile outputs (`p50`, `p90`) with deterministic dataset.
  - Exercise `executeAICommand` and `runLegacyShipBehavior` ensuring shot telemetry populates histograms without runtime errors.
- `test/vitest/ai-scenario-harness.spec.ts`
  - Update fixtures to include metrics snapshot; confirm deep equality across log entries and metrics.
- Regression
  - Run `npm test` post-change; optional `npm run typecheck` to ensure TypeScript safety.

## Implementation Plan

1. Update `memory/tasks/_index.md` and create `TASK144` describing scope, expected outcome, and dependencies.
2. Modify `test/vitest/ai-metrics.spec.ts` stub state to provide Rapier/physics/world shims that push created projectiles into the query list.
3. Adjust `aggregateKpis` percentile helper in `src/game/metrics.ts` to return the lower-bound sample without interpolation.
4. Regenerate scenario fixtures (`ai-escort`, `ai-bomber-intercept`, `ai-artillery-retreat`) using the normalized metrics snapshot produced by the harness.
5. Re-run `npm test` to verify all suites pass; capture outputs for the summary.
6. Update task file with validation results and mark status accordingly.
