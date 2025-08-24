import { expect } from 'vitest'

export function expectPoolMaxFreeList(entry: any, max: number) {
  expect(entry).toBeTruthy()
  expect(Array.isArray(entry.freeList)).toBe(true)
  expect(entry.freeList.length).toBeLessThanOrEqual(max)
}

export function expectDisposedAtLeast(disposedArr: any[], n: number) {
  expect(Array.isArray(disposedArr)).toBe(true)
  expect(disposedArr.length).toBeGreaterThanOrEqual(n)
}
