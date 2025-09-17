# Worker Entity Index Handshake

This document describes the small message handshake between the main thread
and the physics simulation worker (`src/simWorker.ts`) used to enable a
best-effort, worker-local copy of the project's entity index (miniplex +
UniformGrid).

Messages

- `init-entity-index` (request)
  - payload: { bucketSize?: number }
  - Description: Dynamically imports `src/core/entityIndex` inside the worker
    and constructs a new runtime index with the provided bucket size. This is
    optional and only performed when the main thread explicitly requests it.
  - Response: `init-entity-index-done` with `{ ok: true }` on success or `{ ok: false }`.

- `dispose-entity-index` (request)
  - payload: none
  - Description: Attempts to clear and dispose the worker-local entity index.
  - Response: `dispose-entity-index-done` when complete.

- `debug-entity-index-count` (request)
  - payload: none
  - Description: Development/debug helper that returns the current number of
    entities tracked by the worker-local index (if any). Non-blocking and
    best-effort; intended for tests and developer tools only.
  - Response: `debug-entity-index-count-done` with `{ ok: boolean, count: number }`.

Notes

- The worker-side entity index is best-effort and wrapped in try/catch. If the
  dynamic import fails or the index methods throw, the worker continues to
  function normally without the index.
- Use the debug endpoint only in test/dev environments; it is not intended for
  production telemetry.
