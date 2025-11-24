# Bloom Module Guidelines

This folder contains the modular bloom system components extracted from the original `BloomProvider.tsx`.

## Module Responsibilities

| File | Responsibility |
|------|---------------|
| `types.ts` | Shared TypeScript interfaces and type definitions |
| `constants.ts` | Configuration constants and userData keys |
| `layerAllocator.ts` | Three.js layer index allocation logic (Phase 2) |
| `materialManager.ts` | Material colorWrite save/restore utilities (Phase 2) |
| `layerMaskManager.ts` | Layer mask preservation utilities (Phase 2) |
| `selectionManager.ts` | Selection creation and object tracking (Phase 2) |
| `index.ts` | Public re-exports (Phase 4) |

## Key Patterns

1. **Pure Functions**: `layerAllocator`, `materialManager`, and `layerMaskManager` export pure functions for testability
2. **State Containers**: Use interface types (`LayerAllocatorState`, `MaterialColorWriteState`) for state
3. **Error Handling**: Explicit error handling with categorized logging instead of silent catches
4. **Layer Bounds**: Three.js layers are clamped to `[0, 31]`

## Testing

All pure logic modules have corresponding test files in `test/vitest/renderer/bloom/`.

## Related Designs

- [DESIGN061](../../../memory/designs/DESIGN061-bloom-provider-refactor.md) — Full refactor design document
