// simWorker.js - stubbed runtime module
// The real implementation is now in src/simWorker.ts. This empty module
// remains to avoid runtime loader errors in environments that reference
// './simWorker.js' directly (e.g., new Worker(new URL('./simWorker.js', import.meta.url))).
// It intentionally exports nothing to avoid duplicate-symbol issues with the
// TypeScript implementation during migration.

// Re-export TypeScript implementation so imports that target './simWorker' get
// the runtime helpers (used by tests). This forwards exports to the TS file
// during dev/test runs where the environment can load .ts sources.
export * from './simWorker.ts';
