// File Watcher Utility for detecting SVG file changes
// Provides change detection for hot-reloading SVG assets

export interface FileChangeCallback {
  (filePath: string, changeType: 'modified' | 'deleted' | 'created'): void;
}

export class FileWatcher {
  private watchers = new Map<string, FileChangeCallback>();
  private pollIntervals = new Map<string, number>();
  private lastModifiedTimes = new Map<string, number>();
  private pollInterval = 1000; // Check every second

  // Watch a file for changes
  watch(filePath: string, callback: FileChangeCallback): void {
    // Stop existing watcher if any
    this.unwatch(filePath);

    this.watchers.set(filePath, callback);

    // Get initial modification time
    this.checkFile(filePath).then(modTime => {
      if (modTime !== null) {
        this.lastModifiedTimes.set(filePath, modTime);
      }
    });

    // Start polling
    const intervalId = setInterval(() => {
      this.checkFile(filePath);
    }, this.pollInterval) as unknown as number;

    this.pollIntervals.set(filePath, intervalId);
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
    } catch (error) {
      console.warn(`[FileWatcher] Error checking file ${filePath}:`, error);
      return null;
    }
  }

  // Get file modification time
  private async getFileModificationTime(filePath: string): Promise<number | null> {
    try {
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
      const contentLength = response.headers.get('content-length');

      if (etag) {
        // Use etag as a simple change indicator
        return etag.split('').reduce((hash, char) => {
          return ((hash << 5) - hash) + char.charCodeAt(0);
        }, 0);
      }

      // Last resort: use current time (not ideal but prevents errors)
      return Date.now();

    } catch (error) {
      // File doesn't exist or can't be accessed
      return null;
    }
  }

  // Notify callback about file change
  private notifyChange(filePath: string, changeType: 'modified' | 'deleted' | 'created'): void {
    const callback = this.watchers.get(filePath);
    if (callback) {
      try {
        callback(filePath, changeType);
      } catch (error) {
        console.error(`[FileWatcher] Error in change callback for ${filePath}:`, error);
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