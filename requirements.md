# Requirements — Memory Bank Refresh

## Context

This document captures the testable requirements for updating the `memory/` knowledge base so it reflects the current celestial environment feature set and repository structure on branch `celestialenvironment`.

## EARS Requirements

1. **WHEN** the memory bank documents current work focus, **THE SYSTEM SHALL** summarise active initiatives around the celestial environment renderer (lighting, planetary assets, and tests) and de-emphasise legacy AI V2 rollout notes.  
   _Acceptance:_ `memory/activeContext.md` highlights celestial environment deliverables and no longer lists AI V2 rollout as an active next step.

2. **WHEN** repository changes land that supersede older notes, **THE SYSTEM SHALL** remove or replace outdated entries in `memory/progress.md` so the most recent updates describe celestial environment tasks completed through 2025-09-25.  
   _Acceptance:_ The top section of `memory/progress.md` is rewritten with at least three dated entries from September 2025 describing texture hooks, rim material, lighting, and tests.

3. **WHEN** task records exist under `memory/tasks/`, **THE SYSTEM SHALL** ensure the index and individual files reflect their true status (Completed vs In Progress) and content matches files present on disk.  
   _Acceptance:_ `memory/tasks/_index.md` lists completed tasks referencing the `COMPLETED/` subfolder, and any entries marked “In Progress” have either been updated or moved out of the completed list.

4. **WHEN** core reference documents exist for engine subsystems, **THE SYSTEM SHALL** create or update dedicated memory files covering the celestial environment module (config schema, components, hooks, and tests).  
   _Acceptance:_ At least one new `memory/core-*.md` file explains celestial environment structure and is cross-linked or referenced in `progress.md`.

5. **WHEN** errors occur while loading planet textures or rendering the environment, **THE SYSTEM SHALL** document expected mitigations in an error matrix to guide triage.  
   _Acceptance:_ `design.md` (Error Handling section) includes an error matrix with detection, impact, and mitigation rows for texture, shader, and performance failures.
