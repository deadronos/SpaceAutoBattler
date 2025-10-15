# Agents Guide: src/components/layers

- Purpose: Scene layer abstractions (projectiles, muzzle flashes, ships, turrets) using instancing or non-instanced rendering.
- API: Layers should accept precomputed render lists or archetype queries; avoid running simulation logic inside layers.
- Allocation: Use pooled instance attribute buffers and instance allocators (`instanceAllocator.ts`) for high-count elements.
- Validation: When adjusting counts or LOD thresholds, add perf tests and Playwright screenshots for visual correctness.
