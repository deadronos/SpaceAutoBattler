import { expect } from 'vitest';
export function expectPoolMaxFreeList(entry, max) {
    expect(entry).toBeTruthy();
    expect(Array.isArray(entry.freeList)).toBe(true);
    expect(entry.freeList.length).toBeLessThanOrEqual(max);
}
export function expectDisposedAtLeast(disposedArr, n) {
    expect(Array.isArray(disposedArr)).toBe(true);
    expect(disposedArr.length).toBeGreaterThanOrEqual(n);
}
