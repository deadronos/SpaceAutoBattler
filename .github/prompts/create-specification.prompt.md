---
mode: 'agent'
description: 'Create a new specification file for the solution, optimized for Generative AI consumption.'
tools: ['changes', 'codebase', 'editFiles', 'extensions', 'fetch', 'githubRepo', 'openSimpleBrowser', 'problems', 'runTasks', 'search', 'searchResults', 'terminalLastCommand', 'terminalSelection', 'testFailure', 'usages', 'vscodeAPI']
---
# Create Specification

Your goal is to create a new specification file for `${input:SpecPurpose}`.

The specification file must define the requirements, constraints, and interfaces for the solution components in a manner that is clear, unambiguous, and structured for effective use by Generative AIs. Follow established documentation standards and ensure the content is machine-readable and self-contained.

## Best Practices for AI-Ready Specifications

- Use precise, explicit, and unambiguous language.
- Clearly distinguish between requirements, constraints, and recommendations.
- Use structured formatting (headings, lists, tables) for easy parsing.
- Avoid idioms, metaphors, or context-dependent references.
```prompt
---
mode: 'agent'
description: 'Cookbook: create an AI-friendly specification file template and example for a given purpose.'
---

Receipt: "From `${input:SpecPurpose}` produce a concise spec saved as `/spec/spec-[purpose]-[name].md` containing Purpose, Requirements, Interfaces, Acceptance Criteria, Tests, Dependencies."

Plan:
- Create front-matter (title, version, date, owner, tags).
- Provide short Introduction, Purpose & Scope, Definitions (only necessary terms).
- List Requirements (REQ-###), Acceptance Criteria (AC-###), Interfaces/Data Contracts, Test Strategy, Dependencies, Examples/Edge Cases, and Related Specs.

Assumptions:
- Keep spec implementation-agnostic and machine-parseable.
- Use Given-When-Then for acceptance criteria and short code examples only when necessary.

One-line template:
"Generate spec for `${input:SpecPurpose}` → `/spec/spec-[purpose]-[name].md` with Purpose, REQs, ACs, Interfaces, Tests, Dependencies."

Output example (markdown):
````md
---
title: Deterministic RNG for Simulation
version: 1.0
date_created: 2025-08-22
owner: core-team
tags: [infrastructure, feature]
---

## Purpose & Scope
Short description...

## Requirements
- REQ-001: Provide seeded RNG API

## Acceptance Criteria
- AC-001: Given seed X, when RNG is used, then outputs are deterministic across runs

## Interfaces
- API: srand(seed), srandom()

## Tests
- Unit tests verifying deterministic outputs

````

`````
This is the description of what the code block changes:
<changeDescription>
Replace with compact spec creation prompt template (EARS format emphasis).
</changeDescription>

This is the code block that represents the suggested code change:
```prompt
Receipt: I'll draft a concise specification using EARS format for the requested feature.

Plan:
1) Provide 3–5 EARS requirements (WHEN ..., THE SYSTEM SHALL ... [Acceptance]).
2) Add 2 edge cases and 2 non-functional constraints (perf/security).
3) Provide one short test matrix mapping requirements → tests.

Assumptions: Feature scope fits in a single PR-sized change.

Constraints: Keep spec under 450 words.

Output: `requirements.md` formatted with EARS entries and acceptance checks.

Example: "WHEN a ship HP <= 0, THE SYSTEM SHALL emit explosion event. Acceptance: state.explosions includes {id,x,y,team}."
```
<userPrompt>
Provide the fully rewritten file, incorporating the suggested code change. You must produce the complete file.
</userPrompt>

