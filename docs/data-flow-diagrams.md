# Major Data Flow Diagrams

This document catalogs the key runtime data flows in the project, using concise, box-and-arrow diagrams similar to the GLTF rendering pipeline doc. These are intended for quick orientation and system boundaries discovery. See also: docs/gltf-rendering-pipeline.md, docs/renderer-pipeline.md, and this file is referenced from those docs.

## 1) Boot + Worker Orchestration

`[main.ts] -> [simWorker.ts]
   (Init)        (Physics/Perf in Worker)
     |                ^
     | postMessage    | postMessage
     v                |
[Adapters] <------- events/acks
(time, physics, renderer)`

- Init: src/main.ts spins up a module Worker(new URL('./simWorker.ts', ...)), wires message handlers, and seeds state.
- Messaging: postMessage commands: init-physics, update-ships (with transfer), step-physics, dispose-physics.
- Returns: simWorker.ts replies with update-ships-done, step-physics-done, perf, or error events.
- Adapters: Main sets up TimeAdapter, PhysicsAdapter (worker-backed or noop), and RendererAdapter to decouple subsystems.

Files: src/main.ts, src/simWorker.ts, src/core/adapters/\*

## 2) Spawn → Physics/Renderer Sync

`[spawnSystem.ts]
   (Creates/Removes ships)                 
       |           
       v           
[adapters.physics] <----> [simWorker.ts]
       |           
       v           
[adapters.renderer] -> [synchronizer.ts] -> [meshFactory.ts | shipInstancer.ts]`

- Spawn: SpawnSystem emits add/remove updates for ships to adapters.
- Physics: Adds/removes bodies via PhysicsAdapter (worker-backed) so worker keeps canonical physical state.
- Renderer: RendererAdapter ensures visuals exist, delegating to synchronizer which creates instanced or unique meshes via meshFactory and shipInstancer.

Files: src/core/systems/spawnSystem.ts, src/core/adapters/{physicsAdapter,rendererAdapter}.ts, src/renderer/{synchronizer,meshFactory,shipInstancer}.ts

## 3) Projectile Lifecycle

`[projectileSystem.ts]
 (Spawns/updates GC)        
       |            
       v            
[adapters.physics] -> addBody/setState/removeBody
       |            
       v            
[adapters.renderer] -> ensureMesh/updateMesh/remove -> [bulletInstancer.ts]`

- Creation: System appends to state.bullets, notifies physics for body creation, and renderer for visual creation.
- Update/GC: Moves bullets, expires them (range/lifetime/collisions), updates physics & renderer, and frees visuals/bodies.
- Instancing: If enabled, ulletInstancer handles transforms and draw batching; otherwise meshFactory paths are used.

Files: src/core/systems/projectileSystem.ts, src/renderer/bulletInstancer.ts, src/renderer/meshFactory.ts

## 4) SVG Asset Pipeline (2D UI/Overlays)

`
[svgConfig.ts] -> [svgLoader.ts] -> [main.ts]
(Paths) (Loads/raster cache) (Boot, cache into state.assetPool)

[fileWatcher.ts] --(dev reload)--> [svgLoader.ts] --(invalidate)--> [main.ts UI hooks]
`

- Config: getShipSVGUrls and getShipSVGUrl provide canonical paths.
- Loader: getSVGLoader/loadSVGAsset caches and exposes assets; main.ts preloads into state.assetPool.
- Live-reload: ileWatcher.ts cooperates with svgLoader to invalidate and reload assets in dev.

Files: src/config/svgConfig.ts, src/core/svgLoader.ts, src/utils/fileWatcher.ts, src/main.ts

## 5) GLTF/Instancing Registration (3D Models)

`[shipModelMap.ts] -> [shipModelLoader.ts] -> [assetLoader.ts]
      (Config)          (Orchestrates)         (Fetches .glb)
                                           |
                                           v
                                   [Creates gltfProto]
                                           |
                                           v
                                     [state.assetPool]  <-- Handoff Point
                                           ^
                                           |
[threeRenderer.ts] <--- [shipInstancer.ts]
 (Drives updates)      (Consumes gltfProto, creates InstancedMesh)`

Files: src/config/shipModelMap.ts, src/core/shipModelLoader.ts, src/core/assetLoader.ts, src/renderer/{threeRenderer,shipInstancer}.ts

## 6) Per-Frame Render Tick

`[main.ts] -> [threeRenderer.ts]
   (RAF)        (Culling, sync, draw)
                 |          ^
                 v          |
     [synchronizer.ts] <----|
         |            
         v            
[meshFactory.ts | instancers] -> [cameraManager.ts] -> [sceneSetup.ts]`

- Frame: main.ts schedules RAF, calls renderer step with dt and state.
- Sync: Renderer culls, syncs transforms to instancers/meshes, updates health bars and bullets, and triggers effects.
- Camera/Scene: cameraManager updates matrices; sceneSetup manages scene graph, skybox, boundaries, and disposal.

Files: src/main.ts, src/renderer/{threeRenderer,synchronizer,meshFactory,cameraManager,sceneSetup}.ts

## 7) Effects Pipeline (Explosions, Shields, Trails)

`[unifiedEffectsManager.ts]
     (API) 
       | handles events: ships spawn/destruction, explosions
       v
[effects/*] -> [particleSystem.ts] -> [threeRenderer.ts] (tick integration)`

- Effects Manager: Orchestrates effect creation by event; quality toggles propagate.
- Modules: shieldEffect, railManager, and particleSystem handle visuals and updates.
- Integration: hreeRenderer calls per-frame updates and disposal hooks.

Files: src/renderer/{unifiedEffectsManager,particleSystem}.ts, src/renderer/effects/\*, src/renderer/threeRenderer.ts

## 8) AI Intent → Control Loop

`[ai/*] -> [intentManager.ts] -> [controller.ts]
 (scoring/steering)    (choose)        (apply to ships)
       |                                  
       v                                  
[decisionEngine.ts] + [targeting.ts] + [formation.ts]
       |
       v
[state updates] -> [adapters.physics] (velocity/forces) -> [simWorker.ts]`

- Intent: Scores behaviors (pursue/evade/roam/boundary) and selects best via decisionEngine.
- Control: controller.ts applies chosen intent to ship controls and desired kinematics.
- Physics: Adapter forwards body state changes; worker steps and returns results used next tick.

Files: src/core/ai/\*, src/core/ai/{intentManager,controller,decisionEngine}.ts, src/core/adapters/physicsAdapter.ts, src/simWorker.ts

## 9) Spatial Querying + Optimization

`[spatialIndex.ts] <-> [ai/*] & [systems/*]
  (grid/queries)       (targeting, separation, scanning)`

- Grid: SpatialGrid buckets entities; used heavily by AI and systems for locality queries and performance.
- Consumers: Target selection, separation, and engagement logic pull from spatial queries to avoid N^2 scans.

Files: src/utils/spatialGrid.ts, src/core/spatialIndex.ts, src/core/ai/_, src/core/systems/_

## 10) Event Surfaces (Bullets/Explosions/Shield/Health)

`[systems/*] -> [RendererAdapter] -> [threeRenderer.ts]
  (emit events)        (bridge)         (consume + visualize)`

- Stable event names: ullets, explosions, shieldHits, healthHits should be preserved.
- Flow: Systems detect and emit; renderer visualizes via instancers/effects.

Files: src/core/systems/\*, src/core/adapters/rendererAdapter.ts, src/renderer/threeRenderer.ts

---

Notes

- Determinism: Use src/utils/rng.ts seeded RNG throughout AI/sim for repeatable tests.
- Canonical State: src/types/index.ts GameState is the single runtime state; adapters and workers transform, but don’t hold separate long-lived global state.
- Memory: All render assets should be pooled and disposed via mesh/effect managers.
