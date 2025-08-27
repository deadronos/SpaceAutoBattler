# Prompt Structural Recommendations

This document recommends structural changes to the repository's prompt/chatmode/instructions artifacts to better support /spec/gameprompt.md. It is intended as a concise, actionable guide developers can follow to bring prompt assets into alignment with the spec and enable validation, versioning, and automation.

## Goals

- Make it explicit which prompt/chatmode files implement which game prompt spec sections.
- Standardize prompt and chatmode metadata so tools and CI can validate them.
- Provide canonical slot/type schemas for prompts used by game logic.
- Add guidance for change management and testing of prompt changes.

## Recommended Additions

1. Mapping manifest

Create `.github/prompt-mapping.yml` (or `spec/prompt-mapping.yml`) that links `spec/gameprompt.md` sections to chatmode and prompt template files.

Example entry:

- id: capture_action
  spec_section: "Capture action: definition and examples"
  chatmodes:
  - .github/chatmodes/blueprint-mode.chatmode.md
    prompts:
  - .github/prompts/prompt-builder.prompt.md
    tests:
  - test/prompt/capture_action.spec.ts

Why: Enables automation, discoverability, and CI checks.

2. Standardized frontmatter for prompts and chatmodes

Require each prompt and chatmode file to include a YAML frontmatter block with these fields:

- id: unique identifier
- title: short title
- intent: one-line description of purpose
- inputs: brief schema or reference to JSON Schema
- outputs: expected output shape or reference
- examples: 1+ examples showing input -> expected output
- constraints: optional list of constraints (tone, length, safety)

Example frontmatter:

---

id: capture_action
title: Capture action prompt
intent: Convert game state to a single best capture action
inputs: spec/schemas/gameState.schema.json
outputs: spec/schemas/action.schema.json
examples:

- input: '{...}'
  output: '{...}'
  constraints:
- concise
- one-sentence action

---

Why: Machine-readable metadata supports validation and tooling.

3. Prompt/Chatmode JSON Schemas

Add `spec/schemas/` with JSON Schema files for common prompt slots (gameState, entity, action, config). Reference them from frontmatter.

Why: Ensures consistent shapes across prompts and reduces ambiguity.

4. Lint/Validation script

Add a small Node script (e.g., `scripts/validate-prompts.mjs`) which:

- Reads the mapping manifest
- Ensures listed files exist
- Parses frontmatter, validates required fields
- Validates referenced JSON Schemas
- Runs example-based checks (optional)

Add CI job to run this script on PRs.

Why: Prevents regressions and missing metadata.

5. Versioning and changelog guidance

Create `.github/PROMPT_CHANGELOG.md` and add rules in `copilot-instructions.md` for when to bump prompt spec versions, list breaking changes, and required migration steps.

Why: Makes prompt evolution safe and auditable.

6. Align tone/behavior constraints

Extract global assistant behavior from `copilot-instructions.md` into a small file (e.g., `.github/assistant-behavior.yml`) and require chatmodes to reference or inherit it.

Why: Prevents conflicting instructions across chatmodes.

## Migration Plan (prioritized)

1. Add `spec/prompt-mapping.yml` with mappings for 3-5 highest-priority sections from `spec/gameprompt.md`.
2. Create `spec/schemas/gameState.schema.json` and `spec/schemas/action.schema.json` with minimal required fields.
3. Update 2 existing prompt/chatmode files to include the new frontmatter format as examples.
4. Add `scripts/validate-prompts.mjs` and wire it to CI.
5. Document process in this file and `.github/PROMPT_CHANGELOG.md`.

## Example: Minimal JSON Schema (gameState)

{
"$schema": "http://json-schema.org/draft-07/schema#",
"title": "GameState",
"type": "object",
"properties": {
"entities": {
"type": "array",
"items": { "type": "object" }
},
"turn": { "type": "integer" }
},
"required": ["entities"]
}

## CI Hook Suggestion

- Add GitHub Actions workflow `.github/workflows/validate-prompts.yml` that runs Node (or Deno) to execute `scripts/validate-prompts.mjs` on push/PR.

## Notes and Risks

- Rewriting prompt files to include frontmatter may change assistant behavior; changes should be tested incrementally.
- Initial schema design should be conservative; evolve as needed.

## Next steps I can implement

- Create `spec/prompt-mapping.yml` with sample mappings for a few `spec/gameprompt.md` sections.
- Add `spec/schemas/gameState.schema.json` and `spec/schemas/action.schema.json`.
- Update two prompt/chatmode files to include frontmatter examples.
- Implement `scripts/validate-prompts.mjs` and add CI workflow.

If you want, I will implement the migration plan's first 3 items now.
