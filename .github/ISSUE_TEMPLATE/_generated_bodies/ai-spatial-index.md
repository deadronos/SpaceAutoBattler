# Introduce spatial index for AI queries

State now

- AI and steering rely on O(n) scans for neighbors/targets, increasing CPU with fleet size.
- Renderer maintains BVH; core AI side lacks a dedicated spatial structure.

Expected outcome

- Add a lightweight spatial index (uniform grid or reuse BVH) for AI proximity queries (neighbors within R, k-nearest, sector queries).
- Integrate index updates in GameState step; provide query helpers.

Acceptance criteria

- Micro-benchmark shows ≥2× speedup for neighbor queries at 500–1k entities.
- Unit tests cover insertion/removal and query correctness (edge cases at cell boundaries).
- Feature flag to toggle index on/off for A/B perf testing; default safe.

Guidance for testing

- Add a benchmark-like test or timed loop gated by a high timeout budget to compare naive vs indexed queries.
- Validate correctness with seeded RNG and known positions.
