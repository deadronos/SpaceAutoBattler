# Engine integration (R3F + Rapier3D)

## Update loop

- By default, Rapier3D runs on the main thread and is stepped from React Three Fiber’s `useFrame`.
- An optional worker simulation mode offloads stepping to a Web Worker, enabled via the `?sim_worker` / `?sim_worker_render` query flags (`src/game/simulationFeatureFlags.ts`, `src/worker/simulation.worker.ts`, `src/game/SimulationBridge.ts`). In render-only worker mode the main-thread tick is disabled.

## Separation of concerns

- Keep simulation state and rendering decoupled via ECS (Miniplex) and `GameState`.

## Assets and disposal

- GLTFs are cached via `@react-three/drei`’s `useGLTF`.
- Draco/Meshopt/KTX2 decoding is configured in `src/renderer/loaders/gltfDecoders.ts`; self-hosted decoder assets are emitted next to the app, and hull GLTFs are shipped compressed.
- Dispose any Three.js resources you create when appropriate.

## Rendering subsystems

- Quality presets live in `src/config/quality.ts` (renderer-only knobs for DPR, shadows, AO, bloom, particles, star shader).
- Postprocessing is configured in `src/config/postprocessing.ts`; it includes the `colorPipeline` (grade/tonemapping/bloom) and the N8AO ambient-occlusion pass.
- The camera rig lives under `src/renderer/cameraRig/` (pure trauma/shake math, consumed by `src/components/CameraRig.tsx`).

## Performance

- Prefer pooling/re-use and LOD for distant objects.
- Avoid per-frame allocations in hot code paths.
