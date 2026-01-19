# Git + PR workflow

## Commits

- Keep commits small and test-backed.
- Use clear, imperative messages (example: `fix: correct shield hit rounding`).

## Before pushing

- Run `npm run typecheck` and `npm test`.

## Pull requests

- Include intent and any linked issues.
- For visual changes, include screenshots or logs.

## Breaking changes

- If types or config change in a breaking way, add a record in `PR_NOTES/`.
- Include migration notes or a fallback where appropriate.
