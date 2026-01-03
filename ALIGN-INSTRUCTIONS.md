# Alignment of Instructions

This document tracks the review and optimization of the `.github/instructions/` files to ensure they align with the repository structure and best practices.

## File Review Status

| File | Purpose | Changes Made | Rationale |
|------|---------|--------------|-----------|
| `markdown.instructions.md` | Standards for Markdown content (headings, lists, frontmatter). | Pending | |
| `memory-bank.instructions.md` | Defines the Memory Bank structure (`projectbrief.md`, `activeContext.md`, `tasks/`, etc.) and workflows. | **Aligned** | Verified task naming convention (`TASKID-taskname.md`) matches observed `scripts/` regex. |
| `nodejs-javascript-vitest.instructions.md` | Guidelines for Node.js/JS code and Vitest testing. | **Aligned** | Guidelines match repo practices (Vitest, `npm run typecheck`, `npm test`). |
| `playwright-typescript.instructions.md` | Guidelines for writing Playwright tests in TypeScript. | **Optimized** | Fixed formatting issues, clarified directory structure (`test/playwright/` vs `tests/`), and cleaned up the "Short Guide" section. |
| `powershell.instructions.md` | Best practices for PowerShell scripts. | Pending | |
| `reactjs.instructions.md` | React development standards (hooks, component design, etc.). | **Optimized** | Updated testing section to specify Vitest instead of Jest, matching `package.json`. |
| `self-explanatory-code-commenting.instructions.md` | Guidelines for code comments (WHY vs WHAT). | Pending | |
| `spec-driven-workflow-v1.instructions.md` | Defines the 6-phase spec-driven development loop (Analyze -> Handoff). | **Optimized** | Removed duplicated "Cookbook style" content at the end of the file. |

## Detailed Changes

### `spec-driven-workflow-v1.instructions.md`
- **Change**: Removed duplicated "Cookbook style" content at the end of the file.
- **Why**: The file appeared to have a concatenation error where the content repeated itself after the "Technical Debt" section.

### `playwright-typescript.instructions.md`
- **Change**: Moved the "Short Guide" to the top, fixed the broken code block at the end, and updated the example to match repo-specific paths (`test/playwright/`).
- **Why**: Formatting was broken, and paths were generic (`tests/`) instead of repo-specific (`test/playwright/`).

### `memory-bank.instructions.md`
- **Reviewed**: Verified task naming conventions in `scripts/renumber_tasks_by_mtime_oldest.cjs` use `TASK\d{3}-.+\.md`. The instruction uses `TASKID-taskname.md` which is consistent.
- **Result**: No changes needed.

### `nodejs-javascript-vitest.instructions.md`
- **Reviewed**: Confirmed `npm run typecheck` and `npm test` are the correct commands. Confirmed Vitest is the runner.
- **Result**: No changes needed.

### `reactjs.instructions.md`
- **Change**: Updated "Testing" section to mention Vitest instead of Jest.
- **Why**: `package.json` confirms Vitest is the test runner.
