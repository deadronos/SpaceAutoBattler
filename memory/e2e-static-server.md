# e2e-static-server (`scripts/e2e-static-server.mjs`)

**Summary:**

A small static file server used to serve built artifacts for E2E/Playwright runs during development and CI. Starts an HTTP server on a configurable port, serves `dist/` or `build/` output, and supports gzip/brotli verification in integration checks.

**Usage:**

- Script: `scripts/e2e-static-server.mjs`
- Invoked by Playwright E2E harness when a local build must be served for visual tests.

**Notes / Next steps:**

- Ensure the server exposes correct content-type headers and supports compression checks used by `scripts/verify-compression.mjs`.
- Add a small test or CI smoke job that runs the server and validates a known static page to catch regressions in deployment changes.

**Added to memory:** 2026-01-09
