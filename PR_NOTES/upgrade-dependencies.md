# Dependency Upgrade Migration Notes

## 2026-10-09 upgrade: vite-plus 1.1 / playwright 1.64 / pixelmatch 8

### Upgraded packages

- **vite-plus**: `1.0.0` -> `1.1.0`
- **vite** (`@voidzero-dev/vite-plus-core`): `1.0.0` -> `1.1.0` (both the devDependency alias and the
  `pnpm.overrides` entries moved from `~1.0.0` to `~1.1.0`)
- **playwright**, **@playwright/test**, **playwright-core**: `1.63.0` -> `1.64.0`
- **pixelmatch**: `7.2.0` -> `8.0.0`
- **@babel/core**, **@babel/preset-env**: `8.0.6` -> `8.0.7`
- **happy-dom**: `20.14.5` -> `20.14.6`
- **rollup**: `4.64.0` -> `4.64.3`
- **three-mesh-bvh**: `0.9.15` -> `0.9.16`

### Key fixes & notes

1. **vite-plus 1.1 / oxfmt formatting**: the newer formatter enforces updated rules. Re-ran
   `vp check --fix`, which reformatted `src/components/progression-panel.css`, `src/debug/debugPanel.css`,
   `docs/large-file-refactor-candidates.md`, and `.github/chatmodes/voidbeast-gpt41enhanced.chatmode.md`,
   and dropped a redundant `export {};` from `src/utils/patchGltfLoader.ts` (the file already imports a
   module, so the statement was a no-op).
2. **pixelmatch 8**: the API signature is unchanged — `pixelmatch(img1, img2, output, width, height, { threshold })`
   is still supported. v8 only changes the internal diff metric (OKLab HyAB distance), so no source changes
   were required. It is used only by the Playwright visual-baseline specs.

### Verification

- `pnpm run typecheck` — pass
- `pnpm exec vp check` — 0 errors (53 warnings)
- `pnpm test` — 170 passed | 1 skipped (923 tests passed)
- `pnpm run build` — pass
- `pnpm install --frozen-lockfile` — clean

---

## 2026-10 upgrade: vite-plus 1.0 / vitest 5 / three 0.186

### Upgraded packages

- **vite-plus**: `0.2.8` -> `1.0.0`
- **vite** (`@voidzero-dev/vite-plus-core`): `0.2.8` -> `1.0.0`
- **vitest** (`@voidzero-dev/vite-plus-test` `0.1.24` -> `vitest` `5.0.3`)
- **@vitest/coverage-v8**: `4.1.10` -> `5.0.3`
- **three**: `0.185.1` -> `0.186.1` (`@types/three` -> `0.186.0`)
- **@dimforge/rapier3d-compat**: `0.20.0` -> `0.21.0`
- **react**, **react-dom**, **react-test-renderer**: `19.2.8` -> `19.3.0`
- **playwright**, **@playwright/test**, **playwright-core**: `1.62.1` -> `1.63.0`
- **@babel/core**, **@babel/preset-env**: `8.0.1` / `8.0.2` -> `8.0.6`
- **@react-three/fiber**: `9.7.0` -> `9.8.1`, **@react-three/drei**: `10.7.8` -> `10.7.9`
- **@types/node**: `26.2.0` -> `26.6.4`
- Plus minor/patch bumps for the remaining direct dependencies (see the `package.json` diff).

### Key fixes & breaking changes

1. **Vite Plus 1.0 toolchain**:
   - `vite-plus` now bundles real `vitest` 5 and no longer ships `@voidzero-dev/vite-plus-test`.
   - Removed the `pnpm.overrides` alias for `vitest`.
   - Removed `patches/@voidzero-dev__vite-plus-test.patch` and the `patchedDependencies` entry.
   - Updated the `vite` and `@voidzero-dev/vite-plus-core` overrides/devDependency to `~1.0.0`.
   - Added direct `vitest` (`^5.0.1`) and `@vitest/coverage-v8` (`^5.0.1`) devDependencies so
     `vitest/globals` types resolve.

2. **three 0.186 CommonJS entry**:
   - `three/build/three.cjs` is now a thin `module.exports = require('./three.module.js')` wrapper,
     so named exports are no longer own-enumerable on the interop object returned by
     `vi.importActual('three')`.
   - Updated the `three` mock in `test/components/Battlefield.spec.tsx` to unwrap the real
     namespace before spreading, otherwise all constants (`SRGBColorSpace`, `NoToneMapping`, ...)
     are dropped.

3. **Removed `@types/pixelmatch`**:
   - `pixelmatch` 7.x ships its own type definitions; the DefinitelyTyped package is now a
     deprecated stub.

4. **Rapier 0.21**: no source changes required; typecheck and unit tests pass.

5. **Formatting**: re-ran `vp fmt` for the files whose formatting changed under the newer `oxfmt`.

### Verification

- `pnpm run typecheck` — pass
- `pnpm test` — 170 passed | 1 skipped (923 tests passed)
- `pnpm run build` — pass
- `vp check` — 0 errors
- `pnpm install --frozen-lockfile` — clean

---

## Previous upgrade: rapier 0.20 / vite-plus-core 0.2.8

### Upgraded Packages

- **@dimforge/rapier3d-compat**: `0.19.3` -> `0.20.0`
- **vite**: `@voidzero-dev/vite-plus-core` `0.2.6` -> `0.2.8`
- **vitest**: `@voidzero-dev/vite-plus-test` `0.1.24`
- **@react-three/fiber**: `9.6.1` -> `9.7.0`
- **@react-three/drei**: `10.7.7` -> `10.7.8`
- **three-mesh-bvh**: `0.9.13` -> `0.9.14`
- **playwright**: `1.62.0` -> `1.62.1`
- **@types/node**: `26.1.2` -> `26.2.0`
- **tsx**: `4.23.1` -> `4.23.12`

### Key Fixes & Breaking Changes

1. **Rapier 0.20 API / Type updates**:
   - `Rapier.init()` no longer expects an options object parameter (e.g., `Rapier.init()` instead of `Rapier.init({})`).
   - `Rapier.EventQueue` constructor expects boolean `autoDrain` parameter directly (e.g., `new Rapier.EventQueue(true)` instead of `{ auto: true }`).
   - Updated Rapier type imports in `src/types/core.ts` to export direct type aliases from `@dimforge/rapier3d-compat`.
   - Replaced custom duck-typed `ColliderLike` in `physicsFactory.ts` and `physicsBodyManager.ts` with canonical `Collider` type.

2. **Vite Plus build script update**:
   - Updated package.json `prebuild` script to invoke `node ./scripts/check-no-sync-reads.mjs` directly.
