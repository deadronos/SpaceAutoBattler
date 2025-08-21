---
title: Game Manager Specification
version: 1.0
date_created: 2025-08-20
last_updated: 2025-08-20
owner: SpaceAutoBattler Team
tags: [design, gamemanager, simulation, deterministic, api]
---

## Introduction

This specification defines the contract, requirements, constraints, interfaces, data shapes, testing strategy, and acceptance criteria for the Game Manager component (implementation: `src/gamemanager.js`) used by SpaceAutoBattler. The Game Manager is responsible for constructing and advancing the deterministic game simulation, scheduling reinforcements and waves, managing teams and scores, and exposing a small, testable API for controlling the simulation lifecycle.

## 1. Purpose & Scope

Purpose:

- Provide a precise, AI-friendly specification for the Game Manager so maintainers and generative tools can safely implement, refactor, and test its behavior.

Scope:

- Applies to the Game Manager module only (`src/gamemanager.js`).
- Covers initialization, lifecycle control (start/stop/step/reset), deterministic advancement of simulation state, reinforcement scheduling, scoring, and public API surface consumed by the renderer and tests.

Intended audience:

- Maintainers and contributors to SpaceAutoBattler.
- Automated code generation and refactoring tools.
- Test and CI engineers.

Assumptions:

- The simulation step function `simulateStep(state, dt, bounds)` is implemented elsewhere (`src/simulate.js`) and is deterministic when the seeded RNG is used.
- Determinism is achieved by calling `srand(seed)` before simulation steps when tests require repeatability.
- The Game Manager coordinates simulation but does not perform rendering or DOM work.

## 2. Definitions

- Game Manager (GM): Component that initializes and advances the game simulation and exposes lifecycle and query APIs.
- Simulation State / state: The plain JS object representing the world: ships, bullets, particles, score, timers, and event queues consumed by `simulateStep`.
- Reinforcement: A scheduled arrival of new ships/entities for a team; may be immediate or queued.
- Wave: A group of reinforcements that share timing and composition.
- Seed: Numeric seed used by the project's RNG (`srand(seed)`) to ensure deterministic behavior across runs/tests.
- Bounds: Object describing playfield dimensions: `{ W, H }`.

## 3. Requirements, Constraints & Guidelines

Each requirement has an ID for traceability.
Each requirement has an ID for traceability. NOTE: the project's `src/gamemanager.js` exposes a module-level API (functions and exported arrays) rather than an instance factory; the requirements below reflect that shape.

- **REQ-001**: Module API
  - The module MUST export the following functions and symbols (names are authoritative unless refactored):
    - `reset(seedValue = null)` — resets world state and optionally seeds RNG (calls `srand(seed)` when provided).
    - `simulate(dt, W, H)` — advances the game world by dt seconds, runs higher-level decisions (carrier launches, reinforcementStrategy), runs `simulateStep` and returns a snapshot-like object used by renderers: `{ ships, bullets, particles, flashes, shieldFlashes, healthFlashes, stars }`.
    - `processStateEvents(state, dt = 0)` — apply manager-level decisions (XP awarding, kill processing, carrier cleanup) to an arbitrary `state` object (useful for tests).
    - `evaluateReinforcement(dt)` — run time-accumulated reinforcement checks based on `reinforcementIntervalSeconds` and internal accumulators.
    - Strategy setters: `setCarrierLaunchStrategy(fn)`, `setReinforcementStrategy(fn)`, `setSpawnCompositionStrategy(fn)`.
    - UI/testing helpers: `setToast(fn)`, `setContinuousCheckbox(el)`, `setReinforcementInterval(seconds)`, `getReinforcementInterval()`.
    - Exported arrays/collections: `ships`, `bullets`, `particles`, `stars`, `flashes`, `shieldFlashes`, `healthFlashes`, and `particlePool`.
    - Particle helpers: `acquireParticle(...)`, `releaseParticle(...)`, `Particle` class.

- **REQ-002**: Deterministic initialization (partial)
  - `reset(seedValue)` MUST call `srand(seedValue>>>0)` when a numeric seed is provided so simulation-affecting randomness that uses the seeded RNG (`srange`, `srangeInt`) is deterministic across runs.
  - The module MAY use non-seeded randomness (Math.random) for purely cosmetic visual effects (particles, star twinkle). Tests that require full determinism should avoid asserting on cosmetic fields generated via Math.random.

- **REQ-003**: Simulation semantics
  - `simulate(dt, W, H)` MUST:
    - advance carrier launch decisions via the configured `carrierLaunchStrategy` and append spawned fighters to the `ships` array;
    - call `simulateStep(state, dt, { W, H })` where `state` references the module's `ships` and `bullets` arrays;
    - collect emitted events (`explosions`, `shieldHits`, `healthHits`, `damageEvents`, `killEvents`) returned by `simulateStep` and apply manager-level logic (XP awarding, scoring, carrier/fighter cleanup) before returning the renderable snapshot.

- **REQ-004**: Reinforcement & continuous mode
  - Reinforcements are gated by `continuousCheckbox` (if present) or `reinforcementIntervalSeconds` accumulators. `handleReinforcement` and `reinforcementStrategy` are the default mechanisms; consumers may replace them via `setReinforcementStrategy`.

- **REQ-005**: Event payload shapes
  - Events processed by the manager (damageEvents, killEvents) MUST be plain objects containing at least the fields the manager checks: `ownerId`, `dmg` for damageEvents; `killerId`, `killerTeam`, `id`, `type`, `ownerCarrier`, `level` for killEvents.

- **REQ-006**: Observability
  - The module SHOULD expose light diagnostics via stateful counters or exported values (e.g., counters in `_diag` or public variables) to support debugging and performance tuning.

- **REQ-007**: No DOM side-effects in library code
  - While the module contains a `toast` helper that writes to the DOM by default, callers SHOULD override this in test or headless contexts by calling `setToast(fn)` to keep tests isolated from DOM.

- **REQ-008**: Error handling
  - The module MUST throw on programmer errors (invalid args) and must stop/return gracefully if `simulateStep` throws — callers should expect `simulate` to surface errors rather than silently swallowing them.

- **REQ-GM-009**: Entity Management
  - The Game Manager MUST own and manage the lifecycle of ships, bullets, and other entities. It initializes these entities and provides them to the simulation step for processing.

- **REQ-GM-010**: Parallel Coordination
  - The Game Manager MUST coordinate simulation and rendering steps to ensure they can operate in parallel. It provides a consistent state snapshot for rendering while the simulation updates the next state.

- **REQ-GM-011**: Graceful Updates
  - The Game Manager MUST ensure that state changes (e.g., entity creation, destruction) are reflected in a way that does not disrupt the rendering pipeline. This includes emitting events for all significant changes.

- **CON-001**: Partial determinism
  - Because the current implementation mixes seeded RNG (`srange`, `srangeInt`) and `Math.random()` (via `randf`) for cosmetic effects, tests that assert full deep-equality across runs must seed and control which fields are compared (simulate-critical fields only).

- **GUD-001**: Public arrays are live
  - Exported arrays (e.g., `ships`, `bullets`) are live references mutated by `simulate` and other functions. Consumers that need immutable snapshots should clone these arrays before storing or comparing them.

## 4. Interfaces & Data Contracts

The Game Manager is a module with exported functions and live arrays. Consumers interact with it by calling exported functions and reading the exported arrays or the snapshot returned by `simulate(...)`.

Canonical exports (observed in `src/gamemanager.js`):

```js
// functions
export function reset(seedValue = null)
export function simulate(dt, W, H) // returns { ships, bullets, particles, flashes, shieldFlashes, healthFlashes, stars }
export function processStateEvents(state, dt = 0)
export function evaluateReinforcement(dt)
export function setCarrierLaunchStrategy(fn)
export function setReinforcementStrategy(fn)
export function setSpawnCompositionStrategy(fn)
export function setToast(fn)
export function setContinuousCheckbox(el)
export function setReinforcementInterval(seconds)
export function getReinforcementInterval()
// Star helpers
export function initStars(state, W = 800, H = 600, count = 140)

// New explicit form: populate `state.stars` with descriptors
// Each star descriptor: { x, y, r, a, baseA, twPhase, twSpeed }

// Migration guidance
// - Seed the RNG before calling `initStars` in tests: `srand(seed)`.
// - Pass the same `state` object to `initStars` and `createStarCanvas` to avoid RNG call-order differences.
// - Replace legacy calls `initStars(W,H,count)` with `initStars(state,W,H,count)`.
// - Replace legacy `createStarCanvas(W,H,bg)` with `createStarCanvas(state,W,H,bg)`.

// exported live arrays / objects
export const ships = [];
export const bullets = [];
export const particles = [];
export const stars = [];
export const flashes = [];
export const shieldFlashes = [];
export const healthFlashes = [];
export const particlePool = [];

// helpers
export function acquireParticle(...) // returns Particle instance
export function releaseParticle(p)
export class Particle { /* ... */ }
```

State / snapshot returned by `simulate` (minimal):

```js
{
  ships: /* reference to exported ships array */,
  bullets: /* exported bullets array */,
  particles: /* exported particles */,
  flashes: /* exported flashes */,
  shieldFlashes: /* exported shieldFlashes */,
  healthFlashes: /* exported healthFlashes */,
  stars: /* exported stars */
}
```

Notes:

- The returned snapshot reuses the module's live arrays (no defensive copy). Callers that need immutable snapshots should clone arrays.
- Simulation-critical randomness must use seeded RNG helpers `srange`/`srangeInt` (from `src/rng.js`) and `reset(seed)` is the documented way to seed.
- Cosmetic visuals (particle velocities, star twinkle phases) currently use `Math.random` via internal helper `randf`; tests that require full determinism should not assert on such cosmetic fields or should override behaviors in tests.

## 5. Acceptance Criteria

- **AC-001**: Factory & init
  - Given a call to `createGameManager()` and `init({ seed: 123, bounds: { W:800, H:600 } })`, When the manager is initialized, Then `getState()` returns a well-formed state object and calling `step(0.016)` advances `state.time.t` deterministically.

- **AC-002**: Deterministic stepping
  - Given the same seed and identical sequence of `step(dt)` calls, When two managers are initialized with the same seed and sequence, Then their states remain identical (deep-equal) after N steps.

- **AC-003**: Reinforcement limits
  - Given `maxReinforcementsPerTick = 2`, When 5 reinforcements are scheduled for the same tick, Then at most 2 are applied to the active state in that tick and the rest remain queued.

- **AC-004**: Lifecycle control
  - Given the manager is `start()`ed and `stop()` is called, When `step(dt)` is invoked after `stop()`, Then state does not advance and `isRunning()` returns false until `start()` is called again.

- **AC-005**: Error handling
  - Given an invalid reinforcement spec, When `scheduleReinforcement` is called, Then GM throws a synchronous Error and does not mutate state.

## 6. Test Automation Strategy

- Test Levels:
  - Unit tests: validate pure helpers (e.g., reinforcement queue ordering, id generation, small time arithmetic).
  - Integration tests: initialize manager with a headless DOM or Node environment, call `init({ seed })` and run deterministic `step` sequences asserting deep-equality against golden-state snapshots.
  - End-to-end: run the full in-browser demo or Playwright tests to ensure the Game Manager interacts correctly with renderer and UI.

- Frameworks & Tools:
  - Vitest for unit/integration tests (existing project config).
  - Playwright for optional E2E browser checks.

- Test Data Management:
  - Use seeded RNG (`srand(seed)`) at the start of tests.
  - Provide small helper factories to create deterministic fleets and reinforcement specs.
  - Store golden snapshots in `test/fixtures/gamemanager/` and regenerate only after intentional, reviewed changes.

- CI/CD Integration:
  - Unit tests run on every PR. E2E tests run in a separate job.

- Coverage Requirements:
  - Maintain >80% branch coverage for Game Manager critical files.

## 7. Rationale & Context

- The Game Manager separates deterministic simulation concerns from rendering and UI. This makes the simulation testable and suitable for headless CI verification.
- Explicit reinforcement limits and queuing avoid accidental spikes (texture uploads, entity creation) that could cause stutters or OOMs.
- Exposing diagnostic counters simplifies performance investigations and allows the renderer to adapt (e.g., limit visual effects when the GM reports heavy activity).

## 8. Dependencies & External Integrations

### External Systems

- **EXT-001**: Browser runtime or Node (for tests) - required to run simulation and optional E2E tests.

### Third-Party Services

- **SVC-001**: None required at runtime.

### Infrastructure Dependencies

- **INF-001**: CI runners with Node.js and headful browsers for Playwright E2E (optional).

### Data Dependencies

- **DAT-001**: None external; test data should be generated programmatically.

### Technology Platform Dependencies

- **PLT-001**: Node.js (per repo package.json) and Vitest for testing.

### Compliance Dependencies

- **COM-001**: None.

## 9. Examples & Edge Cases

Example: initialize and run a deterministic simulation

```js
import { createGameManager } from '../src/gamemanager.js';
import { srand } from '../src/rng.js';

const gm = createGameManager({ config: { maxReinforcementsPerTick: 2 } });
gm.init({ seed: 42, bounds: { W:800, H:600 } });
gm.start();
for (let i=0;i<60;i++) gm.step(1/60);
const state = gm.getState();
console.log(state.time.t); // deterministic value when seed is 42
```

Edge cases:

- Scheduling a reinforcement with `delaySeconds` = 0 should apply it on the next tick, not immediately mutate the current step in progress.
- If `simulateStep` throws during a `step(dt)` call, GM must stop and expose the error via diagnostics; further `step` calls must be no-ops until `reset()`.
- Reinforcement spec with invalid teamId must throw and not mutate `state`.

## 10. Validation Criteria

- Unit tests exist for: reinforcement queue ordering, schedule/cancel semantics, deterministic stepping with seeds.
- Integration tests compare deep-equal states across two managers initialized with the same seed and step sequence.
- CI must run unit tests on all PRs and block merges on regressions in goldens.

## 11. Related Specifications / Further Reading

- `spec/spec-design-renderer.md` — renderer contract and visual integration (how GM state is consumed).
- `spec/spec-design-webgl-renderer.md` — WebGL renderer performance and atlas handling.
- `src/simulate.js` — deterministic simulateStep implementation contract.

---

This specification is formatted and structured for machine consumption and automated tooling; it intentionally uses explicit requirement IDs, compact data shapes, and deterministic test guidance to make automated verification straightforward.
