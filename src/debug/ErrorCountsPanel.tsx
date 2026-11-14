/**
 * Debug panel component that displays error counts by category.
 *
 * Only renders when there are errors to display. Intended for development
 * use to provide visibility into suppressed errors without cluttering the UI.
 */

import React, { useState } from 'react';
import { getErrorCounts, getTotalErrorCount, getRecentErrors } from '../utils/errorReporting.js';
import { useInterval } from '../hooks/useInterval.js';
import './debugPanel.css';

interface ErrorCountsPanelProps {
  /** Refresh interval in milliseconds (default: 2000) */
  refreshInterval?: number;
  /** Whether to show recent error details on expand */
  showDetails?: boolean;
}

export function ErrorCountsPanel({
  refreshInterval = 2000,
  showDetails = true,
}: ErrorCountsPanelProps): React.ReactElement | null {
  const [, setRefreshTick] = useState(0);
  const [expanded, setExpanded] = useState(false);

  useInterval(() => setRefreshTick((v) => v + 1), refreshInterval);

  const total = getTotalErrorCount();
  if (total === 0) return null;

  const counts = getErrorCounts();
  const recentErrors = expanded && showDetails ? getRecentErrors(10) : [];
  const nonZeroCounts = Object.entries(counts).filter(([, v]) => v > 0);

  return (
    <div className="error-counts-panel">
      <div
        className="error-counts-header"
        onClick={() => setExpanded(!expanded)}
        role="button"
        tabIndex={0}
        aria-expanded={expanded}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setExpanded((v) => !v);
          }
        }}
      >
        <span className="error-counts-title">⚠️ Suppressed Errors: {total}</span>
        <span className="error-counts-toggle">{expanded ? '▼' : '▶'}</span>
      </div>

      {expanded && (
        <div className="error-counts-body">
          <div className="error-counts-summary">
            {nonZeroCounts.map(([category, count]) => (
              <div key={category} className="error-count-row">
                <span className="error-category">{category}</span>
                <span className="error-count">{count}</span>
              </div>
            ))}
          </div>

          {showDetails && recentErrors.length > 0 && (
            <div className="error-details">
              <div className="error-details-title">Recent Errors:</div>
              {recentErrors.map((report, idx) => (
                <div key={idx} className="error-detail-row">
                  <span className="error-detail-category">[{report.category}]</span>
                  <span className="error-detail-message">{report.message}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default ErrorCountsPanel;
