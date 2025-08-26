import { describe, it, expect, beforeEach } from 'vitest'
import { makeInitialState } from '../../src/entities'
import { acquireTexture, releaseTexture, acquireSprite, releaseSprite, acquireEffect, releaseEffect, createPooledFactory, makePooled } from '../../src/pools'
import type { GameState } from '../../src/types'
import { makeGLStub, makeSpriteFactory } from './utils/glStub'
import { expectPoolMaxFreeList, expectDisposedAtLeast } from './utils/poolAssert'

describe('asset pool integration (texture/sprite/effect)', () => {
  let state: GameState
  beforeEach(() => { state = makeInitialState() })

  it('textures and sprites share per-key PoolEntry semantics and disposers', () => {
    const gl = makeGLStub()
    const sprites = makeSpriteFactory()

    state.assetPool.config.texturePoolSize = 2
    state.assetPool.config.textureOverflowStrategy = 'discard-oldest'
    state.assetPool.config.spritePoolSize = 2
    state.assetPool.config.spriteOverflowStrategy = 'discard-oldest'

    const texDisposed: any[] = []
    const spriteDisposed: any[] = []

    // Acquire and release textures
    const t1 = acquireTexture(state, 'texA', () => gl.createTexture())
    const t2 = acquireTexture(state, 'texA', () => gl.createTexture())
    const t3 = acquireTexture(state, 'texA', () => gl.createTexture())
    releaseTexture(state, 'texA', t1, (t) => { texDisposed.push(t); gl.deleteTexture(t) })
    releaseTexture(state, 'texA', t2, (t) => { texDisposed.push(t); gl.deleteTexture(t) })
    releaseTexture(state, 'texA', t3, (t) => { texDisposed.push(t); gl.deleteTexture(t) })

  const texEntry = state.assetPool.textures.get('texA')!
  expectPoolMaxFreeList(texEntry, 2)
  expectDisposedAtLeast(texDisposed, 1)

    // Acquire and release sprites
    const s1 = acquireSprite(state, 'spriteX', () => sprites.create())
    const s2 = acquireSprite(state, 'spriteX', () => sprites.create())
    const s3 = acquireSprite(state, 'spriteX', () => sprites.create())
    releaseSprite(state, 'spriteX', s1, (s) => { spriteDisposed.push(s); sprites.delete(s) })
    releaseSprite(state, 'spriteX', s2, (s) => { spriteDisposed.push(s); sprites.delete(s) })
    releaseSprite(state, 'spriteX', s3, (s) => { spriteDisposed.push(s); sprites.delete(s) })

  const spriteEntry = state.assetPool.sprites.get('spriteX')!
  expectPoolMaxFreeList(spriteEntry, 2)
  expectDisposedAtLeast(spriteDisposed, 1)
  })

  it('effects pooling respects config and reset semantics', () => {
    const gl = makeGLStub()
    state.assetPool.config.effectPoolSize = 2
    state.assetPool.config.effectOverflowStrategy = 'discard-oldest'

    const factory = createPooledFactory(() => ({ x: 0, alive: true }), (o: any, init?: any) => { o.x = init?.x ?? 0; o.alive = true })
    const objs: any[] = []
    for (let i = 0; i < 4; ++i) objs.push(acquireEffect(state, 'fx', () => makePooled(factory.create(), factory.reset), { x: i }))
    for (const o of objs) releaseEffect(state, 'fx', o)
    const entry = state.assetPool.effects.get('fx')!
    expect(entry.freeList.length).toBeLessThanOrEqual(2)
  })
})
