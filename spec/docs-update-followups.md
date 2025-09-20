# Docs update follow-ups

During the quick repo sweep I updated `spec/src-structure.md` and `README.md` to reflect the current `src/` layout (notably `src/game/` and `src/components/` instead of older `src/core`/`src/renderer` split in some docs).


Files that mention `src/core` or old paths and likely need small edits:

- `spec/shader-authoring-guide.md`
- `spec/particle-explosion-spec.md` (mentions `src/core` wiring)
- `spec/prd-particle-explosion.md`
- `plan/plan-performancepass.md`
- `docs/gltf-rendering-pipeline.md`
- `docs/core_api_summary.md`
- `memory/*` files referencing `src/core/*` (multiple)
- `scripts/debug-turret.mjs` (script imports from `src/core/*`)
- `GEMINI.md` (mentions modular layout `src/core` / `src/renderer`)

Recommendation:

- Create a small PR that replaces `src/core` -> `src/game` where appropriate, or add a short note in affected docs indicating that `src/game/` is the current location and `src/core/` references are historical.
- For scripts that import `src/core/*`, evaluate whether those scripts are stale or whether a migration in code is needed.

If you'd like, I can prepare a focused PR that updates doc references (non-code) in the repository. For code changes (scripts/imports), I'll need to run tests and ensure no runtime breakage.
