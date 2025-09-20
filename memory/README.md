# Memory directory — SpaceAutoBattler

This folder contains short, curated knowledge 'memories' about the project used by the Serena MCP agent.

Purpose

- Keep human-friendly summaries of project structure, API contracts, and operational notes.
- Provide quick reference for automated agents and contributors.

Memory format

- Each memory is stored in the MCP memory store (Serena) and may also have a mirror file in `memory/*.md`.
- Memory names are short snake_case identifiers like `project_purpose`, `game_state_api`.
- Content is Markdown-friendly plaintext with: a short title, purpose, inputs/outputs, side-effects, error modes, and notes.

Regeneration script

- A helper script `scripts/generate_memories.mjs` is provided to (partially) regenerate/update memory files from source.
- The script is intentionally conservative: it extracts function-level comments or generates basic API stubs — it does not replace manual hand-written memories.

How to keep memories in sync

1. When you change a core function's behavior, update the corresponding memory file under `memory/` and/or update the Serena memory using the MCP tools.
2. Optionally run the script to regenerate stubs and then manually merge improvements.

Commands

- Regenerate stubs locally (node):

```powershell
node ./scripts/generate_memories.mjs
```

- After updates, update the MCP memories using the Serena tools (used by the agent) if available in your environment.

Conventions

- Use present-tense, imperative style for descriptions.
- Include edge cases (null inputs, extreme dt, missing configs).
- Document determinism concerns (RNG usage, Date.now usage).

If you want, I can extend the script to parse JSDoc/TSDoc comments and produce richer structured memories (JSON + markdown).
