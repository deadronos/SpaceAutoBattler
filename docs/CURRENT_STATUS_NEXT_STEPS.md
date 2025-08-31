Top 5 performance improvements (actionable, prioritized)
Reuse a single AIController instance per GameState
Issue: simulateStep creates a new AIController(state) every tick. That allocates maps (e.g., roaming anchors) and closures repeatedly.
Action:
Add state.aiController ??= new AIController(state) during initialization and reuse it: state.aiController.updateAllShips(dt).
Keep it robust to state resets (recreate or provide a reset method).
Files:
gameState.ts (simulateStep) and state shape (types if needed).
Impact: High (tick-hot path, reduces per-frame allocation/GC).
Effort: Low.
Validation: Profile allocations; CPU time for AI step should drop measurably.
Status: Implemented. Added optional `aiController` on `GameState`, reused in `simulateStep` and legacy `stepShipAI`, and cleared in `resetState`.
Replace full spatial-grid rebuilds with incremental updates (or at least amortize)
Issue: updateSpatialGrid(state) clears the grid and reinserts all ships every step, causing GC and O(n) rebuilds.
Options:
Incremental: Expose grid.move/update to update positions by id instead of clear+reinsert.
Amortize: Rebuild every N ticks; use last-known positions for AI queries in-between (already acceptable since AI looks at previous step).
Files:
gameState.ts (updateSpatialGrid), spatialGrid.ts for incremental API.
Impact: High for larger fleets.
Effort: Medium (API and call sites).
Validation: CPU time per tick; GC pressure; no behavior regressions.
Stop per-frame CPU updates to skybox data textures; animate via shader uniforms
Issue: threeRenderer.updateSkyboxAnimation iterates a large texture and triggers texture.needsUpdate = true frequently. That’s a big CPU-to-GPU upload each frame (or every few frames), very expensive.
Action:
Move twinkle/nebula animation into a fragment shader with a time uniform; keep the texture static.
Update a uTime uniform each frame instead of CPU-writing the texture.
Files:
threeRenderer.ts (remove per-pixel writes), introduce a small custom material/shader or a simple onBeforeCompile patch.
Impact: High (GPU-friendly, removes large CPU cost).
Effort: Medium.
Validation: FPS uplift; GPU/CPU frame-time reduction in DevTools (Timings), visual parity.
Reduce worker messaging and serialization overhead (no JSON stringify diff; use typed arrays)
Issue: Worker sync in main.ts builds shipData, compares via JSON.stringify, and posts whole arrays frequently; that’s heavy on CPU and GC.
Action:
Maintain a pooled Float32Array (SoA or AoS) for positions/velocities; detect changes via a version or bitmask; postMessage with transferable ArrayBuffer only when changed and only the minimal slice.
Alternatively, use a fixed SharedArrayBuffer and remove most messaging.
Files:
main.ts (worker shim in physicsStepper.step), simWorker.ts (read typed arrays).
Impact: High (main-thread responsiveness, CPU).
Effort: Medium.
Validation: Lower main thread time; fewer/shorter messages; fewer GC spikes.
Reduce per-frame scene updates: dirty flags and/or instancing
Issues:
Health and shield UI elements updated every frame even when unchanged.
Per-ship meshes are individual objects; draw call count grows with ships.
Actions:
Add dirty flags: store previous health/shield per ship on the renderer side; only update health bar geometry/materials and shield uniforms when values change.
Move ships and health bars to InstancedMesh where possible; update per-instance matrices each frame; keep per-ship special cases as non-instanced.
Add coarse culling (distance/frustum) before updating expensive attachments.
Files:
threeRenderer.ts (updateTransforms, health/shield updaters), possible new instancing utility.
Impact: Medium→High (depends on fleet size).
Effort: Medium.
Validation: Draw calls count down; CPU time for render step drops; stable visuals.
Other quick wins (low effort)
UI updates: in main.ts frame stats, you already throttle to 0.5s; replace the document.getElementById calls with the cached ui.redScore and ui.blueScore handles to shave micro-cost per update.
Physics cap: consider dynamic maxSteps based on state.speedMultiplier or dropping sim steps (with warning) when the frame is too far behind to keep visual smoothness.
Duplicate loops verdict
No duplicate or conflicting frame/sim/renderer loops detected. Single rAF controls both fixed-step sim and rendering. The performance issues stem from repeated heavy work inside the single loop (allocations, full-grid rebuilds, CPU texture writes, message serialization), not duplicated loops.
Suggested order of execution (fast to impactful)
Reuse single AIController (easy, immediate benefit).
Typed array worker messaging (remove stringify; big main-thread savings).
Skybox animation via shader uniforms (cuts CPU uploads).
Dirty flags for UI/shield/health updates (reduce per-frame churn).
Spatial grid incremental update (bigger change but large O(n) savings long-term).