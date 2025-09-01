# Performance Review — src/

Date: 2025-09-01

Scope: quick static + code-path review of important runtime modules under `src/` (entry, core simulation, renderer, svg/asset loading, and worker patterns). This is *not* a runtime profiler — it's an expert audit and prioritized remediation plan with low-risk fixes and higher-impact improvements.

Summary headline
- Overall, the codebase shows many strong performance practices (instancing support, pooled materials, using a worker for physics, minimal per-frame allocation in several hot paths). 
- Main opportunities: avoid per-frame O(n^2) lookups, reduce structured-clone / object-heavy messages between threads, reuse objects (avoid allocations in hot loops), and batch DOM updates. 

Scoring convention: percent indicates how well the module follows common JS/Browser performance best practices for a real-time WebGL + simulation app (higher = better). Scores are conservative estimates based on static reading.

## Overall scores (high-level)
- `src/renderer/threeRenderer.ts` — 85%  
  Good: instancing options, material pooling, cached temp vectors, deferred resource loading, GPU billboards.  
  Issues: some per-frame allocations (Quaternion creation, occasional array/object creation in loops), some per-frame expensive texture updates/Canvas operations, and frequent use of .find lookups which can be O(n).

- `src/main.ts` — 75%  
  Good: async preloading, physics worker shim, decoupled render/step loops, asset pool.  
  Issues: uses `Array.find` in hot update paths (e.g., applying transforms from worker), occasional DOM lookups inside the render loop (getElementById called in frame), and a message protocol that clones object arrays (transforms) instead of packed/transferable buffers.

- `src/simWorker.ts` — 70%  
  Good: isolates Rapier inside worker, creates bodies and steps world.  
  Issues: communicates transforms as arrays of objects (heavy structured-clone cost); creates/removes rigid bodies on `update-ships` messages (can be costly at scale); lacks use of transferable typed arrays for bulk updates.

- `src/core/physics.ts` — 80%  
  Good: local Rapier usage, sensible encapsulation and cleanup.  
  Issues: similar to simWorker: object allocations when syncing results back; could expose more batch-friendly API (typed arrays or pooled data views) and avoid repeated find lookups for ship mapping.

- `src/core/gameState.ts` — 78%  
  Good: clear separation of responsibilities, spatial grid support and shipIndex map present.  
  Issues: many loops still use `state.ships.find(...)` and other linear searches; some operations (bullet-vs-ship checks) are O(ns * nb) and could use the spatial grid for queries to reduce cost for larger counts. shipIndex is recreated sometimes rather than incrementally maintained.

- `src/core/svgLoader.ts` — 70%  
  Good: caching, file-watching hooks, optional worker rasterization support.  
  Issues: main-thread rasterization is always used (rasterizeSVG calls rasterizeMainThread). Rasterization uses data-URL + Image loading and createImageBitmap from canvas — this can be slower than using response.blob + createImageBitmap(blob, {resizeWidth,...}). The HEAD-based last-modified fallback returns Date.now() which can cause cache churn. Worker path exists but appears unused/disabled.

- `src/renderer/shipInstancer.ts`, `bulletInstancer.ts`, `healthBarInstancer.ts` — estimated 80% (not fully read line-by-line)  
  Good: instancing is present, which is excellent for many objects.  
  Issues: Ensure instancer APIs support marking instance matrices dirty only once per frame and expose efficient bulk updates; avoid per-instance object allocations and prefer passing raw mats/arrays.

- `src/core/assetLoader.ts`, `core/assetPool.ts` — estimated 75% (not fully read)  
  Suggest: prefer response.blob + createImageBitmap for images, ensure textures reuse three.Texture objects when only contents change (call texture.image = bitmap; texture.needsUpdate = true rather than create new Texture every time).

- `src/utils/*` (logger, rng, vector helpers, spatialGrid) — estimated 80%  
  Most utilities are small and reasonable. Check `spatialGrid` implementation to ensure queries are O(1) per bucket and grid updates avoid full rebuilds.


## Key findings and concrete recommendations (module by module)
I focus on practical, low-risk fixes first (quick wins), then higher-impact refactors.

### 1) main.ts (75%) — rating rationale & fixes
Problems found
- Worker -> main message handler iterates `for (const transform of transforms) { const ship = state.ships.find(s => s.id === transform.shipId); ... }` This is O(n*m) when transforms length is large and each find is O(n).  
- In the render loop, scoreboard update calls `document.getElementById('redScore')` every 0.5s inside the frame function — wasteful because `bindUI` already acquires references.  
- Physics shim sends whole ship objects in `update-ships` messages using structured cloning, causing copy overhead.

Quick wins (apply in ~1-2 hours)
- Use `state.shipIndex` (Map<id, Ship>) for O(1) lookup in worker message handler when applying transforms instead of `Array.find`. Replace the per-transform .find with map lookups. E.g., const ship = state.shipIndex.get(transform.shipId). This has almost zero risk.  
- Replace document.getElementById calls in `startLoops` FPS update with cached `ui.redScore` / `ui.blueScore`. Remove redundant DOM lookups.  
- In the physics worker shim, when receiving transforms, avoid sending arrays of objects; instead pack transforms into a Float32Array or two typed arrays and postMessage with transfers. If you need a quick low-risk approach: the worker can keep sending an array of floats in the shape [shipId, px,py,pz, vx,vy,vz, ...]. This reduces clone cost by using Transferable ArrayBuffers.

Higher-impact improvements
- Implement double-buffered state between main and physics worker: worker maintains its own copy of physics-managed arrays, sends compact typed-array snapshots of positions/velocities each step. Main consumes snapshots, updates visible state. Avoid repeated object creation.
- If main thread must send ship updates to worker, use a compact typed array for positions, plus a small change-bitmask to only update changed entries.


### 2) simWorker.ts (70%)
Problems
- `postMessage` of `transforms` as an array of objects is expensive.  
- `update-ships` path does create/remove rigid bodies frequently based on incoming ship list; creation/removal is moderately expensive in Rapier.  
- `require('@dimforge/rapier3d-compat')` usage is fine but consider dynamic import or preloading in worker init to reduce latency.

Quick wins
- Use typed array packing for transforms when sending data back to main thread (Float32Array/Int32Array) with postMessage(..., [buffer]) to transfer ownership. For example: per-step an ArrayBuffer with length (#entities * 7) storing [shipId:int32, px,py,pz, vx,vy,vz as float32]. This reduces structured-clone overhead and GC churn on both sides.
- Avoid removing/creating rigid bodies often: when ships are removed, instead of immediately world.removeRigidBody, consider marking bodies inactive and reusing them (pool). Only remove bodies when the pool grows beyond a safe maximum or on dispose.

Higher-impact
- Implement a compact index mapping (shipId -> continuous index) inside the worker so arrays can be used for physics state rather than Map/object heavy storage. It will allow near-native performance for large numbers of bodies.


### 3) threeRenderer.ts (85%)
Good practices present
- Uses instancing when enabled.  
- Pooled billboard materials via Map to avoid creating many ShaderMaterial instances.  
- Cached temporary vectors (tempCamRight, tempCamUp, tempCamForward) to reduce allocations.  
- Precomputes star fields and only redraws skybox at a controlled frequency.

Problems & fixes
- Per-frame allocation: in updateTransforms(), `if (RendererConfig.instancing.enableShips && shipInstancer.hasShip(s.id)) { const q = new THREE.Quaternion(); q.setFromEuler(...); ... shipInstancer.updateTransform(s.id, s.pos, q, scale); }`. Allocating a `new THREE.Quaternion()` every ship every frame can be expensive. Reuse a single Quaternion instance (or a small pool) in the function.  
- Many places use `state.ships.find(...)` and `state.ships` iteration that mixes with Map lookups. For entity-lookup patterns, iterate the state.ships array and operate on indexes, avoid repeated `.find` calls inside loops.  
- Creating a new THREE.Texture(imageBitmap) inside meshForShip could be expensive if done repeatedly; prefer reusing a three.Texture object and update its .image = newBitmap; .needsUpdate = true. If multiple ships share the same bitmap, reuse the same texture instance. The code already attempts to cache `assetPool`, which is good — ensure the renderer reuses textures rather than creating a new THREE.Texture each time an asset is loaded.  
- Skybox: updating canvas textures frequently causes CPU->GPU uploads. Keep update frequency low and avoid full redraws every frame. The code already tries to limit updates by a frequency but verify the frequency and make it configurable.  

Quick wins
- Replace per-ship new Quaternion creation with a reused temp Quaternion object or reuse existing object attached to shipMeshes map.  
- Ensure `shipMeshes.get(s.id)` returns a stable object or transform container so we can mutate without reallocating.  
- When rasterized ImageBitmap is assigned to textures, prefer newTexture.image = imageBitmap; newTexture.needsUpdate = true rather than creating a completely new THREE.Texture wrapper every time.


### 4) core/gameState.ts (78%)
Problems
- Collision detection uses naive nested loops (for each bullet, iterate all ships). Spatial grid exists but isn't used by bullet collision logic. This is the primary algorithmic scaling issue.  
- Frequent usage of `state.ships.find(...)` inside loops increases CPU cost; rely on `state.shipIndex` (Map) for O(1) lookups and maintain it incrementally rather than rebuilding on every apply.

Quick wins
- Use `state.spatialGrid` to query nearby ships for each bullet (e.g., grid.query(bullet.pos, radius)) and only test collisions against that smaller set.  
- Maintain `state.shipIndex` incrementally (add/remove on spawn/remove) and use it in worker transform application and other lookups.

Higher-impact
- For very large numbers of bullets/ships, move collision detection to worker using Rapier or a custom broadphase in worker and send only collision events to main.


### 5) core/physics.ts (80%)
Problems
- Similar to simWorker: results are read from Rapier and then applied to JS objects; consider sending positions as typed arrays for main consumption.  

Fixes
- Provide an alternate `exportPositionsToArray` helper that packs [id, px,py,pz, vx,vy,vz] into typed array to be transferable. This lets the renderer apply updates without heavy object allocation.


### 6) core/svgLoader.ts (70%)
Problems
- The rasterizeMainThread uses a base64 data URL and Image to load SVG. That's slower and memory-heavier than using response.blob() + createImageBitmap(blob, {resizeWidth, resizeHeight}) which avoids the extra canvas draw in many browsers.  
- The worker rasterization path exists but the code currently prefers main-thread rasterization; enabling a worker+OffscreenCanvas + transfer of the resulting ImageBitmap is a big win.  
- getFileModificationTime fallback returns Date.now() causing `hasFileChanged` to almost always be true after load; this can cause redundant reloads.

Quick wins
- Use `fetch(url)` -> response.blob() -> createImageBitmap(blob, {resizeWidth, resizeHeight}) where supported. This avoids creating a DOM Image and avoids data-URL base64 encoding/decoding cost.  
- When worker is available and OffscreenCanvas supported, send the blob to the worker and rasterize there using OffscreenCanvas and transfer the resulting ImageBitmap to main via transferable.
- Improve `getFileModificationTime` to use ETag or content hashing when possible, or cache the last-modified header rather than using Date.now() fallback.


## Prioritized Quick Wins (ordered by cost/impact)
1. Replace `Array.find` lookups used during physics transform application with `state.shipIndex.get(id)` in `main.ts` message handler (very low risk, high impact).  
2. Replace DOM `getElementById` inside the frame loop with cached UI references from `bindUI()` (low risk).  
3. Pack physics transforms into Transferable typed arrays (Float32Array/Int32Array) between worker <-> main to avoid structured-clone overhead (medium risk, high impact).  
4. Reuse Quaternion and other temporary objects in `threeRenderer.updateTransforms()` instead of allocating per-ship per-frame (low risk).  
5. Use spatial grid queries for bullet collision checks in `core/gameState.ts` instead of full scans (medium risk, high impact for scale).  
6. Use response.blob() + createImageBitmap(blob, ...) or enable OffscreenCanvas worker rasterization in `svgLoader` (medium risk, medium impact).


## Suggested next steps (implementation plan)
- Implement quick wins 1,2,4 first and run a smoke test to ensure no behavior regressions.  
- Then implement typed-array transfer for physics transforms (3). This will require updating both simWorker.ts and main.ts shim to agree on a binary layout; start with a simple format: [count:int32, id1:int32, px,py,pz,vx,vy,vz, id2, ...] where floats are float32. Transfer the buffer each step.  
- Add unit or integration tests for the new message format (small harness that fakes worker and checks correctness).  
- Replace per-bullet all-vs-all collision checks with spatialGrid.query per bullet (or do ship-centric checks and reduce repeat work).  
- Enable worker-based SVG rasterization with OffscreenCanvas+ImageBitmap-transfer where supported; fall back gracefully.


## Suggested micro-benchmarks / tests to run after changes
- Measure structured-clone time: create an array of N transforms (objects) and time postMessage cost vs typed-array transfer for N = 100, 500, 2000.  
- Render loop CPU: measure ms/frame before/after replacing new Quaternion with reused quat for fleet sizes 100/500.  
- Game update: measure simulateStep time and collision path costs before/after spatial grid usage with realistic bullet rates.


## Notes & Assumptions
- I performed a static read of many hot-path files (`main.ts`, `simWorker.ts`, `threeRenderer.ts`, `core/gameState.ts`, `core/physics.ts`, `core/svgLoader.ts`) and sampled `renderer/*` and `core/*` directories. Some modules (e.g., `shipInstancer.ts`, `bulletInstancer.ts`, `assetLoader.ts`) were not fully line-by-line inspected; where applicable I gave an estimated rating and generic guidance.  
- I assumed the app targets modern browsers with support for ImageBitmap, OffscreenCanvas, Web Workers, and transferable ArrayBuffers. Please confirm if legacy platforms need to be supported and I will tailor fallbacks.


## Deliverables in this pass
- This file: `PERFORMANCE_REVIEW_SRC.md` (written to repo root) with per-module review and prioritized fixes.

If you'd like, I can: 
- Open a PR that implements the low-risk quick wins (1,2,4) and adds microbenchmarks (bench scripts) to the repo.  
- Implement typed-array transfer protocol for physics worker and update both `simWorker.ts` and `main.ts` shim (this requires coordinated edits and tests).  

Tell me which follow-up you'd like me to implement next (I can start with the low-risk quick fixes and create a PR).