# TASK254 - Material Presets & Factory

**Status:** Not Started
**Added:** 2025-10-27

## Original Request
Centralize material preset objects and factories; expose thin React wrappers and factory functions used by the material registry and instanced layers.

## Implementation Plan

1. Create `src/renderer/materials/materialPresets.ts` and `src/renderer/materials/materialFactory.ts`.
2. Refactor `src/renderer/materials/bulletMaterials.tsx` to import from presets/factory (preserve exported names).
3. Update `src/renderer/materialRegistry.tsx` to use `createInstancedMaterial` or `createMaterialFromPreset`.
4. Add unit tests `test/renderer/materialFactory.spec.ts` to assert key properties.
5. Run typecheck & tests and fix issues.
6. Commit & create PR.

## Subtasks

| ID | Description | Status |
| --- | ----------- | ------ |
| 2.1 | Add `materialPresets.ts` | Not Started |
| 2.2 | Add `materialFactory.ts` | Not Started |
| 2.3 | Refactor `bulletMaterials.tsx` | Not Started |
| 2.4 | Update `materialRegistry.tsx` | Not Started |
| 2.5 | Add tests | Not Started |

## Progress log

### 2025-10-27
- Task created, design added to memory.

## Acceptance Criteria
- Typecheck passes
- Unit test confirms that `createMaterialFromPreset('bullet:laser')` matches expected numeric/color properties

