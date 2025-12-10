# Designs index

This folder contains canonical design documents named using the pattern `DESIGNNN-topic.md` (zero-padded three-digit IDs starting at 001).



## In Progress

- [DESIGN055](DESIGN055-capped-buffer-helper.md) — Shared capped-buffer helpers centralize history trimming across debug and metrics surfaces. (In Progress — implementation underway) (2025-10-29)
- [DESIGN048](DESIGN048-renderer-large-file-plan.md) — Plan to split large renderer files into focused modules with clear test boundaries and a migration plan. (In Progress — implementation planning) (2025-10-27)
- [DESIGN049](DESIGN049-renderer-config-refactor.md) — Refactor renderer config into smaller focused modules and add a façade for parity tests. (In Progress — design review) (2025-10-27)
- [DESIGN050](DESIGN050-particle-trails-refactor.md) — Extract particle trail resources and anchors into reusable modules for instancing and testing. (In Progress — implementation PR pending) (2025-10-27)
- [DESIGN045](DESIGN045-refactor-damage-calculation.md) — Centralize damage math and provide thin adapters to simulation systems (design linked to TASK021). (In Progress — design published) (2025-10-27)
- [DESIGN046](DESIGN046-refactor-subsystems.md) — Refactor subsystem lifecycle and repair logic into a subsystem module (design linked to TASK022). (In Progress) (2025-10-27)
- [DESIGN056](DESIGN056-main-simulation-loop-perf.md) — Main simulation loop profiling and guard tuning for `updateGame`. (Proposed) (2025-11-16)
- [DESIGN057](DESIGN057-motion-system-hotpath-tuning.md) — Motion system hotpath tuning for per-ship updates. (Proposed) (2025-11-16)
- [DESIGN058](DESIGN058-projectile-advance-perf.md) — Projectile advance hotpath performance improvements. (Proposed) (2025-11-16)
- [DESIGN059](DESIGN059-projectile-instancing-perf.md) — Projectile instancing and instanced layer performance improvements. (Proposed) (2025-11-16)
- [DESIGN060](DESIGN060-ship-interpolation-perf.md) — Ship interpolation and visual smoothing performance modes. (Proposed) (2025-11-16)
- [DESIGN062](DESIGN062-error-handling-centralization.md) — Centralized error handling and silent catch block remediation. (Proposed) (2025-11-25)

## Completed

- [DESIGN063](DESIGN063-flak-proximity-tests.md) — Align flak proximity tests with `FireProjectileOptions` contract and restore lint/type safety. (Completed) (2025-12-10)
- [DESIGN061](DESIGN061-bloom-provider-refactor.md) — Refactor BloomProvider into smaller focused modules for testability and maintainability. (Completed) (2025-11-24)
- [DESIGN035](DESIGN035-star-disk-material.md) — Star disk material design and shader notes; baseline implementation validated in tests. (2025-10-27)
- [DESIGN042](DESIGN042-centralize-projectile-info.md) — Centralized projectile metadata and helpers; reduced duplication across projectile systems. (2025-10-27)
- [DESIGN043](DESIGN043-materials-presets-and-factory.md) — Material presets and factory pattern for consistent material creation and testing. (2025-10-27)
- [DESIGN031](DESIGN031-thruster-trails-gpu.md) — GPU-managed thruster trails and instancing plan; prototype validated. (2025-10-06)
- [DESIGN001](DESIGN001-safekinematics.md) — Safe-kinematics guardrails and numeric stability notes. (2025-10-02)

## Pending

- [DESIGN028](DESIGN028-ship-lod-visibility.md) — Ship LOD visibility rules and impostor integration. (Pending) (2025-10-05)
- [DESIGN020](DESIGN020-star-disk-view-compensation.md) — Star disk view compensation follow-ups and tuning tasks. (Pending) (2025-10-07)

If you want a different ordering or to promote a design into the In Progress list, tell me which files to prioritize and I will update this index.
