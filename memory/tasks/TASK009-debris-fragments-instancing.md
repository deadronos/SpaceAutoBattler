# [TASK009] - Debris & Fragment Instancing

**Status:** Completed
**Added:** 2025-10-05
**Updated:** 2025-10-05

## Original Request

Batch debris fragments produced by explosions or collisions into instanced groups to reduce geometry count and per-frame draw calls.

## Scope

- Implement pooling and instanced rendering for debris/shard fragments grouped by material.
- Provide fragmentation spawn API that avoids per-frame allocations and reuses geometry and materials.
- Add tests and perf scenarios for heavy-fragment scenes.

## Requirements (EARS-style)

1. WHEN explosions produce many debris fragments, THE RENDERER SHALL render fragments via instanced groups to reduce draw calls and triangle counts. (Acceptance: perf harness shows reduced triangle throughput.)

2. WHEN fragment pools are exhausted, THE SYSTEM SHALL clamp visual fragments gracefully and log a rate-limited warning. (Acceptance: saturation tests.)

## Implementation Plan

- Create `src/components/debris/DebrisInstancedManager.tsx` with per-material pools and TTL-based reclamation.
- Use simplified shard geometries and geometry cache utilities.
- Add unit tests for pool behavior and perf harness scenarios.

## Tests & Acceptance

- Unit tests for pool allocation/reclamation and attribute updates.
- Visual snapshots for explosion scenes with heavy debris.
- Perf harness to measure triangle throughput improvements.

## Completion Notes

- Delivered `DebrisInstancedManager` to handle shard attribute preparation, automatic color buffers, and saturation detection.
- Wired the debris manager through the explosion rendering path and expanded manager tests for saturation handling.
- Shared instancing infrastructure feeds both explosion pools and LOD impostor flows for consistent warnings.

---
