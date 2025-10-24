# GitHub Copilot Workflow Guide

## Policy Precedence

- System, platform, and developer directives override everything here. Follow repository instructions in `.github/instructions/` and `AGENTS.md` when interpreting these rules.
- If guidance conflicts, pause work and clarify via the designated escalation path before proceeding.

## Edit Scope

- Modify source only under `src/` (TypeScript). Never touch `dist/` artifacts or generated files unless explicitly asked.
- Keep runtime state changes aligned with the canonical `GameState` defined in `src/types/index.ts`; avoid new module-level state.
- Preserve deterministic behavior by using the seeded RNG utilities in `src/utils/rng.ts` for any simulation or AI randomness.

## Development Workflow

1. **Analyze** – Review relevant instructions, memory bank entries, and existing code. Capture testable requirements (EARS format) when work is non-trivial.
2. **Design** – Draft a concise plan (structure, interfaces, data flow). Update `Copilot-Processing.md` or a task note if requested.
3. **Implement** – Work in small increments. Prefer refactoring existing utilities/configs over new ad-hoc logic. Use cached loaders/material registries for renderer changes.
4. **Validate** – After substantive edits, run `npm run typecheck` and `npm test`. For renderer changes, consider manual smoke steps or targeted unit specs if feasible.
5. **Reflect & Handoff** – Document outcomes, record follow-ups or technical debt, and summarize results in the response.

## Coding Standards

- Use two-space indentation, semicolons, ES modules, and explicit typing for exported symbols.
- Favor self-explanatory code; write comments only for intent, constraints, or non-obvious algorithms.
- Reuse existing config (`src/config/*`) and renderer registries. Dispose Three.js resources you create and leverage cached loaders (`useGLTF`, material registry) for assets.
- Keep performance hot paths allocation-free when possible. Respect selective bloom layer assignments and renderer toggles.

## Testing & Validation

- Minimum gates: `npm run typecheck` and `npm test` (Vitest) after meaningful code modifications.
- Add or update unit tests for new behavior, ensuring determinism (seeded RNG, stable state snapshots).
- Note any warnings surfaced during validation (e.g., Drei multiple-Three warnings) and confirm whether they are pre-existing.

## Documentation & Communication

- Maintain `Copilot-Processing.md` or the active task log when instructed: record plan updates, execution steps, and summaries.
- Reference files and symbols with backticks in responses (`src/components/Battlefield.tsx`).
- Provide concise completion summaries covering requirements, files touched, and validation status. Include follow-up recommendations where appropriate.

## Memory Bank Usage

- Consult `memory/activeContext.md`, `memory/progress.md`, and relevant task files at task start to recover context.
- When creating or updating tasks, follow the structure in `memory/tasks/_index.md` and individual task templates.
- Record significant decisions, patterns, or open issues in the memory bank when prompted.

## Command Reference

```powershell
npm install
npm run typecheck
npm test
npm run build
npm run build-standalone
```

- Prefer the existing scripts above for builds and tests. When sharing commands in responses, keep them copyable and on separate lines.
