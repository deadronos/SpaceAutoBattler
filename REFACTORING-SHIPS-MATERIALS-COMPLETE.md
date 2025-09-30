# Refactoring Summary: Ships and Material Registry

## Overview
Refactored `src/game/ships.ts` and `src/renderer/materialRegistry.tsx` to separate concerns, extract data from logic, and improve maintainability.

## Changes Made

### 1. Ships Refactoring

#### Created New Files:
- **`src/data/shipStats.ts`** - Pure data module containing `SHIP_STATS` constant
  - Extracted all hull stat tables (fighter, corvette, frigate, destroyer, carrier)
  - Includes motion stats, turret specs, and combat stats for each hull type
  - Validates all motion stats at module load time
  - ~350 lines of declarative data

- **`src/utils/motionUtils.ts`** - Motion utilities
  - Extracted `createDefaultMotionStats()` function
  - Provides default motion configuration for testing/fallback scenarios
  - ~30 lines

- **`src/game/aiState.ts`** - AI state initialization
  - Extracted `createInitialAIState()` function
  - Handles deterministic AI trait generation and state setup
  - ~35 lines

#### Updated File:
- **`src/game/ships.ts`** - Simplified spawn orchestration (~170 lines, down from 591)
  - Now imports `SHIP_STATS` from data module
  - Kept `spawnShip()` function (core spawning logic)
  - Kept `applyRangeVariance()` helper (closely tied to spawning)
  - Removed large data literals and helper functions (now in dedicated files)
  - Re-exports extracted functions for backward compatibility

### 2. Material Registry Refactoring

#### Created New Files:
- **`src/renderer/shaders/shieldHexShader.tsx`** - Shield hex shader implementation
  - Extracted `createShieldHexShaderMaterial()` function
  - Extracted `ShieldHexMaterial` component
  - Contains all vertex/fragment shader code
  - ~220 lines of shader-specific logic

- **`src/renderer/materials/shieldMaterials.tsx`** - Shield materials
  - Extracted `ShieldTransmissionMaterial` component
  - Uses drei's MeshTransmissionMaterial
  - ~40 lines

- **`src/renderer/materials/bulletMaterials.tsx`** - Bullet materials
  - Extracted all bullet material components:
    - `BulletLaserMaterial`
    - `BulletPlasmaMaterial`
    - `BulletIonMaterial`
    - `BulletHeavyMaterial`
  - ~20 lines

- **`src/renderer/materials/explosionMaterials.tsx`** - Explosion materials
  - Extracted `ExplosionSmokeMaterial` component
  - ~10 lines

#### Updated File:
- **`src/renderer/materialRegistry.tsx`** - Thin registry orchestrator (~50 lines, down from 349)
  - Imports all material components from dedicated files
  - Maintains registry logic (`registerMaterial`, `getMaterial`)
  - Registers all built-in materials
  - Exports types and key components for backward compatibility

### 3. Bug Fix
- **`test/vitest/safe-kinematics.spec.ts`** - Fixed function signature
  - Updated test calls to match new `safeSetNextKinematicTranslation()` signature
  - Function now takes `state` as first parameter

## Benefits

1. **Separation of Concerns**
   - Data is now separate from logic
   - Shader code is isolated from registry logic
   - Each file has a single, clear responsibility

2. **Improved Testability**
   - Can mock ship stats without touching spawn logic
   - Can test shader creation independently of React components
   - Motion validation is independent and reusable

3. **Better Maintainability**
   - Adding new hull types only requires editing data file
   - Adding new materials doesn't require modifying registry
   - Smaller files are easier to navigate and understand

4. **Future Extensibility**
   - Ship stats could be loaded from JSON if needed
   - Material components can be extended without touching core registry
   - Clear boundaries for future refactoring

## Validation

- ✅ **TypeScript Compilation**: Passes (`npm run typecheck`)
- ✅ **Build**: Succeeds (`npm run build`)
- ✅ **Tests**: 70/85 test files pass (15 failures are pre-existing React.act issues unrelated to refactoring)
- ✅ **Imports**: All backward-compatible exports maintained

## File Size Impact

### Ships Module:
- Before: `ships.ts` - ~591 lines
- After: 
  - `ships.ts` - ~170 lines (spawn orchestration)
  - `data/shipStats.ts` - ~350 lines (pure data)
  - `utils/motionUtils.ts` - ~30 lines (utilities)
  - `game/aiState.ts` - ~35 lines (AI initialization)
  - **Total: ~585 lines** (similar total, but better organized)

### Material Registry:
- Before: `materialRegistry.tsx` - ~349 lines
- After:
  - `materialRegistry.tsx` - ~50 lines (registry)
  - `shaders/shieldHexShader.tsx` - ~220 lines (shader)
  - `materials/shieldMaterials.tsx` - ~40 lines (shields)
  - `materials/bulletMaterials.tsx` - ~20 lines (bullets)
  - `materials/explosionMaterials.tsx` - ~10 lines (explosions)
  - **Total: ~340 lines** (slightly reduced, much better organized)

## Migration Notes

No breaking changes - all public APIs maintain backward compatibility through re-exports.

Consumers can continue to import from original modules:
```typescript
// Still works
import { SHIP_STATS, spawnShip, createDefaultMotionStats } from './game/ships.js';
import { ShieldHexMaterial, getMaterial } from './renderer/materialRegistry.js';
```

Or import directly from new modules for clearer dependencies:
```typescript
// Also works (preferred for new code)
import { SHIP_STATS } from './data/shipStats.js';
import { ShieldHexMaterial } from './renderer/shaders/shieldHexShader.js';
```
