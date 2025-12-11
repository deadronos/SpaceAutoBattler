# TASK255 - Extract Shared GLSL Common (noise/hash)

**Status:** Completed
**Added:** 2025-10-27
**Completed:** 2025-10-27

## Original Request

Centralize shared GLSL utilities (hash, snoise, helpers) into `src/renderer/shaders/common.glsl` and provide a runtime import mechanism.

## Implementation Plan

1. Create `src/renderer/shaders/common.glsl` with canonical `hash` and `snoise` implementations.
2. Create `src/renderer/shaders/index.ts` that exports `COMMON_GLSL` (string) to allow runtime prepend.
3. Inject `COMMON_GLSL` in one shader via `const src = COMMON_GLSL + '\n' + shaderCode` and create a smoke visual test.
4. Iterate and update other shaders.
5. Update any build shader loader config if using glsl include support.

## Subtasks

| ID  | Description                                      | Status   |
| --- | ------------------------------------------------ | -------- |
| 3.1 | Add `common.glsl`                                | Complete |
| 3.2 | Add `shaders/index.ts`                           | Complete |
| 3.3 | Update `starDisk.fragment.glsl` to use injection | Complete |
| 3.4 | Verify visual parity & tests                     | Complete |

## Acceptance Criteria

- Shader string concatenation compiles without errors
- Visual parity preserved for a sample shader

## Progress log

### 2025-10-27

- Task and design created in memory.
- Created `src/renderer/shaders/common.glsl` with canonical `snoise` and `hash` implementations
- Created `src/renderer/shaders/index.ts` that exports `COMMON_GLSL` string
- Updated `starDiskMaterial.ts` to inject `COMMON_GLSL` before fragment shader via string concatenation
- Removed duplicate `snoise` function from `mainsequencestar.glsl`
- Removed duplicate `snoise` function from `starDisk.fragment.glsl`
- Verified all 561 tests still pass
- Verified TypeScript compilation succeeds
- Task completed successfully with no regressions
