## SpaceAutoBattler — Architecture Draft (TypeScript + Worker-based sim + Renderer)

Status update (TS migration)
---------------------------
- Entry points are now TypeScript:
  - `src/main.ts` (wraps and re-exports current JS `main.js` during migration)
  - `src/simWorker.ts` (wraps `simWorker.js` so the worker remains a module and is bundled)
- Build pipeline:
  - `scripts/build.mjs` bundles TS entrypoints with esbuild to `dist/`.
  - Outputs `bundled.js` and a `.ts`-named copy `bundled.ts` (project consumers requested `.ts` filename).
  - Generates `dist/spaceautobattler.html` referencing `./bundled.ts` and `./bundled.css`.
  - `scripts/build-standalone.mjs` creates `dist/spaceautobattler_standalone.html` with inlined CSS/JS and an inlined worker via Blob URL.
- TypeScript config: `tsconfig.json` added with strict ESM settings and `allowJs` to support incremental porting of existing JS files.
- Next step: gradually port core modules (entities, simulate, gamemanager) from `.js` to `.ts` while maintaining the deterministic contracts.

Purpose
-------
This document is a pragmatic TypeScript-focused architecture draft that complements `spec/spec-gameloop-sim-renderer.md` and shows a concrete, testable pattern to run the deterministic simulation in a Worker, render on the main thread (or in a renderer worker with OffscreenCanvas), and orchestrate a safe gameloop that preserves determinism and testability.

Goals
-----
- Deterministic simulation (seeded RNG) when running in worker or main thread.
- Clear, typed message protocol between main ↔ sim-worker (and optionally renderer-worker).
- Minimal, reversible migration path from current code: structured-clone snapshots first, typed-array transfer later.
- Testable: unit tests for simulateStep determinism, worker integration tests, gameloop guard tests.

High-level architecture
-----------------------
- Main thread: UI, input, renderer (canvas2d or WebGL). Orchestrates sim worker when enabled.
- Sim worker: runs `simulateStep(state, dtSeconds, bounds)` deterministically. Owns RNG seed and progression state.
- Optional renderer worker: owns WebGL and its own rAF loop; exposes `providesOwnLoop` and `isRunning()` semantics to main.

TypeScript contracts (interfaces)
--------------------------------
// Shared types used by main and worker (run through a .d.ts or copy into both sides)
export interface Bounds { W: number; H: number }

export interface Ship { id: number; x: number; y: number; vx: number; vy: number; hp: number; maxHp: number; shield: number; maxShield?: number; team: string | number; ownerId?: number; xp?: number; level?: number }

export interface Bullet { id: number; x: number; y: number; vx: number; vy: number; team: string | number; ownerId?: number; damage: number; ttl?: number }

export interface Explosion { x: number; y: number; team?: string | number }
export interface ShieldHit { id: number; hitX: number; hitY: number; team?: string | number; amount: number }
export interface HealthHit { id: number; hitX: number; hitY: number; team?: string | number; amount: number }

export interface GameState {
  t: number; // simulation time in seconds
  ships: Ship[];
  bullets: Bullet[];
  explosions: Explosion[];
  shieldHits: ShieldHit[];
  healthHits: HealthHit[];
}

Worker message protocol (main ↔ sim-worker)
------------------------------------------
Use a small, explicit union for messages. Keep messages JSON-friendly for structured clone. When adding transfer-optimized payloads, add alternate message kinds.

type SimInitMsg = { type: 'init'; seed: number; state?: GameState; bounds: Bounds; simDtMs?: number }
type SimStartMsg = { type: 'start' }
type SimStopMsg = { type: 'stop' }
type SimStepRequestMsg = { type: 'stepRequest'; maxSteps?: number }
type SimSetSeedMsg = { type: 'setSeed'; seed: number }
type SimSnapshotRequestMsg = { type: 'snapshotRequest'; includeEvents?: boolean }

// Worker -> Main
type SimSnapshotMsg = { type: 'snapshot'; state: GameState }
type SimErrorMsg = { type: 'error'; message: string; stack?: string }
type SimReadyMsg = { type: 'ready' }

Design decisions & reasoning
----------------------------
- Determinism: the sim worker must call `srand(seed)` before any calls to `simulateStep`. Do not rely on Math.random in sim logic.
- Events: keep visual-only event arrays (explosions / shieldHits / healthHits) produced by the sim and sent in snapshots; renderer may clear or copy them but MUST NOT mutate the authoritative sim state.
- Structured clone first: implement simple object snapshots to keep code simple and testable. Add an opt-in `transferOptimized` flag to move to TypedArray serialization later.
- Small messages: prefer small, explicit messages rather than streaming raw bytes. If switching to transferables, keep the same message types but change the payload type.

Main-thread orchestration (pseudocode)
-------------------------------------
// main.ts — simplified
const simWorker = new Worker('dist/simWorker.js');
let latestSnapshot: GameState | undefined;
let running = false;

simWorker.onmessage = (ev) => {
  const msg = ev.data;
  if (msg.type === 'snapshot') {
    latestSnapshot = msg.state;
  } else if (msg.type === 'ready') {
    // worker ready
  } else if (msg.type === 'error') {
    console.error('sim-worker error', msg.message);
    // fallback: stop worker, run sim on main thread
  }
}

async function startGame(opts) {
  simWorker.postMessage({ type: 'init', seed: opts.seed, bounds: opts.bounds, state: opts.state, simDtMs: opts.simDtMs });
  simWorker.postMessage({ type: 'start' });
  running = true;
  requestAnimationFrame(renderLoop);
}

function renderLoop(now) {
  // handle renderer.providesOwnLoop guard (see next section)
  const snap = latestSnapshot;
  if (snap) renderer.renderState(snap, computeInterpolationAlpha());
  if (running && !renderer.providesOwnLoop) requestAnimationFrame(renderLoop);
}

Renderer guards (interface compliance)
-------------------------------------
Follow the rules in `spec-gameloop-sim-renderer.md`:
- If `renderer.providesOwnLoop === true`, do not start external rAF for rendering.
- Call `renderer.isRunning()` inside a try/catch. If it throws, fallback to starting external rAF.

Sim worker implementation sketch (pseudocode / TypeScript)
-------------------------------------------------------
// simWorker.ts (compiled to simWorker.js)
import { simulateStep } from './simulate.js';
import { srand } from './rng.js';

let state: GameState;
let bounds: Bounds;
let simDt = 16; // ms
let seeded = false;
let running = false;

onmessage = (ev) => {
  const msg = ev.data;
  switch (msg.type) {
    case 'init':
      bounds = msg.bounds;
      if (typeof msg.seed === 'number') { srand(msg.seed); seeded = true; }
      if (msg.state) state = msg.state;
      postMessage({ type: 'ready' });
      break;
    case 'start':
      running = true; // start a loop using setInterval or performance.now accumulator
      startLoop();
      break;
    case 'stop': running = false; break;
    case 'stepRequest':
      // advance a small number of fixed steps and post a snapshot
      break;
  }
}

function startLoop() {
  let acc = 0; let last = performance.now();
  function tick() {
    if (!running) return;
    const now = performance.now();
    acc += now - last; last = now;
    const maxAcc = 250; if (acc > maxAcc) acc = maxAcc; // clamp
    while (acc >= simDt) {
      simulateStep(state, simDt / 1000, bounds);
      acc -= simDt;
    }
    postMessage({ type: 'snapshot', state }, /* transferables? */ []);
    setTimeout(tick, 0); // cooperative scheduling inside worker
  }
  tick();
}

Transfer strategy
-----------------
- Start with structured clone snapshots (postMessage with plain objects). Keep state small by trimming debug fields.
- When performance indicates GC/copying is too expensive, add a `transferOptimized` mode that serializes numeric arrays into Transferable ArrayBuffers (Float32Array for positions/velocities, Int32Array for ids/ints).
- Keep a stable versioned format: { version: 1, type: 'snapshot', schema: 'typed-v1', buffers: [positions.buffer, velocities.buffer], meta: {...} }

Determinism and RNG rules
-------------------------
- The sim worker owns the RNG seed. Always call `srand(seed)` during `init` in the worker. All simulation-randomness must use the seeded API (`srange`, `srangeInt`, `srandom`).
- Do not use `Math.random()` in simulation code paths. Cosmetic randomness in renderer is OK.

Error handling & recovery
-------------------------
- If the worker posts an `error` or `onerror` fires, the main should:
  1) log and capture the error (attach to bug report),
  2) optionally request a final snapshot, then
  3) stop the worker and fallback to main-thread simulation (call simulateStep locally) so the UI stays responsive.
- Expose an API `forceMainThreadSim()` to support fallback in tests and debug.

Testing plan & acceptance criteria
---------------------------------
- Unit tests (Vitest):
  - simulateStep determinism: seed RNG, run N steps in-process, compare with stored snapshot.
  - worker determinism integration: start worker with seed, capture snapshots over N frames, assert deep equality with main-thread simulate run seeded the same way.
  - gameloop guards: mock renderer with `providesOwnLoop` true/false and `isRunning()` throwing to validate rAF behaviour.
- Performance test: basic benchmark measuring ms/frame of postMessage serialization; optionally compare structured-clone vs typed-array transfer.

Mapping to existing configs
---------------------------
- Use `spec/entitiesConfig.js` ship types (fighter, corvette, frigate, destroyer, carrier) as canonical data shapes for tests. During the TS migration, prefer adding `.d.ts` typings where necessary and then port to `.ts`.
- Progression/XP: simulate worker must respect `progressionConfig` constants; tests should seed a single ship and verify XP/level transitions after deterministic damage events.

Migration steps (minimal, reversible)
----------------------------------
1. Add `src/main.ts` and `src/simWorker.ts` wrappers to make TS the public entrypoints while delegating to current JS modules.
2. Update build to bundle TS entrypoints and emit JS bundles (plus a `.ts`-named copy as requested by consumers).
3. Keep `simulateStep` unchanged; run the same tests after wiring to confirm determinism.
4. Incrementally port internal modules to TypeScript with `allowJs` until fully migrated, then disable `allowJs`.
5. Add `transferOptimized` feature flag behind runtime opt-in and tests.

Files to create/modify
----------------------
- spec/spec-gameloop-sim-renderer-typescript-worker.md (this file)
- src/simWorker.ts (worker entry)
- src/gamemanager.ts (or update `src/gamemanager.js`) to add worker wiring
- src/renderer.ts (add `renderState` typed wrapper) or update `src/renderer.js`
- test/sim.worker.determinism.test.ts (Vitest integration test)
- test/main.webglloop.guard.test.ts (expand to TypeScript test harness)

Open questions and trade-offs
---------------------------
- Worker binary serialization complexity vs. developer speed: start with structured clone to keep tests and debugging simple.
- Where to place progression logic: keep progression inside `simulateStep` (worker-owned) so XP/leveling is deterministic; renderer may display player-facing progression updates via snapshots.

Next steps (concrete)
---------------------
1. Add `src/simWorker.ts` and compile it; run `npm test` and confirm existing tests still pass.
2. Add minimal integration test that starts sim worker with seed and compares 60-step snapshot to in-process simulation with same seed.
3. If serialization is a bottleneck, add typed-array snapshot mode and tests.

Acceptance mapping to original spec
-----------------------------------
- This architecture satisfies the gameloop / renderer guard requirements, the simulateStep contract, the RNG determinism constraints, and provides a clear migration path for transfer-optimized snapshots.
