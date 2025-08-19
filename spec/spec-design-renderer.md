---
title: Renderer Design Specification
version: 1.0
date_created: 2025-08-19
last_updated: 2025-08-19
owner: SpaceAutoBattler Team
tags: [design, renderer, architecture, ai-ready]
---


## Introduction

This specification defines the responsibilities, interfaces, data contracts, requirements, constraints, and testable acceptance criteria for the SpaceAutoBattler renderer. It is written to be unambiguous and machine-friendly so that generative AIs and engineers can implement, validate, or audit renderer logic consistently.

The renderer is the visual layer that consumes the deterministic simulation state produced by `simulateStep` and produces pixel output on a HTML Canvas (or other rendering target). The renderer must be purely visual: it must not mutate simulation state or affect determinism.

## 1. Purpose & Scope

Purpose

- Define a precise contract between the simulation and the renderer so both components can evolve independently while remaining interoperable.

Scope

- Input shapes and required fields that the renderer expects from the simulation.
- Visual event handling semantics (explosions, shieldHits, healthHits, etc.).
- Performance and determinism constraints (what renderer may and may not do).
- Testable acceptance criteria and automation guidance.

Intended audience

- Frontend engineers implementing or modifying `src/renderer.js`.
- Test engineers writing unit and visual regression tests.
- Generative AI agents making automated, deterministic edits to the renderer.

Assumptions

- The simulation provides a seeded, deterministic state object on each tick.
- The simulation uses a separate seeded RNG for logic; the renderer may use non-deterministic randomness for purely cosmetic effects.
- The renderer runs in a browser environment or a headless-canvas test environment that emulates Canvas2D.


## 2. Definitions

- Renderer: Visual subsystem that draws game state to a Canvas or comparable target.
- Simulation: Deterministic logic that advances ships, bullets, and emits visual events (implemented in `src/simulate.js`).
- State: The top-level object passed from the simulation to the renderer on each frame.
- Event arrays: Arrays attached to `state` that contain lightweight event objects (explosions, shieldHits, healthHits).
- Determinism: Property that given the same initial seed and inputs, simulation produces identical numeric state; renderer must not affect this property.
- Visual-only effects: Particles, flashes, and other UI-only consequences that do not change simulation data.

## 3. Requirements, Constraints & Guidelines

All requirements use unique identifiers to facilitate traceability.

- **REQ-REN-001**: Input contract — The renderer shall accept a `state` object on each render call and read but not mutate it.
- **REQ-REN-002**: Event consumption — The renderer shall process the following event arrays from `state` if present: `explosions`, `shieldHits`, `healthHits`.
- **REQ-REN-003**: Non-mutating — The renderer shall never change simulation-owned data (no writes to `state`, ships, bullets, or event objects).
- **REQ-REN-004**: Minimal event shapes — The renderer shall assume and validate event object shapes documented in Section 4; missing optional fields must be handled gracefully.
- **REQ-REN-005**: Device pixel ratio — The renderer shall support high-DPI displays by scaling canvas internal pixel size using devicePixelRatio or an injected scale factor.
- **REQ-REN-006**: Accessibility — The renderer shall expose meaningful ARIA hooks or DOM fallbacks for assistive tech where applicable (e.g., a hidden summary element describing game state when requested).
- **REQ-REN-007**: Performance budget — The renderer shall avoid synchronous layout/DOM thrashing and should render at 60 FPS on typical desktop hardware with small fleets (see Performance Guidelines below).
- **CON-REN-001**: Determinism constraint — The renderer may use non-deterministic randomness only for purely cosmetic variations; simulation determinism must never depend on renderer actions.
- **GUD-REN-001**: Error handling — When required fields are missing or invalid, the renderer shall log a concise warning and skip the offending visual, rather than throwing uncaught exceptions.
- **PAT-REN-001**: Double-buffering — Prefer double-buffering or canvas offscreen buffers for heavy particle work to avoid blocking the main render loop.
- **GUD-REN-002**: Idempotency — Rendering the same `state` repeatedly must produce visually equivalent output; render functions should be effectively idempotent for the same inputs.

Performance Guidelines (informational)

- Use requestAnimationFrame when running in the browser (not required for headless tests).
- Use efficient batching for drawing many similar items (e.g., group draw calls by color/style).
- Limit per-frame allocations in hot paths; reuse Path2D, gradients, and pre-computed shapes where possible.

Security & Safety

- The renderer shall not evaluate arbitrary strings from `state` (no eval-like behavior).
- The renderer shall not fetch remote resources as a side-effect of rendering unless explicitly configured.

## 4. Interfaces & Data Contracts

This section defines the expected shapes of the `state` object, sub-objects, and event shapes. Where existing repository naming differs, this spec documents the canonical, AI-friendly shape. Implementations must handle extra properties but rely only on fields defined here.


Top-level render function signature

`render(targetCanvasOrContext, state, options?)`

- `targetCanvasOrContext`: HTMLCanvasElement or CanvasRenderingContext2D (or a test harness equivalent).
- `state`: Object as defined below.
- `options` (optional): { devicePixelRatio?: number, width?: number, height?: number, debug?: boolean }

Canonical `state` shape (read-only)

```js
// canonical shape (read-only)
const state = {
  t: 0,                 // simulation time or tick count (optional but recommended)
  W: 800,               // world width in simulation units (optional)
  H: 600,               // world height in simulation units (optional)
  ships: [],            // array of ship objects
  bullets: [],          // array of bullet objects
  explosions: [],
  shieldHits: [],
  healthHits: [],
  meta: {}              // optional extension map for future fields
};
```

Ship object (common fields renderer may use)

```js
// Ship example
const Ship = {
  id: 'string|number',
  x: 0,
  y: 0,
  vx: 0, // optional
  vy: 0, // optional
  angle: 0, // radians, optional
  team: 'string|number',
  hp: 100, // optional
  maxHp: 100, // optional
  shield: 0, // optional
  maxShield: 0, // optional
  spriteId: 'string', // optional hint for renderer
  visible: true // optional, default true
};
```

Bullet object (common fields)

```js
// Bullet example
const Bullet = {
  id: 'string|number',
  x: 0,
  y: 0,
  vx: 0, // optional
  vy: 0, // optional
  team: 'string|number',
  ownerId: 'string|number',
  dmg: 0, // optional
  ttl: 0 // optional time-to-live in seconds or ticks
};
```

Event shapes

```js
// ExplosionEvent
const ExplosionEvent = { x: 0, y: 0, team: 'string|number', size: 1 };

// ShieldHitEvent
const ShieldHitEvent = { id: 'string|number', hitX: 0, hitY: 0, team: 'string|number', amount: 0 };

// HealthHitEvent
const HealthHitEvent = { id: 'string|number', hitX: 0, hitY: 0, team: 'string|number', amount: 0 };
```

Notes on event shapes

- The renderer must not assume events are unique or limited to one per tick. Multiple events per frame are allowed.
- Event `id` values reference ship ids where applicable. A missing `id` must be treated as an anonymous event and rendered at the provided coordinates.

Options

- devicePixelRatio: number — when provided the renderer will size the backing store accordingly. If omitted the renderer should read `window.devicePixelRatio` when running in a browser.
- debug: boolean — instructs the renderer to draw overlays useful for tests (hitboxes, IDs, coordinate grids). Debug mode must be opt-in.

Contract rules

- The renderer must never write to `state` or its nested objects.
- The renderer must only read the documented fields. Unknown fields may be ignored.
- The renderer must drain event arrays only from an internal visual queue and must not remove elements from `state.explosions` or other arrays.

## 5. Acceptance Criteria

Each requirement maps to one or more acceptance tests. Use Given-When-Then format where applicable.

- **AC-REN-001** (Non-mutating): Given a simulation `state` object, When `render(ctx, state)` is called, Then `state` and all nested objects remain strictly unchanged (deep-equal before/after).

- **AC-REN-002** (Event rendering): Given a `state` with one `explosion` event, When `render(ctx, state)` is called, Then the renderer draws visual content at the event's `x,y` coordinates corresponding to an explosion (verified via pixel-snapshot or canvas drawing commands mock).

- **AC-REN-003** (Graceful missing fields): Given a `state` missing optional fields (e.g., `shieldHits` undefined), When `render` is called, Then the renderer does not throw and draws the rest of the scene.

- **AC-REN-004** (High-DPI scaling): Given a canvas and `devicePixelRatio=2`, When `render` is called with world size W,H, Then the backing store is sized to W*2,H*2 and visuals are crisp (no distortion).

- **AC-REN-005** (Idempotency): Given the same `state` passed to `render` multiple times, When rendered on the same target with same options, Then the output is visually equivalent (pixel-snapshots equal or within tolerance).

- **AC-REN-006** (Performance): Given a typical frame with up to N ships and M bullets (where N and M are defined in the project's performance budget, default N=50, M=200), When rendering continuously, Then the renderer should maintain >= 45 FPS on average desktop hardware. (Measured in performance tests; thresholds are adjustable.)

- **AC-REN-007** (Error handling): Given malformed event objects, When `render` is called, Then renderer emits a concise console.warn and continues rendering other elements.

## 6. Test Automation Strategy

Test levels and suggested tooling (aligned to repository):

- Unit tests
  - Framework: Vitest (already used in repository).
  - Strategy: Use a headless Canvas mocking library (for Node: `canvas` or `@napi-rs/canvas`) and assert drawing commands by either:
    - capturing the Canvas 2D context calls via a spy/mock, or
    - using pixel-snapshot comparisons (small tolerance) for simple scenes.
  - Tests to add: non-mutating tests, event rendering tests, missing-field tests, DPI scaling tests.

- Integration tests
  - Frameworks: Vitest + Playwright for browser-based visual regression when needed.
  - Strategy: Boot a small page (existing HTML pages in repo) and take screenshot snapshots across frames.

- Visual regression
  - Use Playwright or a dedicated image diff tool to compare renderer output against approved golden images.
  - Keep pixel-tolerant thresholds for anti-flakiness.

- Performance tests
  - Use microbenchmarks that render synthetic states with varying N and M and measure frame time averages. These can be run in Node (headless) or browser automation.

- CI integration
  - Add Vitest-run tests to GitHub Actions. Visual snapshot checks should be gated and optionally allowed to update golden images via an explicit PR.

Test data management

- Provide small fixture states under `test/fixtures/renderer/` which seed common scenarios (single explosion, shield hit, crowded battlefield). Use seeded RNG when generating any randomized visual timing in tests.

Coverage requirements

- Unit tests should cover all acceptance criteria marked AC-REN-001 through AC-REN-004. Visual regression tests should cover explosion/impact visuals.

## 7. Rationale & Context

Why this separation?

- Keeping the renderer purely visual preserves deterministic simulation and enables server-side headless simulation, replays, and deterministic testing.
- Lightweight numeric event objects are much cheaper to transfer and easier to snapshot than serialized DOM operations.

Why explicit shapes?

- Generative AIs editing code require precise, machine-readable contracts. Explicit shapes avoid ambiguous field names and accelerate correct code generation.

Why non-mutating policy?

- Mutation in the renderer can create subtle cross-layer bugs and break tests that rely on simulation reproducibility.

## 8. Dependencies & External Integrations

External Systems

- **EXT-001**: Browser environment — Primary runtime for the renderer (Canvas API).

Third-Party Services

- **SVC-001**: Optional image-hosting/CDN — Only if the renderer needs to load remote sprites; must be explicitly configured.

Infrastructure Dependencies

- **INF-001**: CI runner capable of running headless Chrome for Playwright visual tests.

Data Dependencies

- **DAT-001**: Spritesheets or image assets — Represented by configuration and optionally by `spriteId` hints in `Ship` objects.

Technology Platform Dependencies

- **PLT-001**: Node.js and Vitest for unit tests. Playwright for browser integration tests.

Compliance Dependencies

- **COM-001**: Accessibility requirements — ensure renderer does not prevent assistive technology usage (fallback text descriptions, ARIA where applicable).

## 9. Examples & Edge Cases

Example: simple render pseudocode

```js
// Pseudocode: safe, non-mutating render loop
function render(ctx, state, options = {}) {
  const { devicePixelRatio = (typeof window !== 'undefined' ? window.devicePixelRatio : 1) } = options;
  // ...setup canvas scaling using devicePixelRatio...

  // Draw ships
  for (const s of (state.ships || [])) {
    if (s.visible === false) continue;
    drawShip(ctx, s);
  }

  // Draw bullets
  for (const b of (state.bullets || [])) {
    drawBullet(ctx, b);
  }

  // Draw explosions from a read-only pass
  for (const e of (state.explosions || [])) {
    drawExplosion(ctx, e.x, e.y, e.team, e.size);
  }

  // IMPORTANT: do not modify state.explosions or any state array
}
```

Edge cases

- Multiple events referencing the same ship in a single frame (render all of them).
- Events with coordinates outside visible bounds: render clipped visuals but do not throw.
- Missing `state.ships` or `state.bullets`: render an empty world without exceptions.
- High event counts: renderer must gracefully degrade particle fidelity (e.g., reduce particle lifetime) to preserve framerate.

## 10. Validation Criteria

To be compliant with this spec:

- All unit tests for AC-REN-001 through AC-REN-005 must pass in CI.
- Visual snapshots for canonical scenes must match golden images within a small tolerance.
- No test should mutate `state` during rendering (assert deep-equal pre/post in unit tests).
- Performance microbenchmarks must meet the configured FPS threshold for N and M baseline.

## 11. Related Specifications / Further Reading

- `spec-design-simulation.md` (recommended) — specification for `simulateStep` and simulation event emission (must be aligned with this renderer spec).
- `README.md` — project overview and run/build instructions.
- `src/renderer.js` — canonical implementation file that should conform to this spec.
- Playwright and Vitest docs for test automation guidance.

---

Notes and assumptions

- Where field names are not available in the current codebase, canonical shapes were chosen to be backward compatible with common patterns and the existing renderer in `src/renderer.js`. If implementation differs, update this spec and the simulation spec together.
- This document is intended to be machine-readable and concise for use by generative code tools and humans alike.
<!-- markdownlint-disable-file -->