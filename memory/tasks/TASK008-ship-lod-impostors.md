# [TASK008] - Ship LOD Impostors & Instanced Distant-Ship Rendering

**Status:** Not Started  
**Added:** 2025-10-05

## Original Request

Reduce triangle throughput by replacing distant high-poly ships with low-poly LOD impostors or instanced billboards to dramatically reduce triangles and draw calls when many ships are visible at range.

## Scope

- Implement a LOD system that swaps in instanced low-detail ship meshes or billboards for distant ships.
- Provide an instanced renderer to batch distant ship impostors by type/material.
- Add tests for LOD transition smoothness and perf harness comparisons.

## Requirements (EARS-style)

1. WHEN many ships appear at distance, THE RENDERER SHALL replace each distant ship with a low-poly instanced LOD or billboard to reduce triangle count without noticeable visual popping. (Acceptance: perf harness shows triangle reduction and transitions are visually smooth.)

2. WHEN ship LOD changes occur, THE SYSTEM SHALL ensure transitions are frustum and camera-distance aware and deterministic to avoid flicker. (Acceptance: unit tests & visual smoke tests.)

## Implementation Plan

- Create `src/components/lod/ShipLODManager.tsx` to compute LOD levels and manage swapping between full ship GLTF and impostor instances.
- Add instanced rendering for low-detail impostors grouped by ship type.
- Add tests for transition thresholds, culling behavior, and performance metrics.

## Tests & Acceptance

- Unit tests verifying deterministic LOD thresholds and transition logic.
- Visual snapshot tests for large fleet scenes showing acceptable visual differences.
- Perf harness demonstrates triangle count reduction and frame-time improvements.

---
