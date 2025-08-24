# Asset Pooling (GameState.assetPool)

## Overview

This document describes the canonical `GameState.assetPool` API, pooling strategies, and migration steps for moving existing code to use the pool.

## Data shape

GameState.assetPool structure (partial):

- textures: Map<string, WebGLTexture[]>
- sprites: Map<string, any[]>
- effects: Map<string, any[]>
- counts: { textures: Map<string, number>, sprites: Map<string, number>, effects: Map<string, number> }
- config: {
  texturePoolSize: number,
  spritePoolSize: number,
  effectPoolSize: number,
  textureOverflowStrategy?: 'discard-oldest'|'grow'|'error',
  spriteOverflowStrategy?: 'discard-oldest'|'grow'|'error',
  effectOverflowStrategy?: 'discard-oldest'|'grow'|'error',
}

## API

The entities module exports helper functions:

- acquireTexture(state, key, createFn): WebGLTexture
- releaseTexture(state, key, tex, disposeFn?)
- acquireSprite(state, key, createFn)
- releaseSprite(state, key, sprite, disposeFn?)
- acquireEffect(state, key, createFn)
- releaseEffect(state, key, effect, disposeFn?)

## Notes and behavior

- acquire* prefers an object from the free list for `key`. If none free, it will create one using `createFn` subject to pool capacity.

- release* places object back on free list; if the free list grows beyond configured capacity and the configured strategy is `discard-oldest`, the pool will call the optional `disposeFn` for discarded objects and decrement allocation counts.
- Strategies
  - discard-oldest (default): Keep most-recently released resources; dispose oldest when trimming.
  - grow: Allow allocation beyond configured size (no trimming).
  - error: Throw on acquire when exhausted.

## Migration steps

1. Replace ad-hoc pools with `acquire*`/`release*`.

2. For GL textures, pass a disposeFn that calls `gl.deleteTexture(tex)` when releasing into the pool so the pool can free GL resources on trim.
3. For simulation-only transient objects (bullets/particles), decide whether to keep manager-local pools or move them into `GameState.assetPool.effects`.

## Threading

Pools are in-memory and not thread-safe. If simulation runs in a worker and the renderer runs on the main thread, keep GL resources and their pool on the main thread. Exchange serializable tokens between threads and lease resources through a message protocol.

## Testing guidance

- Unit tests should validate reuse, double-free prevention, trimming and disposer invocation, and behavior under different overflow strategies.

- Add stress tests simulating high churn and assert pool size stability.
