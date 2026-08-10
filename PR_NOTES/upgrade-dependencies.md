# Dependency Upgrade Migration Notes

## Upgraded Packages

- **@dimforge/rapier3d-compat**: `0.19.3` -> `0.20.0`
- **vite**: `@voidzero-dev/vite-plus-core` `0.2.6` -> `0.2.8`
- **vitest**: `@voidzero-dev/vite-plus-test` `0.1.24`
- **@react-three/fiber**: `9.6.1` -> `9.7.0`
- **@react-three/drei**: `10.7.7` -> `10.7.8`
- **three-mesh-bvh**: `0.9.13` -> `0.9.14`
- **playwright**: `1.62.0` -> `1.62.1`
- **@types/node**: `26.1.2` -> `26.2.0`
- **tsx**: `4.23.1` -> `4.23.12`

## Key Fixes & Breaking Changes

1. **Rapier 0.20 API / Type updates**:
   - `Rapier.init()` no longer expects an options object parameter (e.g., `Rapier.init()` instead of `Rapier.init({})`).
   - `Rapier.EventQueue` constructor expects boolean `autoDrain` parameter directly (e.g., `new Rapier.EventQueue(true)` instead of `{ auto: true }`).
   - Updated Rapier type imports in `src/types/core.ts` to export direct type aliases from `@dimforge/rapier3d-compat`.
   - Replaced custom duck-typed `ColliderLike` in `physicsFactory.ts` and `physicsBodyManager.ts` with canonical `Collider` type.

2. **Vite Plus build script update**:
   - Updated package.json `prebuild` script to invoke `node ./scripts/check-no-sync-reads.mjs` directly.
