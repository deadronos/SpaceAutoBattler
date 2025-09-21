# src/utils/rng.ts

Path: src/utils/rng.ts
Last-Reviewed: 2025-09-21

Purpose: Deterministic, seeded RNG utility used by the simulation for reproducible runs. Provides functions like `seed`, `rand`, and helpers for sampling.

Key exports/symbols:
- seedRng / SeededRng class
- randomFloat / randomInt helpers

Notes:
- Do not replace with Math.random in simulation-critical code.
