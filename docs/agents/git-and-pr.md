# Git + PR workflow

## Commits

- Keep commits small and test-backed.
- Use clear, imperative messages (example: `fix: correct shield hit rounding`).

## Before pushing

- Run `pnpm run typecheck` and `pnpm test`.

## Releases and version sync

- Keep `package.json` `"version"` in sync with release tags: tag `vX.Y.Z` ⇔
  `"version": "X.Y.Z"`.
- Bump `"version"` in the same commit/PR that is about to be tagged, then verify with
  `pnpm run version:check vX.Y.Z` before pushing the tag.
- The "Deploy to GitHub Pages" workflow enforces this for tag refs; it is a no-op on
  branches and `workflow_dispatch`.
- See `test/deployment-validation.md` for the full manual procedure and the `v2.2.0`
  historical caveat.

## Pull requests

- Include intent and any linked issues.
- For visual changes, include screenshots or logs.

## Breaking changes

- If types or config change in a breaking way, add a record in `PR_NOTES/`.
- Include migration notes or a fallback where appropriate.
