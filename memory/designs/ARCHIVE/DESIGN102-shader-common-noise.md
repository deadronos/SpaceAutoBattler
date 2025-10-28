# DESIGN102 — Shared GLSL Common (noise/hash/utilities)

**Status:** Proposed
**Created:** 2025-10-27

## Overview

Centralize commonly used GLSL helper functions (hash, snoise, small utility functions) into a single `common.glsl` snippet that shader modules can include or that can be programmatically injected into shader strings before compilation.

## Motivation

Several shader files reimplement the same hash and noise utilities (`snoise`, `hash`, fract(sin(...)) patterns) resulting in duplication across the shader sources (`shieldHexShader.tsx`, `starDisk.fragment.glsl`, `mainsequencestar.glsl`, etc.). Centralizing reduces maintenance, keeps visuals consistent and makes it simpler to optimize or swap the implementation.

## Requirements (EARS)

1. WHEN a shader is compiled, THE BUILD/loader or runtime shall ensure `common.glsl` is prepended so functions are available [Acceptance: unit/visual tests comparing pre/post refactor for parity].

2. THE common chunk shall provide `hash(vec2)`, `snoise(vec3, float)`, and any small helper macros used across shaders.

3. THE solution shall support two integration modes: (a) build-time include via loader or (b) runtime string prepend via `src/renderer/shaders/index.ts` for environments without glsl includes.

## API Proposal

- `src/renderer/shaders/common.glsl` — the GLSL chunk
- `src/renderer/shaders/index.ts` — export `COMMON_GLSL: string` for runtime injection

Integration modes:
- If `glsl-loader` supports `#include`, update shader sources to `#include "common.glsl"` and configure loader to resolve includes to `src/renderer/shaders/common.glsl`.
- Else, modify shader import code paths to prepend `COMMON_GLSL` before passing to `ShaderMaterial` or other compile step.

## Migration Plan

1. Create `common.glsl` with canonical implementations extracted from current shaders.
2. Add `src/renderer/shaders/index.ts` exporting the string constant.
3. Update one shader (`starDisk.fragment.glsl`) to use the common chunk via runtime injection and verify visual parity.
4. Replace other shaders incrementally.

## Testing

- Visual smoke tests before/after for `star disk` and `shield` shaders.
- Unit tests to assert that `COMMON_GLSL` provides `hash` and `snoise` symbols (string presence) and that concatenation results in compileable shader string.

## Risks & Notes

- Minor numeric differences might arise if implementations aren't identical; ensure seeded randomness and constants match.
- If the project uses tooling that expects individual GLSL files, prefer loader includes; otherwise runtime injection is simplest.

