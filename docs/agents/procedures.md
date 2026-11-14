# Procedures (Git, PRs, Releases & Doc Alignment)

## Commits & Pull Requests

- Keep commits small, focused, and test-backed.
- Use clear, imperative commit messages (e.g., `fix: correct shield hit rounding`).
- Run `pnpm run typecheck` and `pnpm test` (and `vp check` when touching formatting/lint-sensitive files) before pushing.
- Include intent and any linked issues in PRs; for visual changes, include screenshots or logs.

## Doc-Code Lockstep & Drift Alignment

- **Lockstep updates**: When changing scripts, build/test config, query flags, directory layouts, or architectural contracts, update the relevant `docs/agents/` file(s) (and any affected `AGENTS.md`, `spec/`, or `test/deployment-validation.md`) in the same PR.
- **Drift alignment**: Whenever you discover that code has drifted from documentation or documentation has drifted from code:
  - Surface the discrepancy clearly in your summary or PR description.
  - Update stale docs to match the verified implementation, or fix implementation code that violates a documented invariant.

## Breaking Changes

- If types, simulation contracts, or config schemas change in a breaking way, add a record in `PR_NOTES/` with migration notes or fallback behavior.

## Releases & Version Sync

- Keep `package.json` `"version"` in sync with release tags: tag `vX.Y.Z` ⇔ `"version": "X.Y.Z"`.
- Bump `"version"` in the same commit/PR that is about to be tagged, then verify with:
  `pnpm run version:check vX.Y.Z`
- `.github/workflows/deploy-pages.yml` enforces this for tag refs (`v*`) and is a no-op on branches and `workflow_dispatch`.
- See `test/deployment-validation.md` for the full release/deployment checklist and the `v2.2.0` historical caveat.
