# Memory: src/renderer/meshFactory.ts

Purpose:
- Mesh factory and pooling helpers for ships, bullets, and UI elements (health bars/billboards). Extracted responsibilities from threeRenderer to keep SRP.

Key responsibilities:
- createMeshFactoryState(): builds MeshFactoryState containing pooled billboard ShaderMaterials and GPU billboarding flag.
- createShipMesh(ship, state, shipsGroup, shipMeshes): returns a placeholder mesh immediately, attempts to rasterize SVG (or use GLTF prototypes) asynchronously, registers instancer prototypes and migrates ships to instanced meshes when possible, otherwise replaces placeholder with a full textured mesh.
- registerPrototypesFromPool(state): scans state.assetPool for glTF-derived threePrototypes or rasterized SVG ImageBitmap assets and registers prototypes with shipInstancer for efficient instancing.
- createBulletMesh(bullet): small sphere mesh for bullets with defensive position checks.
- createHealthBarMesh(ship, factoryState) / updateHealthBarMesh(ship, barGroup): create and update health/shield bar billboards, using pooled GPU billboard ShaderMaterials when available and falling back to MeshBasicMaterial.
- getPooledBillboardMaterial(color, alpha, factoryState): shader-based quad material keyed by color+alpha; factory caches materials in a pool to avoid re-allocations.
- disposeMeshFactory(factoryState): disposes pooled materials and clears the pool.

Integration points and notes:
- Uses `shipInstancer` to register prototypes / allocate instances when SVG or GLTF assets are ready.
- Reads and writes `state.assetPool` for preloaded ImageBitmap or glTF prototypes.
- Uses `RendererConfig` and `ShipVisualConfig` for dimensions and enabling/disabling subsystems (GLTF vs SVG, instancing flags).
- Health bar implementation uses a small billboard shader that reads camera right/up vectors and a uniform color; materials are pooled by `billboardPoolKey`.
- Includes defensive logging for invalid inputs and falls back gracefully when assets fail to load.

Edge cases:
- If instancing is enabled and allocate() succeeds, placeholder meshes are removed and shipMeshes map is populated with an empty Object3D to represent the instanced ship.
- If SVG subsystem is disabled, rasterization is skipped and placeholders remain.
- Methods make best-effort uses of assetPool and wrap risky operations with try/catch to avoid breaking render startup.

Tags: renderer, meshFactory, ship, healthbar, instancing, assetPool, billboard
