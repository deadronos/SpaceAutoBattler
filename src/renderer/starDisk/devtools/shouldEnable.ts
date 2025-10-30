export const shouldEnableStarDiskDevHelpers = (): boolean => {
  if (typeof window !== 'undefined') {
    try {
      if (/[?&]copilot_debug=1/.test(window.location.search)) {
        return true;
      }
    } catch {
      // Ignore URL parsing failures
    }
  }
  return process.env.NODE_ENV !== 'production';
};
