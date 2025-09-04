---
title: Invisible Instanced Ships - Spec
author: GitHub Copilot
created: 2025-09-03
tags:
  - threejs
  - instancedmesh
  - renderer
  - debugging
  - spec
---

# Invisible Instanced Ships — Specification

Purpose: provide clear, testable requirements and an implementation plan to prevent and diagnose invisible instanced ships when using Three.js `InstancedMesh` in SpaceAutoBattler. This spec directly addresses the Top 10 causes listed in `docs/invisible_instanced_ships.md`.

Summary: for each cause we provide 1) EARS-style requirement(s), 2) design and contract, 3) acceptance criteria and tests, 4) implementation tasks and low-risk mitigations.

## Requirements (EARS-style)

### Requirement 1 — matrix updates

WHEN the renderer updates instanced ship transforms, THE SYSTEM SHALL ensure every instance matrix is set on the `InstancedMesh` and the mesh's `instanceMatrix.needsUpdate` flag is true.

Acceptance criteria:

- Unit test updates matrix array and simulates GPU upload.
- Visual smoke check shows instances rendered after update.

### Requirement 2 — material validation

WHEN materials are assigned to instanced meshes, THE SYSTEM SHALL validate material properties commonly causing invisibility (opacity, transparent, alphaTest, depthTest/depthWrite, blending) and emit a console warning or telemetry if a suspicious combination is detected.

Acceptance criteria:

- Unit tests detect bad material combinations and validator returns warnings.
- Runtime validator logs warnings in debug builds; no silent invisibility in production flows.

### Requirement 3 — geometry bounding / frustum culling

WHEN an `InstancedMesh` is constructed or its base geometry changes, THE SYSTEM SHALL compute and set a correct `geometry.boundingSphere` and `geometry.boundingBox` (or disable frustum culling in exceptional cases) to avoid accidental culling.

Acceptance criteria:

- Tests verify `geometry.boundingSphere` and `geometry.boundingBox` are present and reasonable.
- Smoke test moving the camera keeps instances visible when they are inside the frustum.

### Requirement 4 — scale validation

WHEN instance transforms result in extreme scales, THE SYSTEM SHALL clamp, validate, or report scale values outside practical thresholds and provide an opt-in visual debug overlay to show effective scale ranges.

Acceptance criteria:

- Scale validation unit test covers min/max enforcement.
- Debug overlay highlights out-of-range instances during manual inspection.

### Requirement 5 — position distance checks

WHEN instance positions are far from origin or camera, THE SYSTEM SHALL detect high-magnitude positions and provide warnings and a centering suggestion (e.g., use local origin transforms or camera-relative coordinates).

Acceptance criteria:

- Test identifies positions above threshold (for example > 1e5 units) and validator logs suggested remediations.

### Requirement 6 — lighting validation

WHEN a lighting-dependent material is used, THE SYSTEM SHALL verify scene lights exist and are enabled; if none, it SHALL log a warning and optionally fallback to an unlit variant for debug/viewer modes.

Acceptance criteria:

- Test toggles off lights and validator reports missing or insufficient lighting for lighting-dependent materials.

### Requirement 7 — render order & z-fighting diagnostics

WHEN renderOrder or transparency could cause occlusion, THE SYSTEM SHALL provide a renderer-level helper to diagnose render order and Z-fighting by overlaying bounding boxes and sorting information during debug runs.

Acceptance criteria:

- Manual debug run shows overlays that surface draw order and Z-fighting candidates to the developer.

### Requirement 8 — visibility tracing

WHEN an `InstancedMesh` or an ancestor has `visible === false`, THE SYSTEM SHALL provide an API to trace visibility inheritance and log the first ancestor that disables visibility.

Acceptance criteria:

- Test sets an ancestor's `visible` to `false` and the tracer returns the correct ancestor node and path.

### Requirement 9 — geometry attribute validation

WHEN base geometry appears degenerate (zero-size, missing attributes), THE SYSTEM SHALL validate geometry attribute presence (`position`, `normal` when needed) and size, and refuse to create the instanced mesh or fall back to a simple placeholder geometry in debug mode.

Acceptance criteria:

- Test creates degenerate geometry and validator returns a clear, actionable error message.

### Requirement 10 — worker transfer validation

WHEN instance matrices are produced in a Worker and transferred to the main thread, THE SYSTEM SHALL validate typed array lengths, types (Float32Array), and optionally checksum the buffer to ensure correct transfer and re-assignment to `instancedMesh.instanceMatrix.array`.

Acceptance criteria:

- Unit test simulates worker transfer with incorrect and correct buffer sizes; validator errors for incorrect sizes and sets `instanceMatrix.needsUpdate` for valid buffers.


## Design & Contracts

Contract: Add a lightweight runtime validator and debug helper module `src/renderer/instancingValidator.ts` with the following exported API:

- validateInstancedMesh(mesh: InstancedMesh, options?: ValidatorOptions): ValidationResult
- enableDebugOverlay(enabled: boolean): void
- traceVisibility(object: Object3D): TraceResult

ValidatorOptions (partial): { minScale?: number, maxScale?: number, warnOnUnlit?: boolean, failOnMissingAttributes?: boolean }

ValidationResult: {
  ok: boolean,
  warnings: string[],
  errors: string[],
  details?: Record<string, any>
}

Design notes:

- Keep runtime overhead minimal: perform checks on creation, on explicit validate() calls, or in debug builds only.

- Use existing `GameState` configuration flags to toggle debug validators (per `src/config/rendererConfig.ts`).

- Provide unit-testable pure functions for each rule so we can cover them in `vitest`.

- Non-breaking: validators must not throw in production; they return structured results and may log warnings.


## Acceptance Tests (per requirement)

- R1 Matrix Updates: unit test that constructs a mock InstancedMesh (or lightweight wrapper), calls the helper to set matrices, and asserts `setMatrixAt` called N times and `instanceMatrix.needsUpdate` true.
- R2 Material Issues: tests enumerating suspicious material combos (e.g., transparent=true + opacity=0) and asserting validator returns a warning.
- R3 Frustum Culling: test that when geometry boundingSphere is null, validator computes boundingSphere and sets it, and that frustum culling doesn't hide instances that have transforms inside camera frustum.
- R4 Scale: tests for min/max enforcement and debug overlay flags.
- R5 Position Distance: tests for detection above threshold (e.g., >1e5) and message content.
- R6 Lighting: test that materials requiring lights produce warnings when scene.lights.length===0.
- R7 Render Order: minimal smoke test that toggles renderOrder and uses debug overlay to display draw order for manual verification.
- R8 Visibility Trace: test that traceVisibility returns the correct ancestor node and path.
- R9 Geometry Attributes: test that missing `position` or zero-sized position attr triggers an error.
- R10 Worker Transfer: unit test that passes a Float32Array of wrong length and expects validator error; correct length passes and sets needsUpdate.


## Tasks (implementation plan)

1. Create `docs/invisible_instanced_ships-spec.md` (this file) — Done.
2. Create `src/renderer/instancingValidator.ts`:
   - export `validateInstancedMesh`, `traceVisibility`, `enableDebugOverlay` (pure functions + minimal DOM overlay for debug).
3. Add config toggle in `src/config/rendererConfig.ts` (e.g., `instancingDebug: boolean`) and wire to `GameState`.
4. Add unit tests `test/vitest/instancingValidator.spec.ts` covering the 10 rules.
5. Add a small runtime integration example in `src/renderer/debugInstancingDemo.ts` (enabled behind config flag only).
6. Update README or docs `docs/invisible_instanced_ships-spec.md` with how to enable debug overlay and interpret warnings.


## QA & Smoke Checklist

- Run `npm run typecheck` and `npm test` (run unit tests).
- Build and run `npm run build && npm run serve:dist` then enable `instancingDebug` flag and open the demo page.
- Manually toggle edge conditions: set material.opacity=0, move instances far away, disable lights, set geometry to empty, and check validator warnings and debug overlays.


## Edge cases & Notes

- Worker-to-main thread transfers: we propose a non-invasive checksum (e.g., 32-bit sum of the Float32Array bytes) only in debug to avoid runtime cost.
- Do not change rendering behavior in production: validators return results and log; optional debug overlay is opt-in.


## Next steps & Ownership

- Suggest implementing the validator module as a small TypeScript file under `src/renderer/` and add tests under `test/vitest/`.
- Assign to renderer owner (see `AGENTS.md`) and include in next sprint.

---

Requirements coverage:

- All 10 issues from `docs/invisible_instanced_ships.md` mapped to EARS requirements and tasks above.

Quality gates:

- Typecheck: PASS expected

- Unit tests: 10 focused tests (one per rule) - required before merge
