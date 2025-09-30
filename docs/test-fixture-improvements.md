# Test Fixture Improvements — Defensive Initialization Refactoring

**Date:** 2025-09-30  
**Context:** TASK151 performance validation revealed missing fixture initialization patterns

## Problem

During TASK151 performance validation, the AI budget harness crashed with multiple "Cannot read properties of undefined" errors. The root cause was incomplete initialization of test fixtures in:

1. **Blackboard structures** — Missing `allyCentroid`, `teamPriority`, `priorityIndex`, `focusFire`, `strengthRatio`, `teamPosture`
2. **Metrics structures** — Missing `intentTimeline`, `firstShotTimes`
3. **AI state** — Missing `stickinessHeading` Vector3
4. **Partial metrics object** — Perf harness used incomplete metrics stub instead of proper initialization

## Solution

### Created centralized fixture helpers

**New file:** `test/vitest/helpers/fixtures.ts`

Provides fully initialized test fixtures with proper defensive initialization:

- **`createTestBlackboard()`** — Complete AIBlackboard with all required maps, arrays, and Vector3 instances
- **`createTestGameState(overrides?)`** — Complete GameState stub with proper AI, blackboard, metrics, and simulation structures
- **`createTestAIState(overrides?)`** — Complete AIState with traits, command, and stickinessHeading properly initialized
- **`createTestShip(id, team, position, aiOverrides?)`** — Complete ShipEntity stub with progression fields, subsystems, and AI state

### Migrated perf harness

**Updated:** `scripts/perf/assert-ai-budget.ts`

- Replaced manual `createState()` implementation with `createTestGameState()`
- Replaced manual AI initialization with `createTestAIState({ profileId, traitSeed })`
- Removed duplicate `createDefaultMetrics()` import (now handled by fixture helper)

### Applied defensive patterns

**Updated runtime files** (these changes remain as defensive guards):

1. **`src/game/systems/decision/blackboard.ts`**
   - Added lazy init for 8 blackboard structures (allyCentroid, nearestEnemy, etc.)
   - Ensures `refreshBlackboard` never crashes on incomplete fixtures

2. **`src/game/metrics.ts`**
   - Added lazy init for `intentTimeline` and `firstShotTimes` arrays
   - Ensures `recordIntentMetrics` and `aggregateKpis` are resilient

3. **`src/game/systems/decision/intents.ts`**
   - Added lazy init for `ai.stickinessHeading` Vector3
   - Ensures `updateBandStickiness` never crashes on incomplete AI state

## Benefits

1. **Centralized initialization** — Single source of truth for test fixture structure
2. **Resilient runtime** — Defensive lazy initialization prevents crashes with incomplete fixtures
3. **Easier test authoring** — Test authors can use `createTestGameState()` and get full initialization automatically
4. **Type-safe** — All fixtures return properly typed structures with required fields
5. **Performance** — No observable regression; perf harness passes at 0.586ms/tick (within budget)

## Validation

- ✅ Full test suite passes: **79 test files, 417 tests**
- ✅ Perf harness passes: **0.586 ms/tick** (target: 3.5 ms/tick)
- ✅ No breaking changes to existing tests

## Usage example

```typescript
import { createTestGameState, createTestShip, createTestAIState } from '../helpers/fixtures.js';

// Create a fully initialized game state
const state = createTestGameState();

// Create a ship with proper AI and progression fields
const ship = createTestShip(1, 'blue', new Vector3(0, 0, 0));

// Create AI state with overrides
const ai = createTestAIState({ profileId: 'escort', traitSeed: 999 });
```

## Recommendations

1. **Adopt fixtures in new tests** — Use `createTestGameState()` and `createTestShip()` instead of manual stubs
2. **Gradual migration** — Existing tests can stay as-is; migrate opportunistically when touching test files
3. **Extend as needed** — Add more fixture helpers for other common test patterns (e.g., `createTestProjectile()`)
4. **Keep defensive guards** — The lazy initialization in runtime files (blackboard.ts, metrics.ts, intents.ts) should remain as safety nets

## Files changed

**New:**

- `test/vitest/helpers/fixtures.ts` (new centralized fixture helpers)

**Updated:**

- `scripts/perf/assert-ai-budget.ts` (migrated to use fixtures)
- `src/game/systems/decision/blackboard.ts` (defensive lazy init)
- `src/game/metrics.ts` (defensive lazy init)
- `src/game/systems/decision/intents.ts` (defensive lazy init)

**Unchanged (defensive patterns already present):**

- `test/vitest/ai-executor.spec.ts` (already had proper blackboard init)
- `test/vitest/ai-metrics.spec.ts` (already had `createStubState` with full init)
