# Memory: src/renderer/shipInstancer.ts

Purpose:

- Instanced rendering manager for ships. Provides prototype registration, per-class/team grouping, allocation/freeing of instance slots, transform updates, bounds computation for culling, and prototype metadata inspection for tests.

Key concepts and responsibilities:

- ShipInstancerImpl: core implementation that holds groups keyed by "class_team" and manages per-group instanced meshes (multiple submeshes).
- Prototype registry: `registerPrototype(className, geometries, materials)` and `updatePrototype(...)` allow dynamic replacement of prototype geometry/materials and in-place updates of groups.
- GroupData: stores meshes (InstancedMesh[]), capacity, freeIndices, maps id<->index, per-instance positions, prototype metadata, and parentGroup for scene insertion.
- Allocation API: `allocate(shipId, className, team, state?)` tries to build prototypes from state.assetPool (GLTF prototypes or rasterized SVG assets) when available, registers prototypes, creates groups, and assigns instance slots. `free(shipId)` returns slot to freeIndices and clears instance matrix.
- Transform updates: `updateTransform(shipId, pos, quat, scale)` writes instance matrices and updates tracked positions; includes defensive checks for non-finite inputs.
- Growth: `growGroup` increases instanced capacity and copies existing matrices/instanceColor attributes.
- Culling & sync: `cull(camera)` computes coarse bounding spheres and (currently conservative) sets group visibility; `sync()` flips instanceMatrix.needsUpdate for changed groups.
- Debugging helpers: `debugDumpSample`, `getPrototypeInfo`, `getPrototypeMetadata`, and `getStats` for test inspection.
- Lifecycle: `init(scene, parent)` attaches existing groups to the provided parent and initializes fallback geometry/materials.

Integration points and notes:

- Uses `state.assetPool` to look for GLTF-derived `threePrototypes` or rasterized SVG ImageBitmap assets to construct prototype geometries/materials when allocating.
- Exposes `shipInstancer` facade exported for use by renderer/meshFactory/threeRenderer.
- Defensive, robust handling: many try/catch guards around asset extraction and prototype registration to avoid breaking instancing when assets fail or are missing.
- Frustum culling currently simplified: groups with ships are kept visible to avoid hiding ships erroneously; TODO notes indicate restoration of correct frustum-sphere culling logic.
- Supports per-instance color via `instanceColor` InstancedBufferAttribute and uses `applyInstanceColorPatch` to enable vertexColors on materials for shader support.

Edge cases and behavior:

- If prototype registration occurs after init(), the instancer marks itself ready and executes ready callbacks.
- Allocation attempts to use GLTF prototypes first, then rasterized SVG fallbacks, then geometric fallbacks.
- Growing a group preserves per-instance matrices and color attributes where possible.

Tags: renderer, instancing, ship, prototypes, assetPool, culling
