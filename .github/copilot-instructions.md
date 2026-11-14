# GitHub Copilot Workflow Guide

## Policy Precedence

- Follow `AGENTS.md` and `docs/agents/` as the canonical repository guide, along with applicable files in `.github/instructions/`.
- If guidance conflicts, surface the discrepancy and align the docs/implementation.

## Edit Scope & Core Invariants

- Never modify `dist/` artifacts or generated files unless explicitly asked.
- Keep runtime state in the canonical `GameState` (`src/types/index.ts`); avoid module-level mutable state.
- Preserve determinism by using the seeded RNG utilities in `src/utils/rng.ts` for any simulation or AI randomness.

## Development Workflow

1. **Analyze** – Read `AGENTS.md` and only the relevant `docs/agents/` guide(s) for your task.
2. **Implement** – Work in small increments. Reuse existing configs (`src/config/*`), cached loaders (`useGLTF`), and renderer registries; dispose Three.js resources you create and keep hot paths allocation-free.
3. **Validate** – Run `pnpm run typecheck`, `vp check` (if formatting/lint-sensitive), and `pnpm test`.
4. **Lockstep Docs** – Update `docs/agents/` (and any affected docs) whenever scripts, architecture, flags, or workflows change.

## Command Reference

```bash
pnpm install
pnpm run typecheck
pnpm test
pnpm run build
pnpm run build:deploy
```

- See `docs/agents/tooling.md` and `docs/agents/testing.md` for `vp`, Playwright, and specialized checks.
