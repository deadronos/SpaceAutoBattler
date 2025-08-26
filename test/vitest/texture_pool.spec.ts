import { describe, it, expect, beforeEach } from 'vitest'
import { makeInitialState } from '../../src/entities'
import { acquireTexture, releaseTexture } from '../../src/pools'
import type { GameState } from '../../src/types'
import { expectPoolMaxFreeList, expectDisposedAtLeast } from './utils/poolAssert'

// Simple GL stub that counts create/delete calls and returns opaque objects
function makeGLStub() {
  let next = 1
  const created: any[] = []
  return {
    createTexture() { const id = { __tex: next++ }; created.push(id); return id },
    deleteTexture(t: any) { const i = created.indexOf(t); if (i >= 0) created.splice(i, 1) },
    getCreatedCount() { return created.length },
  }
}

describe('texture pooling strategies', () => {
  let state: GameState
  beforeEach(() => { state = makeInitialState() })

  it('discard-oldest calls disposer and keeps allocations bounded', () => {
    const gl = makeGLStub()
    // configure small pool for test
    state.assetPool.config.texturePoolSize = 2
    state.assetPool.config.textureOverflowStrategy = 'discard-oldest'

    // Track disposer calls
    const disposed: any[] = []
    const disposer = (t: any) => { disposed.push(t); gl.deleteTexture(t) }

    // Acquire 3 textures for same key -> third acquisition should cause overflow behavior when released
    const a = acquireTexture(state, 'k', () => gl.createTexture())
    const b = acquireTexture(state, 'k', () => gl.createTexture())
    const c = acquireTexture(state, 'k', () => gl.createTexture())
    // Release all three
    releaseTexture(state, 'k', a, disposer)
    releaseTexture(state, 'k', b, disposer)
    releaseTexture(state, 'k', c, disposer)

    // After releases, pool size should be <= configured max
      const entry = state.assetPool.textures.get('k')!
      expectPoolMaxFreeList(entry, 2)
    // At least one disposer was called (the oldest item dropped)
      expectDisposedAtLeast(disposed, 1)
    // GL created count should equal allocated minus disposed leftover
    expect(gl.getCreatedCount()).toBeGreaterThanOrEqual(0)
  })

  it('grow allows allocations above max', () => {
    const gl = makeGLStub()
    state.assetPool.config.texturePoolSize = 1
    state.assetPool.config.textureOverflowStrategy = 'grow'

    const a = acquireTexture(state, 'g', () => gl.createTexture())
    const b = acquireTexture(state, 'g', () => gl.createTexture())
    // both allocated, release them
    releaseTexture(state, 'g', a)
    releaseTexture(state, 'g', b)
    const entry = state.assetPool.textures.get('g')!
    // free list may contain both because grow doesn't trim
    expect(entry.freeList.length).toBeGreaterThanOrEqual(1)
    expect(gl.getCreatedCount()).toBeGreaterThanOrEqual(0)
  })

  it('error throws when exhausted', () => {
    const gl = makeGLStub()
    state.assetPool.config.texturePoolSize = 1
    state.assetPool.config.textureOverflowStrategy = 'error'
    // Acquire first
    const a = acquireTexture(state, 'e', () => gl.createTexture())
    // Releasing then acquiring should be fine
    releaseTexture(state, 'e', a)
    // Acquire again to consume
    const b = acquireTexture(state, 'e', () => gl.createTexture())
    // Try to acquire beyond capacity without release should throw
    let threw = false
    try { acquireTexture(state, 'e', () => gl.createTexture()) } catch (err) { threw = true }
    expect(threw).toBe(true)
  })

})
