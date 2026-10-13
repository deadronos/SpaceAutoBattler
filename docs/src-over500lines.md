# Source files in `src/` with more than 500 lines (code-only)

This file is a generated snapshot from scanning the TypeScript and TSX files in
`src/` and listing those that exceed 500 lines of code. Binary assets and
non-source files (GLB, PNG, JPG, etc.) are excluded from the scan.

Code files found (over 500 lines), as of 2026-10-13:

- **None.** No `.ts`/`.tsx` file under `src/` currently exceeds 500 lines.

For reference, the largest non-code stylesheet is no longer a single file: the
former `src/styles/app.css` (1050 lines) has been split, and `src/styles/app.css`
is now a 9-line entry that `@import`s `variables.css`, `hud.css`, `hud-drawer.css`,
`progress.css`, `ai-debug.css`, `controls.css`, `progression.css`,
`responsive.css`, and `a11y.css`. CSS is excluded from the scan above regardless.

The decomposition write-ups in
[`large-file-refactor-candidates.md`](./large-file-refactor-candidates.md) are now
historical: the files they targeted have since shrunk below the threshold.

Notes:

- Extensions considered: `.ts` and `.tsx` under `src/` only.
- Line counts were measured on the host machine at the time of generation.
- Largest current code file for reference: `src/utils/spatialGrid.ts` (~372 lines).
