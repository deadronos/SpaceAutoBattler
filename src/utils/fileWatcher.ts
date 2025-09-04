// File Watcher Utility for detecting SVG file changes
import * as logger from './logger.js';
// Provides change detection for hot-reloading SVG assets

export interface FileChangeCallback {
  (filePath: string, changeType: 'modified' | 'deleted' | 'created'): void;
}

export class FileWatcher {
  private watchers = new Map<string, FileChangeCallback>();
  private pollIntervals = new Map<string, number>();
  private lastModifiedTimes = new Map<string, number>();
  private pollInterval = 1000; // Check every second
  // When true, the watcher will perform a single check at watch() time
  // and then not start continuous polling. This is safer for production
  // builds where assets are static and avoids continuous HEAD requests.
  private oneShotMode = true;

  // Watch a file for changes
  watch(filePath: string, callback: FileChangeCallback): void {
    // Stop existing watcher if any
    this.unwatch(filePath);

    // If this is a standalone inlined build and the file is an inlined SVG,
    // don't start the network polling — treat it as created and use a
    // surrogate mod-time. This avoids any HEAD requests entirely.
    try {
      const standalone = (typeof globalThis !== 'undefined' ? (globalThis as any).__STANDALONE : undefined) ||
                         (typeof window !== 'undefined' ? (window as any).__STANDALONE : undefined);
      const inlineAssets = (typeof globalThis !== 'undefined' ? (globalThis as any).__INLINE_SVG_ASSETS : undefined) ||
                           (typeof window !== 'undefined' ? (window as any).__INLINE_SVG_ASSETS : undefined);
      if (standalone && inlineAssets && typeof filePath === 'string' && filePath.endsWith('.svg')) {
        this.watchers.set(filePath, callback);
        const cleaned = filePath.split(/[?#]/)[0];
        const m = cleaned.match(/([^/]+)\.svg$/);
        const name = m ? m[1] : null;
        if (name && inlineAssets[name]) {
          // Treat as created with current time and don't start interval
          this.lastModifiedTimes.set(filePath, Date.now());
          // Notify immediately as created
          this.notifyChange(filePath, 'created');
          return;
        }
      }
    } catch { /* ignore and fall back to normal behavior */ }

    this.watchers.set(filePath, callback);

    // Get initial modification time
    this.checkFile(filePath).then(modTime => {
      if (modTime !== null) {
        this.lastModifiedTimes.set(filePath, modTime);
      }
    });

    // Start polling only when not in one-shot mode
    if (!this.oneShotMode) {
      const intervalId = setInterval(() => {
        this.checkFile(filePath);
      }, this.pollInterval) as unknown as number;

      this.pollIntervals.set(filePath, intervalId);
    }
  }

  // Stop watching a file
  unwatch(filePath: string): void {
    const intervalId = this.pollIntervals.get(filePath);
    if (intervalId) {
      clearInterval(intervalId);
      this.pollIntervals.delete(filePath);
    }

    this.watchers.delete(filePath);
    this.lastModifiedTimes.delete(filePath);
  }

  // Check if a file has changed
  private async checkFile(filePath: string): Promise<number | null> {
    try {
      const modTime = await this.getFileModificationTime(filePath);
      if (modTime === null) {
        // File doesn't exist or can't be accessed
        const lastKnownTime = this.lastModifiedTimes.get(filePath);
        if (lastKnownTime !== undefined) {
          // File was deleted
          this.notifyChange(filePath, 'deleted');
          this.unwatch(filePath);
        }
        return null;
      }

      const lastModTime = this.lastModifiedTimes.get(filePath);
      if (lastModTime === undefined) {
        // First time seeing this file
        this.lastModifiedTimes.set(filePath, modTime);
        this.notifyChange(filePath, 'created');
      } else if (modTime > lastModTime) {
        // File was modified
        this.lastModifiedTimes.set(filePath, modTime);
        this.notifyChange(filePath, 'modified');
      }

      return modTime;
    } catch (_error) { void _error;// Use centralized logger
      try { logger.warn(`[FileWatcher] Error checking file ${filePath}:`, _error); } catch (_e) { void _e; void _e; }
      return null;
    }
  }

  // Get file modification time
  private async getFileModificationTime(filePath: string): Promise<number | null> {
    try {
      // If the app has inlined SVG assets (standalone), skip network HEAD checks
      // for those assets to avoid aborted HEAD requests in the browser.
      try {
    logger.debug && logger.debug('[FileWatcher] getFileModificationTime called for', filePath);
        // If the runtime was produced by the standalone inliner, honor the
        // explicit standalone flag and short-circuit any network HEAD checks
        // for SVG assets. This prevents browsers from issuing transient HEAD
        // requests (which can be aborted) when assets are embedded.
        const standalone = (typeof globalThis !== 'undefined' ? (globalThis as any).__STANDALONE : undefined) ||
                           (typeof window !== 'undefined' ? (window as any).__STANDALONE : undefined);
        const inlineAssets = (typeof globalThis !== 'undefined' ? (globalThis as any).__INLINE_SVG_ASSETS : undefined) ||
                             (typeof window !== 'undefined' ? (window as any).__INLINE_SVG_ASSETS : undefined);
        if (standalone && inlineAssets && typeof filePath === 'string' && filePath.endsWith('.svg')) {
          const cleaned = filePath.split(/[?#]/)[0];
          const m = cleaned.match(/([^/]+)\.svg$/);
          const name = m ? m[1] : null;
          // Diagnostic: log standalone and presence in inlineAssets
          try { logger.debug && logger.debug('[FileWatcher] standalone=', standalone, 'inlineHasKeys=', Object.keys(inlineAssets).slice(0,5)); } catch (_) { }
          try { logger.debug && logger.debug('[FileWatcher] checking asset', name, 'present=', !!(name && inlineAssets && inlineAssets[name])); } catch (_) { }
          if (name && inlineAssets[name]) {
            logger.debug && logger.debug('[FileWatcher] Short-circuited HEAD for inlined asset ' + name + ' path ' + filePath);
            return Date.now();
          }
        }
      } catch { }
    logger.debug && logger.debug('[FileWatcher] Issuing HEAD for', filePath);
      // Try HEAD request to get last-modified header
      const response = await fetch(filePath, {
        method: 'HEAD',
        cache: 'no-cache' // Ensure we don't get cached response
      });

      if (!response.ok) {
        return null;
      }

      const lastModified = response.headers.get('last-modified');
      if (lastModified) {
        return new Date(lastModified).getTime();
      }

      // Fallback: try to get etag or content-length change
  const etag = response.headers.get('etag');
  const _contentLength = response.headers.get('content-length');

      if (etag) {
        // Use etag as a simple change indicator
        return etag.split('').reduce((hash, char) => {
          return ((hash << 5) - hash) + char.charCodeAt(0);
        }, 0);
      }

      // Last resort: use current time (not ideal but prevents errors)
      return Date.now();

    } catch (_e) { void _e; void _e; return null; }
  }

  // Notify callback about file change
  private notifyChange(filePath: string, changeType: 'modified' | 'deleted' | 'created'): void {
    const callback = this.watchers.get(filePath);
    if (callback) {
      try {
        callback(filePath, changeType);
      } catch (_error) { void _error;try { logger.error(`[FileWatcher] Error in change callback for ${filePath}:`, _error); } catch (_e) { void _e; void _e; }
      }
    }
  }

  // Watch multiple files
  watchMultiple(filePaths: string[], callback: FileChangeCallback): void {
    filePaths.forEach(filePath => this.watch(filePath, callback));
  }

  // Stop watching all files
  unwatchAll(): void {
    const filePaths = Array.from(this.watchers.keys());
    filePaths.forEach(filePath => this.unwatch(filePath));
  }

  // Get list of watched files
  getWatchedFiles(): string[] {
    return Array.from(this.watchers.keys());
  }

  // Set poll interval for all watchers
  setPollInterval(intervalMs: number): void {
    this.pollInterval = Math.max(100, intervalMs); // Minimum 100ms

    // Restart all watchers with new interval
    const filePaths = Array.from(this.watchers.keys());
    const callbacks = new Map(this.watchers);

    this.unwatchAll();

    filePaths.forEach(filePath => {
      const callback = callbacks.get(filePath);
      if (callback) {
        this.watch(filePath, callback);
      }
    });
  }

  // Toggle one-shot mode. Default is true (check once at watch time).
  // Call setOneShotMode(false) to enable continuous polling behavior.
  setOneShotMode(oneShot: boolean) {
    this.oneShotMode = !!oneShot;

    // If switching from one-shot to continuous, restart watchers
    if (!this.oneShotMode) {
      const filePaths = Array.from(this.watchers.keys());
      filePaths.forEach(fp => {
        // restart watch to ensure interval is set
        const cb = this.watchers.get(fp);
        if (cb) {
          this.unwatch(fp);
          this.watch(fp, cb);
        }
      });
    } else {
      // If switching to one-shot, clear all intervals
      this.pollIntervals.forEach((id, fp) => {
        clearInterval(id);
        this.pollIntervals.delete(fp);
      });
    }
  }

  // Force check all watched files immediately
  async checkAllFiles(): Promise<void> {
    const filePaths = Array.from(this.watchers.keys());
    await Promise.all(filePaths.map(filePath => this.checkFile(filePath)));
  }
}

// Global file watcher instance
let globalFileWatcher: FileWatcher | null = null;

export function getFileWatcher(): FileWatcher {
  if (!globalFileWatcher) {
    globalFileWatcher = new FileWatcher();
  }
  return globalFileWatcher;
}

// Convenience function to watch SVG files
export function watchSVGFiles(svgUrls: string[], callback: FileChangeCallback): void {
  getFileWatcher().watchMultiple(svgUrls, callback);
}

// Convenience function to unwatch SVG files
export function unwatchSVGFiles(svgUrls: string[]): void {
  const watcher = getFileWatcher();
  svgUrls.forEach(url => watcher.unwatch(url));
}

