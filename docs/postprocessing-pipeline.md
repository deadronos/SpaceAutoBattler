# Postprocessing pipeline

This document explains how the postprocessing pipeline is constructed and executed in this project (file: `src/components/Postprocessing.tsx`). It includes the runtime order of passes and a visual diagram of shader pass order and layer flow.

## Summary

- The runtime pipeline is assembled in `src/components/postprocessing/createComposer.ts` and uses an `EffectComposer` with up to three passes:
  1. `RenderPass(scene, camera)` — renders the main scene into the composer input.
  2. `N8AOPostPass` (optional) — half-res ambient occlusion built in `buildAmbientOcclusion.ts`; inserted between the render pass and the effect pass when AO is enabled.
  3. `EffectPass(camera, ...effects)` — a single EffectPass that contains multiple effects, composed in the specified order.

- `src/components/postprocessing/buildEffects.ts` constructs one `SelectiveBloomEffect` per configured bloom group (from `POSTPROCESSING_CONFIG.bloomGroups` and `BloomProvider`).

- When the linear-HDR color pipeline is enabled, `buildEffects` also appends a `ToneMappingEffect` and, if configured, a `VignetteEffect`, before the trailing `FXAAEffect`.

- Final order (the order effects are passed into `EffectPass`):
  - SelectiveBloomEffect(group A)
  - SelectiveBloomEffect(group B)
  - ...
  - ToneMappingEffect (linear-HDR pipeline only)
  - VignetteEffect (linear-HDR pipeline + vignette enabled only)
  - FXAAEffect

- This means: bloom effects are applied first and FXAA is appended last within the `EffectPass` (anti-aliasing the composite, including bloom halos). It is no longer the only tail effect, though — on the linear-HDR path tone mapping and vignette sit between bloom and FXAA, and the optional `N8AOPostPass` runs before the `EffectPass` entirely.

## How selective bloom is wired

- `src/renderer/bloom/BloomProvider.tsx` allocates a `Selection` per bloom group. Each `Selection` is assigned a unique render layer starting at `POSTPROCESSING_CONFIG.bloomLayerStart` (default: 11).
- Components register Object3D instances via `useBloomRegistration(ref, { group?: string, active?: boolean })`. When registered the object is added to the `Selection` and implicitly assigned the selection's layer.
- `buildEffects.ts` iterates configured group names, reads each `Selection` from the bloom context, and instantiates a `SelectiveBloomEffect(scene, camera, options)` with `bloom.selection = selection`.
- The bloom effect is configured per-group using `POSTPROCESSING_CONFIG` values (intensity, threshold, smoothing, ignoreBackground).
- Each bloom effect's `blendMode.opacity.value` is toggled to 1 or 0 depending on whether the selection is non-empty, enabling dynamic per-group toggling.

## Why FXAA is appended last

- The `EffectPass` applies effects in the order they are provided. In this project we place bloom effects first and append FXAA so that FXAA can smooth the final composite (scene + bloom + tone mapping/vignette).
- Anti-aliasing last within the _effect chain_ is generally desirable when using image-space effects like bloom that can produce soft, high-frequency glow — FXAA smooths those final pixels. Note the ambient-occlusion pass is a separate pass that runs before the `EffectPass`, so FXAA is last among the effects, not necessarily the last GPU pass.

## Mermaid diagram: shader pass order and layer flow

Below is a Mermaid diagram that visualizes the pass ordering and how `Selection` layers map to objects. It shows the composer flow from `RenderPass` through `EffectPass` and the internal order of effects.

```mermaid
flowchart TD
  subgraph Renderer
    R3F[Three Renderer (R3F)]
  end

  R3F --> Composer[EffectComposer]
  Composer --> RP[RenderPass\n(scene, camera)]
  Composer --> AO[N8AOPostPass\n(optional, half-res AO)]
  Composer --> EP[EffectPass\n(camera, effects...)]

  RP --> AO
  AO --> EP

  subgraph EffectsOrder[EffectPass effects (applied in order)]
    direction TB
    BloomA[SelectiveBloomEffect (group: engines)\nSelection Layer: 11]
    BloomB[SelectiveBloomEffect (group: projectiles)\nSelection Layer: 12]
    BloomC[SelectiveBloomEffect (group: explosions)\nSelection Layer: 13]
    Tone[ToneMappingEffect\n(linear-HDR pipeline)]
    Vignette[VignetteEffect\n(optional)]
    FXAA[FXAAEffect (final anti-aliasing)]
  end

  EP --> EffectsOrder
  EffectsOrder --> FXAA

  %% Layer allocations and object registration
  subgraph LayerAllocation[Selection layer allocation]
    direction LR
    L11[Layer 11\n-> Selection: engines]
    L12[Layer 12\n-> Selection: projectiles]
    L13[Layer 13\n-> Selection: explosions]
  end

  LayerAllocation --> BloomA
  LayerAllocation --> BloomB
  LayerAllocation --> BloomC

  %% Example objects registering
  subgraph Objects[Scene objects]
    Obj1[Ship thruster (Object3D)\nregister -> Selection(engines) -> Layer 11]
    Obj2[Projectile mesh\nregister -> Selection(projectiles) -> Layer 12]
    Obj3[Explosion sprite\nregister -> Selection(explosions) -> Layer 13]
  end

  Obj1 --> L11
  Obj2 --> L12
  Obj3 --> L13

  style Composer fill:#f8f9fa,stroke:#333,stroke-width:1px
  style RP fill:#fff6e6,stroke:#333
  style EP fill:#e6f7ff,stroke:#333
  style FXAA fill:#e6ffe6,stroke:#333
```

Notes:

- The group names and assigned layers illustrated above (engines=11, projectiles=12, explosions=13) are examples — actual group names and layer allocations come from `POSTPROCESSING_CONFIG.bloomGroups` and the runtime `BloomProvider` allocation which starts at `bloomLayerStart` (default 11) and increments per group.
- The EffectPass merges effects where possible for performance, but order is preserved functionally.

## Implementation pointers

- If you want FXAA to not soften bloom halos, try moving FXAA earlier (before bloom) or tune FXAA strength. This will make bloom stand out but may leave aliasing on thin geometry.
- For richer anti-aliasing consider SMAA or MSAA (composer multisampling) depending on visual priority and performance.

---

End of document.
