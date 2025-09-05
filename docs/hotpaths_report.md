Hot Paths Analysis — Worker Migration Recommendations

Scope
- Goal: identify likely CPU/IO hot paths in the codebase and rate (0-100%) how beneficial it would be to move each path to a worker (off-main-thread). Provide a short rationale, risk/cost notes, and suggested migration steps and tests.

Method
- Searched repository for worker usage, physics, rasterization, spatial queries, asset loading and AI batching patterns.
- Read key files: `src/simWorker.ts`, `src/core/physics.ts`, `src/core/svgRasterWorker.impl.ts`, `src/core/svgRasterWorker.ts`, `src/core/svgLoader.ts`, `src/core/spatialIndex.ts`, `src/core/assetLoader.ts`, and AI batching code under `src/core/ai/batchedQueries.ts`.

Summary of Candidates (rating = percent benefit from moving to worker)

1) Physics simulation (existing): `src/simWorker.ts`, `src/core/physics.ts`
- Rating: 95%
- Why: Physics (Rapier) is already heavy (WASM + stepping) and the repo already uses `simWorker.ts` via a Worker from `main.ts`. Running physics off-main is high-benefit: reduces main-thread stalls and enables stable rendering/frame timings. The sim worker already exists and handles step/update messages and returns transforms. Keeping physics in a worker preserves determinism and is low-risk because the code already supports worker mode with a main-thread fallback.
- Risks/Cost: Complexity in message protocol, transfer of large transform buffers (use transferables to avoid copies). Need careful sync if deterministic replay is required. Error handling paths already present.
- Recommended steps: Keep current approach; ensure transform arrays use ArrayBuffer transfer (already done in some places), measure message sizes, and consider batching updates and using SharedArrayBuffer if tighter sync is needed.
- Tests: Stress test with large ship counts (1000+) and measure frame time. Unit test physics stepper behavior both in-worker and in-process.

2) SVG rasterization: `src/core/svgRasterWorker.impl.ts`, `src/core/svgRasterWorker.ts`, `src/core/svgLoader.ts`
- Rating: 85%
- Why: SVG rasterization uses OffscreenCanvas and createImageBitmap — CPU and GPU work that can block the main thread if run there. The project already implements a worker-based rasterizer with caching and fallbacks. Moving rasterization fully to workers greatly reduces main-thread work when loading or recoloring ship assets.
- Risks/Cost: Browser compatibility (OffscreenCanvas availability), transferable ImageBitmap handling (already used), worker initialization complexity; main-thread fallback already exists. Potential extra memory usage for cached bitmaps in worker.
- Recommended steps: Ensure worker always returns ImageBitmap via transfer. Audit `SVGLoader.rasterizeWithWorker` to ensure event handlers are removed on timeout and to forward worker errors to loader. Add metrics for raster time vs main-thread.
- Tests: Load many SVGs in parallel (e.g., spawning many ships) and measure main-thread frame time with and without worker rasterization.

3) Asset loading (GLTF) and decoding: `src/core/assetLoader.ts`
- Rating: 60%
- Why: GLTF/three loaders can be CPU-heavy, especially parsing and geometry creation. However three/examples loaders often assume main-thread DOM/webgl context for some parts. Offloading parsing (GLTF, Draco decoding) to workers helps, but integration into Three.js scene objects on main thread still required.
- Risks/Cost: Integration complexity with three.js and GLTFLoader; requires worker-enabled loaders or using dedicated parsing libraries (e.g., glTF parser in worker, then main thread constructs three objects). Some decoders (Draco) need WASM and special loader wiring.
- Recommended steps: Identify expensive decode steps (Draco, KTX2) and replace with worker-enabled decoders or use existing three worker loader patterns. Cache parsed results in assetPool. Add a worker fallback.
- Tests: Time to load GLTFs and frame impact while loading.

4) Spatial index queries & AI batched queries: `src/core/spatialIndex.ts`, `src/core/ai/batchedQueries.ts`, `src/core/ai/*` (targeting, steering)
- Rating: 55-75% depending on workload
- Why: Spatial queries (k-nearest, sector queries, raycasts) run frequently per-frame and per-entity. If many entities are present and AI runs many queries per ship, offloading queries or batching them to a worker can reduce main-thread CPU. The repo already has batching (BatchedQueryManager) and an adapter pattern; these are good levers for workerization.
- Risks/Cost: Moving spatial index to a worker requires transferring state (positions, entity lists) each frame or using structured transfer (ArrayBuffer). Latency must be low for per-frame AI; possible approach: keep a lightweight spatial index in worker and send ship transforms as Float32Array with transferable buffer each tick and receive results. Complexity: more message-passing and potential staleness.
- Recommended steps: Start with optional worker mode for heavy scenarios: implement a spatial worker that accepts batched position updates (Float32Array) and responds with per-ship query results or reduced summaries (nearest id, neighbor counts). Reuse BatchedQueryManager to minimize messages.
- Tests: Compare frame CPU usage with 200/500/1000 ships and measure AI latency.

5) Renderer-side heavy precomputation (instancing, BVH mesh building): `src/renderer/*` (shipInstancer, bvhManager, meshFactory)
- Rating: 40%
- Why: Some renderer tasks (BVH building, complex geometry construction) can be expensive. However these often require GPU/webgl context or three.js objects that must be created on the main thread. Offload only pure CPU parts (index generation, vertex processing) to a worker and send resulting buffers to main thread for final GPU upload.
- Risks/Cost: Need to design data transfer shapes (ArrayBuffers), and the final upload to GPU still on main thread. Also browser security constraints on transferring GPU resources.
- Recommended steps: Identify pure CPU sub-steps (index merging, vertex attribute generation) and implement worker-based processors that output ArrayBuffers. Keep instancer management main-thread.
- Tests: Measure mesh build time and frame stutter during on-demand instancing.

6) AI decision engine & pathfinding: `src/core/ai/decisionEngine.ts`, `src/core/ai/*`
- Rating: 50%
- Why: AI logic (rule evaluation, pathfinding) can be CPU-bound if complex per-entity. Some parts already attempt batching. Workerization helps if logic is heavy and parallelizable. But AI often needs frequent reads/writes of GameState; decoupling requires snapshots or reduced data views, increasing complexity.
- Risks/Cost: High integration cost, potential state sync complexity, debugging difficulty. Prefer profiling to identify hot AI functions first.
- Recommended steps: Instrument AI to find hotspots; extract pure compute functions (e.g., scoring, steering) and run them in worker with compact inputs/outputs (Float32Arrays, small structs).
- Tests: Benchmarks for decision loop over N ships.

7) File watching, polling and I/O utilities: `src/utils/fileWatcher.ts` and similar
- Rating: 10%
- Why: File watching/polling runs in dev/desktop environment; not a runtime production concern in browsers. Offloading to an extension or separate service is unnecessary.
- Risks/Cost: Low priority. Keep as-is.

Per-item short recommendations and next steps
- Physics (95%): Keep and harden current worker approach. Verify ArrayBuffer transfer usage, add telemetry for step time, message round-trip, and queue sizes. Consider SharedArrayBuffer for very low-latency sync if needed (requires COOP/COEP headers).

- SVG rasterization (85%): Ensure worker path is default for rasterization. Audit `SVGLoader.rasterizeWithWorker` for handler leaks and improve timeouts. Add metrics to detect OffscreenCanvas absence and fall back gracefully.

- Asset loading (60%): Add worker-based parsing for GLTF where possible. Use worker decoding for Draco, KTX2. Add a promise-based pool manager to avoid multiple concurrent heavy parses.

- Spatial index & AI batching (55-75%): Prototype a spatial worker that accepts per-frame Float32Array of entity positions and returns nearest-neighbor summaries for active ships. Integrate with `BatchedQueryManager` to only request results for ships that need them.

- Renderer-heavy CPU (40%): Offload index and vertex calculations to workers returning ArrayBuffers for final GPU upload.

- AI decision engine (50%): Profile to confirm hotspots. Extract small pure functions for workerization.

- File/IO utilities (10%): Leave in main thread; low impact.

Quality gates and tests
- Create micro-benchmarks for each candidate: spawn N ships, measure main-thread frame time, worker message latency, and total CPU.
- Add unit-tests for message handlers and fallback paths (e.g., `SVGLoader` fallback when worker fails).
- Run `npm run typecheck && npm test` after changes.

Appendix: Evidence from codebase
- `src/simWorker.ts` exists and is used by `src/main.ts` when available (main thread code constructs Worker new URL('./simWorker.ts', import.meta.url)).
- `src/core/svgRasterWorker.impl.ts` implements OffscreenCanvas-based rasterization and implements caching.
- `src/core/svgLoader.ts` already prefers worker rasterization and includes timeouts and fallbacks.
- `src/core/physics.ts` contains physics step and world creation for in-thread fallback.
- Spatial indexing and batched AI queries exist (`src/core/spatialIndex.ts`, `src/core/ai/batchedQueries.ts`), which are good starting points for workerization.

Notes on assumptions
- Assumed target runtime is the browser. Workerization decisions factor in browser constraints (no worker access to DOM/GL context). If running in Node or Electron main process, recommendations may differ.
- Assumed deterministic simulation is desired; message-passing adds potential nondeterminism unless carefully synchronized.

Files inspected (non-exhaustive)
- src/simWorker.ts
- src/core/physics.ts
- src/core/svgRasterWorker.impl.ts
- src/core/svgRasterWorker.ts
- src/core/svgLoader.ts
- src/core/assetLoader.ts
- src/core/spatialIndex.ts
- src/core/ai/batchedQueries.ts
- src/main.ts (briefly checked worker wiring)

Next steps I can take (pick one):
- Implement telemetry hooks in `simWorker.ts` and `SVGLoader` to measure timings.
- Create a small benchmark script in `test/` that spawns many ships and measures frame timing.
- Prototype a spatial-worker that accepts Float32Array positions and returns nearest indices for a subset of IDs.

Requirements coverage
- Searched and reviewed candidate files: Done
- Produced a `/docs/hotpaths_report.md` with ratings and recommendations: Done

