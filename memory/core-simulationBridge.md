# Memory — core-simulationBridge

Files:

- `src/game/SimulationBridge.ts`
- `src/worker/simulation.worker.ts`
- `src/worker/protocol.ts`
- `src/worker/transformsLayout.ts`
- `src/worker/slotAllocator.ts`

Related: TASK157

Summary

- Optional Web-Worker simulation pipeline. When enabled via URL flag, the main thread spawns `simulation.worker.ts`, which runs `createGameState()` + `updateGame()` on a `setInterval` loop and streams ship transform snapshots back to the renderer.
- The bridge is fully opt-in — production behaviour is unchanged when no flag is set. The flag is read on the main thread via `shouldEnableWorkerSimulation()` etc., which guard against non-browser environments (Node, jsdom) by catching URL access errors via `reportConfigError`.

URL flags (all on the main-thread query string)

| Flag                       | Effect                                                              |
| -------------------------- | ------------------------------------------------------------------- |
| `sim_worker=1`             | Run simulation in the worker; main thread renders worker snapshots. |
| `sim_worker_render=1`      | Same as above, but explicitly asserts render-side consumption.      |
| `sim_worker_render_only=1` | Skip running the simulation in the worker; renderer consumes state. |
| `sim_worker_debug=1`       | Enable verbose `[sim-worker]` logging in the worker console.        |

`SimulationBridge` lifecycle

- Constructed with `{ seed, aiOverrides, capacity?, startPaused?, debug? }`. Default capacity is `4096` ships.
- The layout is a Structure-of-Arrays (SoA) buffer of `Float32Array` views sized for `capacity` ships: `positions (vec3)`, `rotations (quat)`, `scales`, `shipHp`, `shipShield`, `shipThrust`. Offsets are 4-byte aligned (`align4`).
- Shared memory path: when `SharedArrayBuffer` is available and the page is `crossOriginIsolated`, the bridge allocates one `SharedArrayBuffer` sized by `layout.totalBytes` and transfers it to the worker once. The worker writes directly into shared memory; the main thread reads via `sharedViews`.
- Transfer path: when SAB is unavailable, the worker transfers an `ArrayBuffer` snapshot each tick (rotating between a small pool via `postWithTransfer`).
- `readyPromise` resolves on the first `'ready'` worker message; errors are stored in `lastError` and surfaced via `'error'` messages.

Message protocol (`src/worker/protocol.ts`)

- `MainToWorkerMessage`: `init` (with seed, ai overrides, layout/buffer, startPaused/debug flags), `setAiOverrides`, `setPaused`, `ping`/`pong` (latency probe), `shutdown`.
- `WorkerToMainMessage`: `ready` (sabSupported, rapierLoaded, usingShared, layout), `pong`, `snapshot` (tick, time, shipCount, created[], destroyed[], buffer?), `error`.

Worker internals (`src/worker/simulation.worker.ts`)

- Installs a UI-store shim (`__spaceAutobattlerUiStore`) backed by the latest `aiOverrides` so subsystems that read from it inside the worker keep working without a Zustand instance.
- Steps the simulation at `state.simulation.step * 1000` ms (clamped to `>= 1`).
- Uses `SlotAllocator` (`src/worker/slotAllocator.ts`) to map ship IDs to SoA slot indices; reuses freed slots for newly spawned ships. `slotByEntityId` and `lastShipIds` are tracked across ticks.
- Calls `writeShipTransforms(state)` then `emitSnapshot(state)` each tick.

`SlotAllocator`

- Tiny free-list allocator: `allocate()` pops from the free list, otherwise hands out the next sequential slot up to `capacity`. `free(slot)` ignores invalid indices. Used to keep ship-to-buffer mapping stable as ships spawn/destroy.

Why a worker

- Lets the renderer thread do nothing but draw, keeping main-thread frame time flat regardless of simulation cost (tested with hundreds of ships).
- Determinism is preserved: the worker uses the same `SeededRng` (`src/utils/rng.ts`) and `state.rng` instance as the main thread. The seed is provided by the main thread in the `init` message.

When to use

- Default build: leave the flags off — the existing in-thread `updateGame` path is the canonical loop and is what the AI scenario harness, perf scripts, and unit tests target.
- Reach for the worker only when profiling shows the simulation step is the dominant frame cost on a target machine, or when you want a true off-thread regression target.

References

- `src/game/SimulationBridge.ts`
- `src/worker/simulation.worker.ts`, `src/worker/protocol.ts`, `src/worker/transformsLayout.ts`, `src/worker/slotAllocator.ts`
- `src/utils/errorReporting.ts` (`reportConfigError`, `reportLifecycleError`)
- TASK157: Add worker-based simulation bridge
