# Scripts

This folder contains helper scripts used for manual debugging and development. These are intentionally kept outside the main test suite to avoid long-running E2E steps in CI or while running unit tests.

## Playwright debug runner

File: `playwright-debug-runner.cjs`

Purpose:

- Run a headless Playwright flow that navigates to the built UI, interacts with some UI controls (Start/Play buttons), captures a snapshot and a screenshot, and writes diagnostic JSON to `playwright-debug/run-result.json`.

When to use:

- Use this for manual debugging when you want a quick snapshot of the UI state or to capture logs/screenshots of a live build.
- This is not part of automated tests and is executed manually.

How to run (Windows PowerShell):

```powershell
# Optional: build the project first
npm run build
npm run build-standalone

# Run the debug runner
node scripts\playwright-debug-runner.cjs
```

Outputs:

- `playwright-debug/run-result.json` — JSON diagnostic snapshot and console logs.
- `playwright-debug/ship-debug-<timestamp>.png` — screenshot of the page.

Notes:

- The script starts `npm run serve:dist` to host the built files on port 8080 and attempts to stop any existing process on that port first (Windows only). If you use a different server or port, update the script.
- The runner uses Playwright in headless mode by default; edit the script to run headful (for interactive debugging) by changing `chromium.launch({ headless: true })` to `headless: false`.
- Keep this script out of CI by invoking it manually; the test suite contains a small `test.skip` placeholder so vitest won't run the heavy flow.

If you want a convenience npm script in `package.json`, add:

```json
"scripts": {
  "debug:playwright": "node scripts/playwright-debug-runner.cjs"
}
```

Then run `npm run debug:playwright`.
