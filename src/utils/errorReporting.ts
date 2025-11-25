/**
 * Centralized error reporting for categorized catch blocks.
 *
 * Silent catches are necessary in several areas (physics cleanup, material
 * lifecycle, WebGL quirks), but masking all errors makes debugging difficult.
 * This module provides lightweight tracking:
 * - **Counters** are always active (minimal overhead).
 * - **Detailed logs** are emitted only in development mode.
 * - **Recent reports** are retained in a ring buffer for debug surfaces.
 */

export enum ErrorCategory {
  Physics = 'physics',
  Material = 'material',
  WebGL = 'webgl',
  Lifecycle = 'lifecycle',
  Config = 'config',
  E2E = 'e2e',
  Query = 'query',
}

export interface ErrorReport {
  category: ErrorCategory;
  message: string;
  context?: Record<string, unknown>;
  timestamp: number;
  stack?: string;
}

interface ErrorReportingState {
  reports: ErrorReport[];
  counts: Record<ErrorCategory, number>;
  enabled: boolean;
  maxReports: number;
}

const state: ErrorReportingState = {
  reports: [],
  counts: Object.fromEntries(
    Object.values(ErrorCategory).map((c) => [c, 0]),
  ) as Record<ErrorCategory, number>,
  enabled: typeof process !== 'undefined' && process.env?.NODE_ENV !== 'production',
  maxReports: 100,
};

/**
 * Report a caught error. Always increments the counter; logs only in dev.
 */
export function reportError(
  category: ErrorCategory,
  message: string,
  context?: Record<string, unknown>,
  error?: unknown,
): void {
  state.counts[category]++;

  if (!state.enabled) return;

  const report: ErrorReport = {
    category,
    message,
    context,
    timestamp: Date.now(),
    stack: error instanceof Error ? error.stack : undefined,
  };

  state.reports.push(report);
  if (state.reports.length > state.maxReports) {
    state.reports.shift();
  }

  if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'development') {
    console.warn(`[${category}] ${message}`, context ?? '', error ?? '');
  }
}

/**
 * Report a material-related error (needsUpdate, dispose, property access).
 */
export function reportMaterialError(
  operation: string,
  materialType: string,
  error?: unknown,
): void {
  reportError(
    ErrorCategory.Material,
    `${operation} failed for ${materialType}`,
    { materialType, operation },
    error,
  );
}

/**
 * Report a physics/Rapier error (collider removal, rigid body cleanup).
 */
export function reportPhysicsError(
  operation: string,
  entityId?: number,
  error?: unknown,
): void {
  reportError(
    ErrorCategory.Physics,
    `${operation} failed`,
    { entityId, operation },
    error,
  );
}

/**
 * Report an entity lifecycle error (create, destroy, update).
 */
export function reportLifecycleError(
  phase: 'create' | 'destroy' | 'update',
  entityType: string,
  entityId?: number,
  error?: unknown,
): void {
  reportError(
    ErrorCategory.Lifecycle,
    `Entity ${phase} failed for ${entityType}`,
    { phase, entityType, entityId },
    error,
  );
}

/**
 * Report an E2E test hook error (window.__SAB methods).
 */
export function reportE2EError(
  hookName: string,
  error?: unknown,
): void {
  reportError(
    ErrorCategory.E2E,
    `E2E hook ${hookName} failed`,
    { hookName },
    error,
  );
}

/**
 * Report a query/snapshot error (query access, safe snapshot).
 */
export function reportQueryError(
  queryName: string,
  error?: unknown,
): void {
  reportError(
    ErrorCategory.Query,
    `Query ${queryName} failed`,
    { queryName },
    error,
  );
}

/**
 * Report a WebGL-related error (context, extensions, state).
 */
export function reportWebGLError(
  operation: string,
  error?: unknown,
): void {
  reportError(
    ErrorCategory.WebGL,
    `WebGL ${operation} failed`,
    { operation },
    error,
  );
}

/**
 * Report a config-related error (env parsing, query params).
 */
export function reportConfigError(
  configKey: string,
  error?: unknown,
): void {
  reportError(
    ErrorCategory.Config,
    `Config ${configKey} failed to parse`,
    { configKey },
    error,
  );
}

/**
 * Get current error counts by category.
 */
export function getErrorCounts(): Record<ErrorCategory, number> {
  return { ...state.counts };
}

/**
 * Get total error count across all categories.
 */
export function getTotalErrorCount(): number {
  return Object.values(state.counts).reduce((a, b) => a + b, 0);
}

/**
 * Get recent error reports (most recent last).
 */
export function getRecentErrors(limit = 10): ErrorReport[] {
  return state.reports.slice(-limit);
}

/**
 * Reset all error counts and clear the report buffer.
 * Primarily for testing.
 */
export function resetErrorCounts(): void {
  for (const key of Object.keys(state.counts)) {
    state.counts[key as ErrorCategory] = 0;
  }
  state.reports = [];
}

/**
 * Enable or disable detailed logging (counters always run).
 */
export function setErrorReportingEnabled(enabled: boolean): void {
  state.enabled = enabled;
}

/**
 * Check if detailed logging is enabled.
 */
export function isErrorReportingEnabled(): boolean {
  return state.enabled;
}
