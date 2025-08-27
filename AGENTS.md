# AGENTS.md

Build, lint, and test (quick reference):

- Build: npm run build
- Build standalone: npm run build-standalone
- Type-check: npx tsc --noEmit
- Run all tests: npm test
- Run a single test file: npx vitest test/<path-to-spec>.spec.ts
- Run Playwright E2E: see playwright.config.js and use npx playwright test

Code style & agent rules (short):

- Edit TypeScript in /src only; do not edit generated /dist JS.
- Use ES module imports; import shared types from src/types/index.ts only.
- 2-space indent, semicolons, prefer const/let (no var).
- Always add explicit types for public APIs and config objects.
- Use seeded RNG (src/utils/rng.ts) for deterministic simulation tests.
- Prefer small, test-backed commits; run npx tsc and npm test before committing.
- Handle errors explicitly (throw or return error values); avoid silent failures.
- Name functions/types clearly and keep event shapes stable (bullets, explosions, shieldHits, healthHits).
- For complete project structure overview, see `spec/src-structure.md`.

Three.js & Rapier3D Integration Rules:

- **Separation of Concerns**: Keep physics (Rapier3D) in simulation worker, Three.js rendering in main thread, postprocessing in renderer
- **Asset Pooling**: Use `GameState.assetPool` for Three.js objects - always dispose with `object.dispose()` before releasing to pool
- **Physics-Visual Sync**: Update Three.js Object3D positions/rotations from Rapier3D rigidbody data each frame via message passing
- **Memory Management**: Dispose Three.js geometries, materials, textures - monitor for leaks using Three.js memory stats
- **Postprocessing**: Configure effects in renderer config, apply through EffectComposer for consistent visual style
- **Performance**: Use object pooling for bullets/particles, implement LOD for distant objects, profile with stats panel

Cursor / Copilot rules:

- Follow rules in .github/copilot-instructions.md if present; respect Copilot suggestions but verify correctness.
- If .cursor/rules or .cursorrules exist, follow those linting/commit rules (check repository root).

Quick notes:

- No runtime dependencies; devDependencies allowed.
- For breaking type/config changes, create a decision record in /PR_NOTES/ and migrate with fallbacks.
- Owner: deadronos, main branch: main

Locking & multi-agent coordination

- Purpose: provide machine-readable rules and a simple lockfile protocol so multiple AI agents can safely share the repository without stepping on each other's edits.
- Recommended lockfile: `.ai-lock.json` at repo root (or per-directory `.ai-lock.json`). JSON schema example:

  {
  "owner": "agent-id",
  "session": "uuid",
  "timestamp": "2025-08-28T12:00:00Z",
  "ttl_seconds": 300,
  "files": ["src/foo.ts","src/bar.ts"],
  "intent": "refactor:extract-function"
  }

- Acquire semantics: create `.ai-lock.json` atomically (write temp + rename) and include `files` scope. Use git status to ensure working tree is clean before acquiring.
- Release semantics: remove lockfile after commit or on failure; provide an audit entry under `.ai-history/` containing the lock metadata and diff.
- Backoff policy: if a lock exists and owner != you, back off exponentially and retry until TTL expiry. If TTL expired, attempt to claim after verification.
- Skip/ignore: agents should respect `agent-config.json` ignorePaths and skip files with active locks they cannot claim. Prefer proposing changes (branch/PR) instead of forcing edits.
- Observability: log lock events (acquire/release/claim-failed) to console and `.ai-history/log.json`.

Simple recommended runtime behavior for agents

1. On start: read `AGENTS.md` and optional `agent-config.json` for repo policies.
2. Before editing a file:
   - Ensure working tree clean for files you'll change (git status).
   - Check for `.ai-lock.json` scope overlap.
   - If no lock, create `.ai-lock.json` with intent and files (atomic write+rename).
   - Make changes in a temporary branch, run `npx tsc --noEmit` and `npm test`.
   - Commit changes, push to remote or create a PR, then remove the lock and write an audit entry.
3. If a lock is present and owned by another agent: back off, or create a change proposal (branch + PR) instead of direct edits.

Failure modes & mitigations

- Stale locks: TTL + heartbeat recommended. Allow manual forced-clear with human confirmation.
- Race conditions: prefer atomic filesystem rename when creating locks; if not available use VCS arbitration (first commit wins) and surface conflicts for manual resolution.
- Partial commits: always stage and run tests on branch before merging; keep commits small.

Security & trust

- Include `owner` and `session` in lockfile; sign or include agent metadata if available to avoid spoofing.
- Prefer per-file or per-directory locks to avoid global blocking.

Where to put coordination config

- `AGENTS.md` (human-readable policy)
- `.github/copilot-instructions.md` (agent guidance)
- Optional `agent-config.json` (machine-readable repo policy with keys: ttl_seconds, ignorePaths, max_retries, backoff_ms)
