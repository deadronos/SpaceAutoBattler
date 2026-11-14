# SpaceAutoBattler — Agent Guide

SpaceAutoBattler is a deterministic, browser-based 3D space auto-battler built with TypeScript, React Three Fiber, and Rapier3D.

## Non-Negotiable Rules

- **Tooling**: Use `pnpm` / `vp` (`vite-plus`). Never edit generated output in `dist/` unless explicitly asked.
- **Determinism**: Use the seeded RNG utilities in `src/utils/rng.ts` for any simulation or AI randomness. Avoid module-level mutable state outside `GameState`.
- **Canonical state & types**: Use `GameState` and shared types from `src/types/index.ts` (avoid ad-hoc duplicates).
- **Minimum verification**: Run `pnpm run typecheck` and `pnpm test` after meaningful code changes.

## Doc-Code Lockstep & Drift Alignment

- **Update docs in lockstep**: Whenever you change scripts, architecture, flags, file layouts, or workflows, update the relevant doc(s) in `docs/agents/` (and affected `AGENTS.md` / `spec/` / `test/` docs) in the same change.
- **Surface & align drift**: If you notice code/implementation has drifted from the docs, or docs have drifted from the implementation, **surface it explicitly** and align them (update stale docs to match current code, or fix code that violates documented contracts).

## Progressive Disclosure (`docs/agents/`)

Read only the guide(s) relevant to your task:

- **Tooling & scripts**: [docs/agents/tooling.md](docs/agents/tooling.md) — `pnpm`/`vp` commands, lint/format, build, perf, and asset checks.
- **Architecture & engine**: [docs/agents/architecture.md](docs/agents/architecture.md) — repo layout, `GameState` boundaries, R3F + Rapier3D loop, worker flags, decoders, rendering subsystems, and nested `AGENTS.md` guides.
- **Coding conventions**: [docs/agents/coding-conventions.md](docs/agents/coding-conventions.md) — module style, typing, error handling, and visual event contracts.
- **Testing & verification**: [docs/agents/testing.md](docs/agents/testing.md) — Vitest (`test/vitest/`), Playwright (`test/playwright/`), `vp check`, `smoke:dev`, and `perf:ai-budget`.
- **Procedures & releases**: [docs/agents/procedures.md](docs/agents/procedures.md) — commits, PRs, `PR_NOTES/`, release tag `version:check`, and doc-code alignment.
- **Memory bank & specs**: [docs/agents/memory-bank-and-specs.md](docs/agents/memory-bank-and-specs.md) — how `memory/` and `spec/` relate to `docs/agents/`.
