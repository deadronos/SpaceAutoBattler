import {
  ErrorCategory,
  getErrorCounts,
  getRecentErrors,
  getTotalErrorCount,
  reportError,
  resetErrorCounts,
  setErrorReportingEnabled,
  type ErrorReport,
} from '../utils/errorReporting.js';

export type GameErrorSeverity = 'recoverable' | 'fatal';

export interface GameErrorOptions {
  source: string;
  code: string;
  context?: Record<string, unknown>;
  severity?: GameErrorSeverity;
}

export function reportGameError(
  category: ErrorCategory,
  message: string,
  options: GameErrorOptions,
  error?: unknown,
): void {
  const severity = options.severity ?? 'recoverable';
  reportError(
    category,
    message,
    {
      ...options.context,
      code: options.code,
      fatal: severity === 'fatal',
      severity,
      source: options.source,
    },
    error,
  );
}

export function reportRecoverableGameError(
  category: ErrorCategory,
  message: string,
  options: Omit<GameErrorOptions, 'severity'>,
  error?: unknown,
): void {
  reportGameError(category, message, { ...options, severity: 'recoverable' }, error);
}

export function reportFatalGameError(
  category: ErrorCategory,
  message: string,
  options: Omit<GameErrorOptions, 'severity'>,
  error?: unknown,
): void {
  reportGameError(category, message, { ...options, severity: 'fatal' }, error);
}

export function getGameErrors(limit = 10): ErrorReport[] {
  return getRecentErrors(limit);
}

export {
  ErrorCategory,
  getErrorCounts as getGameErrorCounts,
  getTotalErrorCount as getGameErrorCount,
  resetErrorCounts as resetGameErrorReporting,
  setErrorReportingEnabled as setGameErrorReportingEnabled,
};

