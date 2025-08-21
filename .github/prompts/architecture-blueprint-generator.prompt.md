---
description: "Architecture blueprint generator — concise prompt template to produce an architecture overview (C4/UML) and implementation guidance from a codebase." 
mode: 'agent'
---

# Architecture Blueprint — Cookbook Prompt

Receipt: I'll produce a concise architecture blueprint for the requested feature or component.

Plan:
1) List three high-level architecture options with one-sentence pros/cons each.
2) Recommend one option and provide a minimal component diagram (text), interfaces, and files to change.
3) Provide 3 acceptance tests and one rollout/migration note.

Assumptions: If no non-functional requirements (scale, latency, persistence) provided, assume low-traffic prototype.

Constraints: Keep output under 400 words; use plain text diagrams (ASCII) and file paths referenced for this repo.

Output sections: Summary, Options, Recommendation, Components & Interfaces, Files to edit, Acceptance tests, Rollout notes.

Example: "Feature: Support WebGL streaming instancing" → Options: (A) single-threaded CPU emit, (B) GPU instanced draws, (C) hybrid. Recommend C for balanced complexity.
