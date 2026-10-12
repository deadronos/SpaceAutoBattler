# Asset Compression (glTF decoders + encoding)

This document describes how SpaceAutoBattler wires the glTF decoders used for compressed
models, and how to produce those compressed models. Part 1 of issue #649 registers the
decoders; the shipped models remain **uncompressed** until a human runs the encoder and
signs off, so there is no visual change today.

## Decoders used

| Format  | Decoder                                    | Self-hosted source                |
| ------- | ------------------------------------------ | --------------------------------- |
| Draco   | `DRACOLoader` (via `@react-three/drei`)    | `three/examples/jsm/libs/draco/*` |
| Meshopt | `MeshoptDecoder` (via `@react-three/drei`) | bundled in `three-stdlib`         |
| KTX2    | `KTX2Loader` (`three-stdlib`)              | `three/examples/jsm/libs/basis/*` |

All decoder assets are emitted into `dist/decoders/` with **stable, unhashed** filenames so
the loaders can fetch them by fixed name:

```
dist/decoders/draco_decoder.js
dist/decoders/draco_decoder.wasm
dist/decoders/draco_wasm_wrapper.js
dist/decoders/basis_transcoder.js
dist/decoders/basis_transcoder.wasm
```

The stable names come from the `draco_*` / `basis_transcoder*` rule in
`createOutputConfig().rollupOptions.output.assetFileNames` (`vite.config.ts`), which runs
before the generic hashed `.wasm` rule. Draco no longer points at the gstatic CDN.

## Registration order

1. **Import time** (`src/renderer/loaders/gltfDecoders.ts`): `useGLTF.setDecoderPath(dir)`
   registers the Draco decoder directory once, with no renderer required. drei keeps its own
   `DRACOLoader` and fetches `draco_decoder.wasm` / `draco_decoder.js` from that directory.
   The shared `KTX2Loader` is also constructed here (with the Basis transcoder path) so it
   exists before any glTF loader is created.
2. **Render phase** (`useGLTF` → `useLoader`): drei invokes `extendShipGltfLoader`, which
   attaches the shared KTX2 loader to the glTF loader. This must happen before the loader is
   cached, so the loader is constructed at import time rather than in `onCreated`.
3. **Renderer creation** (`Battlefield.tsx` → `configureBattlefieldRenderer`, called from
   `Canvas onCreated`): `configureGltfDecoders(gl)` runs `ktx2Loader.detectSupport(gl)` once
   on the shared instance. Detection is synchronous and completes before the asynchronous GLB
   fetch/parse, so the loader is already attached and supported by the time textures decode.
   Draco and Meshopt are configured by drei itself.

## Fallback behaviour

- `configureGltfDecoders` is idempotent: support detection runs at most once and never throws.
- The KTX2 loader is constructed at module scope inside a guard; if construction fails, the
  loader stays unset and `extendShipGltfLoader` becomes a no-op. Uncompressed assets continue
  to load through the normal glTF path — nothing throws.
- Assets currently ship **uncompressed**. To keep the runtime uncompressed, restore the `.glb`
  files from git; no loader changes are required.

## Encoding runbook

The encoder is `scripts/assets/compress-gltf.mjs`. It wraps the pinned
`@gltf-transform/cli@4.5.1` devDependency, keeps the scene graph, node/mesh names, and
materials intact, and **never writes into `src/` unless you pass `--in-place`**.

### Toolchain

| Step            | Tool                                               | Notes                                                                    |
| --------------- | -------------------------------------------------- | ------------------------------------------------------------------------ |
| Geometry + WebP | `@gltf-transform/cli@4.5.1` (pinned devDependency) | Installed by `pnpm install`; exposes `node_modules/.bin/gltf-transform`. |
| KTX2 textures   | KTX-Software `ktx` ≥ 4.3                           | Required **only** for `--texture ktx2`; not currently installed here.    |

KTX-Software: <https://github.com/KhronosGroup/KTX-Software/releases> (macOS: install the release
`.pkg`/`.dmg` from that page — there is no Homebrew formula). Make sure `ktx` is on your `PATH`;
the script checks for it and exits non-zero with install instructions if it is missing (no partial
writes).

### Commands

```bash
# Safe dry-run: writes to a temp dir, prints the byte table, never touches src/.
pnpm run assets:compress:check

# Real run (after human sign-off): writes back into src/assets/gltf/.
pnpm run assets:compress --in-place

# Restore the committed (uncompressed) originals.
pnpm run assets:compress --restore
```

Useful overrides:

```bash
pnpm run assets:compress --check --texture none     # geometry only
pnpm run assets:compress --check --compress meshopt # meshopt instead of draco
pnpm run assets:compress --check --texture ktx2     # requires KTX-Software
```

### Pipeline order (important)

Textures are applied **first**, geometry **last**. `gltf-transform` decodes
`KHR_draco_mesh_compression` when it reads a file and does not re-apply it when it writes, so
running geometry first would silently drop the Draco payload (fighter: 73.8 KB) instead of
composing both (fighter: 45.3 KB).

### Reference numbers (measured)

Per-format, on `fighter.glb` (504,988 B uncompressed):

| Format       | Result  | Extension                    |
| ------------ | ------- | ---------------------------- |
| draco        | 476 KB  | `KHR_draco_mesh_compression` |
| webp         | 73.8 KB | `EXT_texture_webp`           |
| draco + webp | 45.3 KB | both (default pipeline)      |
| ktx2         | blocked | needs KTX-Software `ktx`     |

Full default run (`--check`, draco + webp) over all five hulls:

| Asset         | Before (B) | After (B) | Delta (B)  | Delta (%) |
| ------------- | ---------- | --------- | ---------- | --------- |
| carrier.glb   | 524,860    | 47,252    | -477,608   | -91.00%   |
| corvette.glb  | 502,812    | 45,044    | -457,768   | -91.04%   |
| destroyer.glb | 533,436    | 47,788    | -485,648   | -91.04%   |
| fighter.glb   | 504,988    | 45,284    | -459,704   | -91.03%   |
| frigate.glb   | 520,540    | 46,520    | -474,020   | -91.06%   |
| **TOTAL**     | 2,586,636  | 231,888   | -2,354,748 | -91.04%   |

> Fill in this table from the real `--in-place` run before committing compressed assets.
> Numbers may shift slightly across `@gltf-transform` patch releases.

### Format notes

- **WebP** reduces **download** size only. No decoder wiring is needed: `EXT_texture_webp` is
  natively supported by three.js and by the `ship-renderer` test page. GPU upload still
  decompresses to full-size RGBA.
- **KTX2** (`KHR_texture_basisu`) is what reduces **VRAM** and upload cost; it relies on the
  KTX2 decoder wiring from part 1 (`src/renderer/loaders/gltfDecoders.ts`). `--texture ktx2`
  maps to the ETC1S Basis bitstream (smaller); switch to `uastc` for higher quality.

### Visual sign-off checklist

1. Run the dry-run and confirm the total is smaller (`pnpm run assets:compress:check`).
2. Run the Playwright hull suite: `pnpm run test:playwright:ship` (all five hulls:
   fighter, corvette, frigate, destroyer, carrier).
3. Review the pixel diffs by hand. Re-baseline **only** after a human confirms the hulls look
   correct — do not auto-accept diffs.
4. Commit the compressed `.glb` files in a dedicated PR; this encoder PR does not ship them.

### Fallback

Restore the uncompressed originals at any time:

```bash
git checkout -- src/assets/gltf
# or
pnpm run assets:compress --restore
```

Uncompressed assets load with no loader changes (see [Fallback behaviour](#fallback-behaviour)),
so reverting is always safe. `**/*.ktx2` is already in Vite's `assetsInclude` for forward
compatibility.

### `optimize` alternative (not the default)

`gltf-transform optimize` bundles destructive scene-graph edits (flatten, join, weld,
simplify, palette, instance, prune) that rename/merge nodes and would invalidate the
`ship-hulls` structure assertions. If you ever want it, disable every destructive step:

```bash
pnpm exec gltf-transform optimize <in> <out> --compress draco --texture-compress webp \
  --flatten false --join false --palette false --simplify false --weld false \
  --instance false --prune-attributes false
```
