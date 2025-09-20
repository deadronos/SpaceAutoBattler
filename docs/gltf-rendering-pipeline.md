# GLTF to ShipInstancer Rendering Pipeline

This document provides a detailed explanation of the rendering pipeline that takes GLTF (`.glb`) models, processes them, and renders them efficiently using the `ShipInstancer`.

## Overview

The primary goal of this pipeline is to render large numbers of ships with high performance. It achieves this by using `THREE.InstancedMesh`, which allows the GPU to draw many copies of the same model in a single draw call. The system is designed to be data-driven, starting from a configuration file and preloading all necessary assets before they are needed for rendering.

The `assetPool` (a `Map` on the global `GameState`) is the central component that decouples the asset loading process from the rendering process.

## The Rendering Path: Step-by-Step

The pipeline can be broken down into three main phases:

### Phase 1: Configuration & Initialization

1.  **Configuration (`src/config/shipModelMap.ts`)**: The process begins here. This file maps each ship class (e.g., `'fighter'`) to its corresponding `.glb` model file.

2.  **Application Entry Point (`src/main.ts`)**: On startup, `initGame()` performs the following:
    - It checks `RendererConfig.loadGltfModels` to enable the GLTF pipeline.
    - It creates the `state.assetPool`, a `Map` that will serve as a cache for all loaded assets.
    - It triggers the preloading process by calling `preloadShipModels()` from the ship model loader.

### Phase 2: Asset Loading & Prototyping

3.  **High-Level Loader (renderer/bootloader)**: Historically this was called `src/core/shipModelLoader.ts`. In the current codebase the renderer bootstrap and small helpers in `src/utils/patchGltfLoader.ts` plus `src/assets/ships.ts` perform model mapping and loader guarding. The renderer performs preloading when `RendererConfig.loadGltfModels` is enabled.
    - It iterates through the `SHIP_MODEL_MAP`.
    - It calls a low-level loader (`loadGLTF`) for each model.
    - **Prototype Creation**: After a model is loaded, it creates a `gltfProto` object. This is a crucial step where it **traverses the GLTF scene, extracts the geometries and materials, and clones them**.
    - This prepared `gltfProto` object, containing the ready-to-use Three.js components, is stored in the `state.assetPool`.

4.  **Low-Level Loader (`src/utils/patchGltfLoader.ts`)**: The low-level loader behavior is guarded by `patchGltfLoader` which ensures the GLTF loader works across bundlers and environments. Asset URL mappings live in `src/assets/ships.ts`. Parsed asset caching is typically implemented by the renderer as a Map attached to the renderer bootstrap or to `GameState`.

### Phase 3: Rendering & Instantiation

5.  **Renderer (`src/renderer/threeRenderer.ts`)**:
    - Initializes the `shipInstancer`.
    - In its main `render()` loop, it calls `syncEntities()` to create new ship meshes and `updateTransforms()` to move existing ones.

6.  **The Handoff (`src/renderer/shipInstancer.ts`)**: This is where the loaded data is consumed.
    - When a new ship needs to be created (`syncEntities` -> `shipInstancer.allocate()`), the instancer checks if it has a "prototype" for that ship class.
    - If not, it looks in the `state.assetPool` for the `gltfProto` object.
    - It retrieves the pre-extracted geometries and materials from the `threePrototypes` property.
    - It uses these to create a new group of `THREE.InstancedMesh` objects, one for each part of the ship model.
    - It then allocates a slot in these `InstancedMesh`es for the new ship.

7.  **Per-Frame Update (`threeRenderer.ts`)**:
    - `updateTransforms()` calls `shipInstancer.updateTransform()`, which updates the transformation matrix for a specific ship instance in the `InstancedMesh` buffer.
    - The `render()` function calls `shipInstancer.sync()`, which flags the `instanceMatrix` as needing an update, signaling Three.js to upload the new transform data to the GPU.

## Data Flow Diagram

```
[shipModelMap.ts] -> [main.ts] -> [shipModelLoader.ts] -> [assetLoader.ts]
      (Config)          (Init)        (Orchestrates)         (Fetches .glb)
                                           |
                                           v
                                   [Creates gltfProto]
                                           |
                                           v
                                     [state.assetPool]  <-- Handoff Point
                                           ^
                                           |
[threeRenderer.ts] <--- [shipInstancer.ts]
 (Drives updates)      (Consumes gltfProto, creates InstancedMesh)
```

## Key Files & Concepts

- **`docs/gltf-rendering-pipeline.md`**: This file.
- **`src/config/shipModelMap.ts`**: Maps ship classes to `.glb` files. The starting point of the pipeline.
- **`src/main.ts`**: Initializes the game and kicks off the asset preloading.
-- Historically: `src/core/assetLoader.ts` and `src/core/shipModelLoader.ts` were named modules used in older layouts. Current equivalents are described above (`src/utils/patchGltfLoader.ts`, `src/assets/ships.ts`, and renderer bootstrap logic).
- **`src/renderer/shipInstancer.ts`**: The core of the instancing system. Consumes prototypes and manages `InstancedMesh`es.
- **`src/renderer/threeRenderer.ts`**: The main renderer that drives the `shipInstancer` every frame.
- **`state.assetPool`**: A `Map` that serves as the central cache and handoff point between the loading and rendering systems.
- **`gltfProto`**: The object stored in the `assetPool`. It contains the raw GLTF data and, most importantly, the pre-extracted `threePrototypes` (geometries and materials).

Related: see also docs/data-flow-diagrams.md for end-to-end flows (boot/worker, spawn, projectiles, AI, effects).
