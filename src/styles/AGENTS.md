# Agents Guide: src/styles

- Purpose: CSS assets that complement the React HUD and overlays.
- Scope: Prefer component-scoped classes; namespace globals with `sab-` to avoid collisions.
- Tooling: CSS is bundled by Vite; confirm new selectors compile by running `pnpm run build`.
- Accessibility: Maintain sufficient contrast and responsive behaviour; sync UI changes with Playwright coverage.
- Coordination: Document breaking visual changes in PR descriptions and include before/after screenshots when practical.
