## Memory Policy and Session Checklist

Short goal: ensure every agent or contributor starts work by capturing and consulting the repository memory snapshot so the knowledge graph stays current and agent decisions are reproducible.

Session-start prompt (copy-paste for assistants/agents):

"Before starting work, load the project's memory snapshot and update it with observations for any files you will touch. Run `npm run generate-memory-index` to regenerate `docs/memory_index.md` and include any new entries in your commit or pull request. Use the memory tool for detailed observations (types, public APIs, behavior)."

Practical checklist (human or automated agent):

- Step 1: Run the generator locally to check current snapshot:

  npm run generate-memory-index

- Step 2: If you will edit or add files, add concise observations to `docs/memory_snapshot.json` or use the memory tool to record them programmatically.

- Step 3: Re-run the generator and inspect `docs/memory_index.md` for correctness.

- Step 4: Commit `docs/memory_snapshot.json` and `docs/memory_index.md` alongside your code changes.

- Step 5 (optional but recommended): Open a PR and ensure CI runs the generator to validate the generated index matches the committed files.

Quick templates for observations (JSON node):

{
  "name": "<Short node name e.g. src/entities - createShip()",
  "source": "<relative path>",
  "summary": "Two-line summary: what it is, why it's important."
}

Why this matters:

- Keeps automated agents from repeating work or missing domain constraints.
- Makes PR reviews faster: reviewers can see human-readable summaries of relevant modules.
- Enables reproducible agent behavior across sessions.
