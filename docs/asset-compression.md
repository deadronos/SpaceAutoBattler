# Asset Compression (glTF decoders)

This document describes how SpaceAutoBattler wires the glTF decoders used for compressed
models. Task 1 (issue #649) registers the decoders; the models themselves remain
**uncompressed** for now, so there is no visual change.

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

## Task 2 runbook pointer

Task 2 (asset encoding) is deferred. It will compress the `.glb` models (Draco/Meshopt) and
convert embedded textures to KTX2, relying on the decoders registered here. `**/*.ktx2` is
already in Vite's `assetsInclude` for forward compatibility.
