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
  // and then not start continuous polling. Safe for production builds.
  private oneShotMode = true;

  // Watch a file for changes
  watch(filePath: string, callback: FileChangeCallback): void {
    // Stop existing watcher if any
    this.unwatch(filePath);

    // Short-circuit for standalone inlined builds: treat inlined SVGs as created
    try {
      const g = typeof globalThis !== 'undefined' ? (globalThis as unknown as Record<string, unknown>) : undefined;
      const w = typeof window !== 'undefined' ? (window as unknown as Record<string, unknown>) : undefined;
      const standalone = Boolean((g && g['__STANDALONE']) || (w && w['__STANDALONE']));
      const inlineAssets = (g && (g['__INLINE_SVG_ASSETS'] as Record<string, string> | undefined)) ||
        (w && (w['__INLINE_SVG_ASSETS'] as Record<string, string> | undefined));

      if (standalone && inlineAssets && typeof filePath === 'string' && filePath.endsWith('.svg')) {
        this.watchers.set(filePath, callback);
        const cleaned = filePath.split(/[?#]/)[0];
        const m = cleaned.match(/([^/]+)\.svg$/);
        const name = m ? m[1] : null;
        if (name && inlineAssets[name]) {
          this.lastModifiedTimes.set(filePath, Date.now());
          this.notifyChange(filePath, 'created');
          return;
        }
      }
    } catch (_e) {
      void _e; // ignore and fall back to normal behavior
    }

    this.watchers.set(filePath, callback);

    // Get initial modification time
    void this.checkFile(filePath).then((modTime) => {
      if (modTime !== null) {
        this.lastModifiedTimes.set(filePath, modTime);
      }
    });

    // Start polling only when not in one-shot mode
    if (!this.oneShotMode) {
      const intervalId = setInterval(() => {
        void this.checkFile(filePath);
      }, this.pollInterval) as unknown as number;

      this.pollIntervals.set(filePath, intervalId);
    }
  }

  // Watch multiple files at once
  watchMultiple(filePaths: string[], callback: FileChangeCallback): void {
    filePaths.forEach((p) => this.watch(p, callback));
  }

  // Stop watching a file
  unwatch(filePath: string): void {
    const intervalId = this.pollIntervals.get(filePath);
    if (intervalId !== undefined) {
      clearInterval(intervalId);
      this.pollIntervals.delete(filePath);
    }

    this.watchers.delete(filePath);
    this.lastModifiedTimes.delete(filePath);
  }

  // Notify registered callback (if any)
  private notifyChange(filePath: string, changeType: 'modified' | 'deleted' | 'created'): void {
    const cb = this.watchers.get(filePath);
    if (cb) {
      try {
        cb(filePath, changeType);
      } catch (_e) {
        void _e;
      }
    }
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
    } catch (_error) {
      void _error; // Use centralized logger if available
      try {
        logger.warn && logger.warn(`[FileWatcher] Error checking file ${filePath}:`, _error);
      } catch (_e) {
        void _e;
      }
      return null;
    }
  }

  // Get file modification time using HEAD request; fallback to etag hashing
  private async getFileModificationTime(filePath: string): Promise<number | null> {
    try {
      // Short-circuit for standalone inlined builds
      try {
        const g = typeof globalThis !== 'undefined' ? (globalThis as unknown as Record<string, unknown>) : undefined;
        const w = typeof window !== 'undefined' ? (window as unknown as Record<string, unknown>) : undefined;
        const standalone = Boolean((g && g['__STANDALONE']) || (w && w['__STANDALONE']));
        const inlineAssets = (g && (g['__INLINE_SVG_ASSETS'] as Record<string, string> | undefined)) ||
          (w && (w['__INLINE_SVG_ASSETS'] as Record<string, string> | undefined));

        if (standalone && inlineAssets && typeof filePath === 'string' && filePath.endsWith('.svg')) {
          const cleaned = filePath.split(/[?#]/)[0];
          const m = cleaned.match(/([^/]+)\.svg$/);
          const name = m ? m[1] : null;
          if (name && inlineAssets[name]) {
            return Date.now();
          }
        }
      } catch (_e) {
        void _e;
      }

      const response = await fetch(filePath, {
        method: 'HEAD',
        cache: 'no-cache',
      });

      if (!response.ok) {
        return null;
      }

      const lastModified = response.headers.get('last-modified');
      if (lastModified) {
        const parsed = Date.parse(lastModified);
        if (!Number.isNaN(parsed)) return parsed;
      }

      const etag = response.headers.get('etag');
      if (etag) {
        // Stable hash from etag string
        let hash = 0;
        for (let i = 0; i < etag.length; i++) {
          const ch = etag.charCodeAt(i);
          hash = ((hash << 5) - hash) + ch;
          // Force to 32-bit int
          hash |= 0;
        }
        return hash;
      }

      // Last resort: use current time (not ideal but prevents errors)
      return Date.now();
    } catch (_e) {
      void _e;
      return null;
    }
  }

  // Force check all watched files immediately
  async checkAllFiles(): Promise<void> {
    const filePaths = Array.from(this.watchers.keys());
    await Promise.all(filePaths.map((filePath) => this.checkFile(filePath)));
  }

  // Return list of currently watched files (for testing and inspection)
  getWatchedFiles(): string[] {
    return Array.from(this.watchers.keys());
  }

  // Stop watching all files and clear internal state
  unwatchAll(): void {
    for (const intervalId of this.pollIntervals.values()) {
      clearInterval(intervalId as unknown as number);
    }
    this.pollIntervals.clear();
    this.watchers.clear();
    this.lastModifiedTimes.clear();
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
  svgUrls.forEach((url) => watcher.unwatch(url));
}
