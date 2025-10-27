# DESIGN101 — Material Presets and Factory

**Status:** Proposed
**Created:** 2025-10-27

## Overview

Consolidate repeated material property objects and factory functions across `src/renderer/materials/*` into a centralized presets module and a small material factory layer. Provide thin React wrappers for component usage while keeping pure three.js factory functions for non-React runtime code (e.g., material registry, instanced materials).

## Motivation

Multiple renderer material files (`bulletMaterials.tsx`, `thrusterMaterials.ts`, `muzzleMaterials.tsx`, etc.) contain repeated property objects and ad-hoc factories. This produces duplication and risks inconsistent material properties for bullets, beams, thrusters, and explosions.

## Requirements (EARS)

1. WHEN a material is needed by key (e.g., `'bullet:laser'`), THE SYSTEM SHALL provide a factory that returns a fully-configured three.js Material matching the canonical preset [Acceptance: tests assert properties].

2. WHEN materials are used as React components, THE SYSTEM SHALL provide thin wrappers that forward to the factory and accept props overrides [Acceptance: Storybook or smoke render passes].

3. THE presets shall be the single source of truth for colors, emissive, roughness, metalness and flags like `__copilot_forceColorWrite` [Acceptance: One JSON-like mapping in `materialPresets.ts`].

## API Proposal

Files:

- `src/renderer/materials/materialPresets.ts`
  - Export `MATERIAL_PRESETS` object mapping keys to MeshStandardMaterialParameters.

- `src/renderer/materials/materialFactory.ts`
  - Export `createMaterialFromPreset(key: string, extra?: MeshStandardMaterialParameters)` which returns an instance of `MeshStandardMaterial` or `MeshBasicMaterial` as appropriate.
  - Export `createInstancedMaterial(key)` convenience to set instancing-friendly flags.

- `src/renderer/materials/reactWrappers.tsx`
  - Thin React components that render `<meshStandardMaterial {...preset} />` or call factories via hooks.

- Update `src/renderer/materials/*` to import presets/factory and reduce duplication.

## Data Flow

Renderer components or material registry call factory functions to obtain materials. For instanced usage, factories will set `vertexColors` or `userData.__copilot_forceColorWrite` as needed.

## Testing Strategy

- Unit tests asserting that `createMaterialFromPreset('bullet:laser')` has expected property values.
- Snapshot tests for React wrappers if present.

## Migration Plan

1. Add `materialPresets.ts` and `materialFactory.ts`.
2. Refactor `bulletMaterials.tsx` to import presets and use factory — keep identical exported API (React components + createX functions) but implement via factory.
3. Update `materialRegistry.tsx` to call `createInstancedMaterial`.
4. Run typecheck and tests.

## Notes

- Keep the exported React components names unchanged for backward compatibility.
- Factories should be deterministic and avoid side effects. Factories used in hot loops should be used sparingly; prefer reusing material instances where possible.

