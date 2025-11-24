# Bloom Module Guidelines

This folder contains the selective bloom rendering system for Three.js/React Three Fiber.

## Public API

Import from `index.ts`:

```tsx
import { BloomProvider, useBloomContext, useBloomRegistration } from '../renderer/bloom/index.js';
import type { BloomRegistrationOptions, BloomContextValue } from '../renderer/bloom/index.js';
```

## Module Structure

| File | Responsibility |
|------|---------------|
| `index.ts` | Public API exports — use this for external imports |
| `BloomProvider.tsx` | React context provider and hooks |
| `types.ts` | Shared TypeScript interfaces and type definitions |
| `constants.ts` | Configuration constants and userData keys |
| `layerAllocator.ts` | Three.js layer index allocation (layers 11-31) |
| `materialManager.ts` | Material colorWrite save/restore utilities |
| `layerMaskManager.ts` | Layer mask preservation utilities |
| `selectionManager.ts` | Selection creation and object tracking |

## Layer Allocation Strategy

Three.js supports 32 layers (0-31) via a bitmask. This system:

1. Reserves layer 0 for the main render pass
2. Starts bloom layer allocation at `LAYER_START` (default: 11)
3. Allocates one layer per bloom group (engines, projectiles, explosions, etc.)
4. Each Selection object tracks objects for its assigned layer
5. The postprocessing composer renders each selection with configured bloom settings

**Important**: If you have many bloom groups, you may exhaust available layers. Monitor for warnings about layer 31.

## Key Patterns

1. **Pure Functions**: `layerAllocator`, `materialManager`, and `layerMaskManager` are pure for testability
2. **State Preservation**: Original layer masks and colorWrite values are saved before modification
3. **Layer Bounds**: All layer indices are clamped to `[0, 31]`
4. **Non-exclusive Selections**: Objects remain visible in main pass while participating in bloom

## Testing

Unit tests: `test/vitest/renderer/bloom/`
Integration tests: `test/vitest/renderer/bloom/BloomProvider.integration.spec.ts`

## Related Designs

- [DESIGN061](../../../memory/designs/DESIGN061-bloom-provider-refactor.md) — Full refactor design document
