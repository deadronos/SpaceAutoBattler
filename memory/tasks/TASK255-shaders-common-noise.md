# TASK255 - Extract Shared GLSL Common (noise/hash)

**Status:** Not Started
**Added:** 2025-10-27

## Original Request
Centralize shared GLSL utilities (hash, snoise, helpers) into `src/renderer/shaders/common.glsl` and provide a runtime import mechanism.

## Implementation Plan

1. Create `src/renderer/shaders/common.glsl` with canonical `hash` and `snoise` implementations.
2. Create `src/renderer/shaders/index.ts` that exports `COMMON_GLSL` (string) to allow runtime prepend.
3. Inject `COMMON_GLSL` in one shader via `const src = COMMON_GLSL + '\n' + shaderCode` and create a smoke visual test.
4. Iterate and update other shaders.
5. Update any build shader loader config if using glsl include support.

## Subtasks

| ID | Description | Status |
| --- | ----------- | ------ |
| 3.1 | Add `common.glsl` | Not Started |
| 3.2 | Add `shaders/index.ts` | Not Started |
| 3.3 | Update `starDisk.fragment.glsl` to use injection | Not Started |
| 3.4 | Verify visual parity & tests | Not Started |

## Acceptance Criteria
- Shader string concatenation compiles without errors
- Visual parity preserved for a sample shader

## Progress log

### 2025-10-27
- Task and design created in memory.

