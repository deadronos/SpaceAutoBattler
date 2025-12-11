# DESIGN062 — Centralized Error Handling & Silent Catch Remediation

**Status:** Proposed  
**Created:** 2025-11-25  
**Related:** High-Level Architecture Analysis (Error Handling section rated B-)

## Problem Statement

The codebase contains 100+ silent `catch {}` blocks that mask potential issues, making debugging difficult and hiding error patterns that could indicate systemic problems. Key concerns:

1. **No centralized error reporting** — errors are swallowed locally with no aggregation
2. **Inconsistent patterns** — some modules log, some record diagnostics, most silently ignore
3. **Poor documentation** — comments like `/* ignore */` don't explain why errors are expected
4. **Risk masking** — legitimate bugs may be hidden by defensive catch blocks

## Audit Summary

### High Priority Files (Core Game Logic)

| File                          | Silent Catches | Risk Level                                                   |
| ----------------------------- | -------------- | ------------------------------------------------------------ |
| `src/game/entityLifecycle.ts` | 7              | **High** — Physics state corruption could go unnoticed       |
| `src/game/safeSnapshot.ts`    | 9              | **High** — Debugging becomes difficult when diagnostics fail |
| `src/game/context.tsx`        | 7              | **Medium** — E2E test failures may be masked                 |
| `src/game/systems.ts`         | 2 (nested)     | **Medium** — Original errors lost if diagnostics fail        |
| `src/game/simulationQueue.ts` | 1              | **Medium** — Deferred mutation failures ignored              |

### Medium Priority Files (Rendering)

| File                                         | Silent Catches | Pattern                                      |
| -------------------------------------------- | -------------- | -------------------------------------------- |
| `src/components/environment/StarSphere.tsx`  | 12             | Material assignment, disposal, WebGL state   |
| `src/components/environment/PlanetRings.tsx` | 8              | Material property updates, needsUpdate flags |
| `src/components/Postprocessing.tsx`          | 4              | Composer cleanup, bloom layer restoration    |
| `src/renderer/bloom/BloomProvider.tsx`       | 1              | Camera layer mask operations                 |
| `src/renderer/bloom/layerMaskManager.ts`     | 2              | Layer mask operations                        |
| `src/hooks/useStarMaterial.ts`               | 5              | Material lifecycle                           |

### Lower Priority Files (Debug/Dev Tools)

| File                                                  | Silent Catches | Notes              |
| ----------------------------------------------------- | -------------- | ------------------ |
| `src/renderer/webglDebugWrapper.ts`                   | 5              | Debug utility      |
| `src/renderer/webglDebugPrototypePatch.ts`            | 6              | Prototype patching |
| `src/renderer/starDisk/devtools/installDevHelpers.ts` | 9              | Dev-only helpers   |
| `src/debug/RingDebugPanel.tsx`                        | 2              | Debug panel        |

### Acceptable Silent Catches (Config/Utils)

| File                 | Silent Catches | Reason                                                   |
| -------------------- | -------------- | -------------------------------------------------------- |
| `src/game/config.ts` | 5              | Returns defaults on env/query param failure — acceptable |
| `src/utils/color.ts` | 1              | Returns fallback color — acceptable                      |

## Root Cause Analysis

### Pattern Categories

1. **Material Lifecycle** (~25 occurrences)
   - `.needsUpdate = true` on potentially disposed materials
   - `.dispose()` calls that may double-fire
   - Type-unsafe property access via `as any`

2. **Physics/WASM State** (~15 occurrences)
   - Rapier objects may be invalidated by the WASM runtime
   - Colliders removed when rigid bodies are removed
   - Order-dependent cleanup sequences

3. **WebGL Context** (~10 occurrences)
   - Browser API inconsistencies
   - Context loss scenarios
   - Feature detection via try/catch

4. **Test/Debug Environments** (~10 occurrences)
   - JSDOM lacks WebGL APIs
   - Headless environments have reduced capabilities

5. **E2E Test Hooks** (~8 occurrences)
   - `__SAB.*` methods swallow errors to avoid breaking tests

## Proposed Solution

### Phase 1: Create Error Reporting Infrastructure

Create `src/utils/errorReporting.ts`:

```typescript
export enum ErrorCategory {
  Physics = 'physics',
  Material = 'material',
  WebGL = 'webgl',
  Lifecycle = 'lifecycle',
  Config = 'config',
  E2E = 'e2e',
}

export interface ErrorReport {
  category: ErrorCategory;
  message: string;
  context?: Record<string, unknown>;
  timestamp: number;
  stack?: string;
}

interface ErrorReportingState {
  reports: ErrorReport[];
  counts: Record<ErrorCategory, number>;
  enabled: boolean;
  maxReports: number;
}

const state: ErrorReportingState = {
  reports: [],
  counts: Object.fromEntries(Object.values(ErrorCategory).map((c) => [c, 0])) as Record<
    ErrorCategory,
    number
  >,
  enabled: process.env.NODE_ENV !== 'production',
  maxReports: 100,
};

export function reportError(
  category: ErrorCategory,
  message: string,
  context?: Record<string, unknown>,
  error?: unknown,
): void {
  state.counts[category]++;

  if (!state.enabled) return;

  const report: ErrorReport = {
    category,
    message,
    context,
    timestamp: Date.now(),
    stack: error instanceof Error ? error.stack : undefined,
  };

  state.reports.push(report);
  if (state.reports.length > state.maxReports) {
    state.reports.shift();
  }

  if (process.env.NODE_ENV === 'development') {
    console.warn(`[${category}] ${message}`, context, error);
  }
}

export function getErrorCounts(): Record<ErrorCategory, number> {
  return { ...state.counts };
}

export function getRecentErrors(limit = 10): ErrorReport[] {
  return state.reports.slice(-limit);
}

export function resetErrorCounts(): void {
  for (const key of Object.keys(state.counts)) {
    state.counts[key as ErrorCategory] = 0;
  }
  state.reports = [];
}
```

### Phase 2: Create Category-Specific Helpers

```typescript
// src/utils/errorReporting.ts (additional exports)

export function reportMaterialError(
  operation: string,
  materialType: string,
  error?: unknown,
): void {
  reportError(
    ErrorCategory.Material,
    `${operation} failed for ${materialType}`,
    { materialType, operation },
    error,
  );
}

export function reportPhysicsError(operation: string, entityId?: number, error?: unknown): void {
  reportError(ErrorCategory.Physics, `${operation} failed`, { entityId, operation }, error);
}

export function reportLifecycleError(
  phase: 'create' | 'destroy' | 'update',
  entityType: string,
  entityId?: number,
  error?: unknown,
): void {
  reportError(
    ErrorCategory.Lifecycle,
    `Entity ${phase} failed for ${entityType}`,
    { phase, entityType, entityId },
    error,
  );
}
```

### Phase 3: Refactor High-Priority Files

#### Example: `entityLifecycle.ts` refactor

```typescript
// Before
if (entity.collider && entity.collider.isValid()) {
  try {
    state.physicsWorld.removeCollider(entity.collider, true);
  } catch {
    // Collider may already be removed by Rapier when the rigid body is removed.
  }
}

// After
if (entity.collider && entity.collider.isValid()) {
  try {
    state.physicsWorld.removeCollider(entity.collider, true);
  } catch (error) {
    // Expected: Rapier removes colliders automatically when rigid body is freed
    reportPhysicsError('removeCollider', entity.id, error);
  }
}
```

#### Example: Material updates refactor

```typescript
// Before
try {
  (materialToUse as any).needsUpdate = true;
} catch {
  /* ignore */
}

// After
try {
  (materialToUse as any).needsUpdate = true;
} catch (error) {
  // Expected: Material may be disposed during React unmount cycle
  reportMaterialError('needsUpdate', 'ShaderMaterial', error);
}
```

### Phase 4: Add Debug Surface

Add error counts to existing debug panels or create a simple overlay:

```typescript
// src/debug/ErrorCountsPanel.tsx
export function ErrorCountsPanel(): JSX.Element | null {
  const counts = getErrorCounts();
  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  if (total === 0) return null;

  return (
    <div className="error-counts-panel">
      <h4>Suppressed Errors: {total}</h4>
      {Object.entries(counts)
        .filter(([, v]) => v > 0)
        .map(([k, v]) => (
          <div key={k}>{k}: {v}</div>
        ))}
    </div>
  );
}
```

## Implementation Plan

### Task Breakdown

| Task                             | Effort  | Files           |
| -------------------------------- | ------- | --------------- |
| Create `errorReporting.ts`       | 1-2 hrs | 1 new file      |
| Add exports to utils index       | 15 min  | 1 file          |
| Refactor `entityLifecycle.ts`    | 1 hr    | 1 file          |
| Refactor `safeSnapshot.ts`       | 45 min  | 1 file          |
| Refactor `context.tsx`           | 45 min  | 1 file          |
| Refactor rendering files (batch) | 2-3 hrs | ~6 files        |
| Add debug panel                  | 1 hr    | 1-2 files       |
| Add unit tests                   | 1-2 hrs | 1 test file     |
| Update documentation             | 30 min  | ARCHITECTURE.md |

**Total Estimated Effort:** 8-12 hours

### Phased Rollout

1. **Phase 1** (MVP): Create infrastructure + refactor `entityLifecycle.ts`
2. **Phase 2**: Refactor remaining game/ files
3. **Phase 3**: Refactor rendering files
4. **Phase 4**: Add debug surface + documentation

## Success Criteria

1. **Measurable**: Error counts visible in dev mode
2. **Searchable**: All catch blocks have category-tagged reports
3. **Documented**: Each catch block explains why the error is expected
4. **Testable**: Unit tests verify error reporting behavior
5. **Non-breaking**: Production builds continue to suppress logs

## Risks & Mitigations

| Risk                              | Mitigation                                               |
| --------------------------------- | -------------------------------------------------------- |
| Performance overhead from logging | Disable in production; use lightweight counters          |
| Log spam in development           | Rate-limit repeated errors; use counts vs. full logs     |
| Breaking existing behavior        | Keep try-catch structure; only add reporting             |
| Scope creep                       | Focus on high-priority files first; batch lower priority |

## Alternatives Considered

1. **ESLint rule for empty catch** — Would flag issues but not provide runtime visibility
2. **External error service (Sentry)** — Overkill for a game; adds dependency
3. **Remove all try-catch** — Would crash on expected errors in edge cases
4. **Do nothing** — Maintains status quo; debugging remains difficult

## References

- High-Level Architecture Analysis, Section 10 (Error Handling)
- Similar pattern in `src/game/systems.ts` with `recordSubsystemFailure`
- Existing diagnostics in `RapierDiagnostics` interface

## Appendix: Full File List

### Game Logic

- `src/game/entityLifecycle.ts` (7)
- `src/game/safeSnapshot.ts` (9)
- `src/game/context.tsx` (7)
- `src/game/systems.ts` (2)
- `src/game/simulationQueue.ts` (1)
- `src/game/config.ts` (5)
- `src/game/uiStore.ts` (1)
- `src/game/turretRegistry.ts` (2)
- `src/game/ships.ts` (1)
- `src/game/systems/shipControl/aiExecutor.ts` (2)
- `src/game/systems/shipControl/aiSafety.ts` (2)

### Components

- `src/components/Postprocessing.tsx` (4)
- `src/components/ship/ShipModel.tsx` (1)
- `src/components/environment/StarSphere.tsx` (12)
- `src/components/environment/PlanetRings.tsx` (8)
- `src/components/environment/starDisk/useStarDiskDebugCleanup.ts` (1)
- `src/components/environment/starDisk/useStarDiskFrameLoop.ts` (2)
- `src/components/layers/instanceAllocator.ts` (1)

### Renderer

- `src/renderer/bloom/BloomProvider.tsx` (1)
- `src/renderer/bloom/layerMaskManager.ts` (2)
- `src/renderer/shields/shieldHexShader.tsx` (1)
- `src/renderer/webglDebugWrapper.ts` (5)
- `src/renderer/webglDebugPrototypePatch.ts` (6)
- `src/renderer/starDisk/devtools/materialSnapshot.ts` (3)
- `src/renderer/starDisk/devtools/installDevHelpers.ts` (9)
- `src/renderer/starDisk/devtools/domIndicators.ts` (2)
- `src/renderer/starDisk/devtools/debugWindow.ts` (2)

### Hooks

- `src/hooks/useStarMaterial.ts` (5)
- `src/hooks/useStarDebug.ts` (2)
- `src/hooks/useDevShaderCompile.ts` (1)

### Utils

- `src/utils/patchGltfLoader.ts` (1)
- `src/utils/copilotDebug.ts` (1)
- `src/utils/color.ts` (1)

### Debug

- `src/debug/RingDebugPanel.tsx` (2)
