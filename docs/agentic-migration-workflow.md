
# Agentic Migration & Workflow Guide

## Purpose

This guide helps contributors and agentic agents discover, understand, and execute type/config migrations and major changes in SpaceAutoBattler.

## Canonical GameState Migration

All simulation, rendering, and UI state is now centralized in the canonical `GameState` type (`src/types/index.ts`).
Every subsystem (simulation, renderer, UI) receives and mutates the `GameState` object—no scattered state variables.
Simulation is deterministic and uses seeded RNG (`src/rng.ts`).
State serialization and deserialization are supported for replay, debugging, and determinism validation.

All new code and tests must use the canonical `GameState` for state access and mutation. For serialization/replay, use the provided helpers and validate determinism with test cases.

## Key Documentation Locations

- **Change logs:** `.copilot-tracking/changes/` (granular, timestamped migration notes)
- **Decision records:** `/PR_NOTES/` (summaries and rationale for major changes)
- **Specs & status:** `/spec/IMPLEMENTATION_STATUS.md` (current implementation and migration status)
- **Contributor guide:** `AGENTS.md` (best practices, requirements, and workflow)
- **General docs:** `/docs/` (research, renderer, and workflow guides)
- **Entry-point:** `README.md` (project overview and links)

## Migration Workflow

1. **Document all major type/config changes:**
   - Add granular logs to `.copilot-tracking/changes/`.
   - Summarize rationale and migration steps in `/PR_NOTES/`.
   - Update `/spec/IMPLEMENTATION_STATUS.md` after each migration.
   - Update `AGENTS.md` with new requirements and cross-links.
2. **Validate changes:**
   - Run `npx tsc --noEmit` and `npm test` after type/config changes.
   - Add/adjust unit tests for new requirements and fallback logic.
3. **Maintain backward compatibility:**
   - Keep legacy fields (e.g., `dmg`) until all callers are updated.
   - Add fallback logic as needed; remove legacy fields only after full migration.
4. **Cross-link documentation:**
   - Reference decision records, change logs, and specs in AGENTS.md and README.md.
   - Use clear filenames and section headers for discoverability.

## Agentic Agent Discoverability Tips

- Always check `.copilot-tracking/changes/`, `/PR_NOTES/`, `/spec/`, `/docs/`, and `README.md` for migration context.
- Follow cross-links in AGENTS.md and README.md to find relevant notes and status.
- Parse code comments for inline documentation of required/optional fields and migration notes.

## References

- See `/PR_NOTES/2025-08-23-type-config-tightening.md` for latest migration decision record.
- See `.copilot-tracking/changes/2025-08-23-*` for granular change logs.
- See `/spec/IMPLEMENTATION_STATUS.md` for current status.
- See `AGENTS.md` for contributor workflow and requirements.
