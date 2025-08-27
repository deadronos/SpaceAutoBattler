# three.js migration plan

This document summarizes the migration plan for moving SpaceAutoBattler from the existing 2D WebGL renderer to a 3D three.js-based renderer and simulation.

Goals
- Move renderer to three.js and run simulation in 3D space.
- Keep canonical `GameState` as the single source of truth.
- Target 60Hz deterministic simulation and efficient rendering (instancing, LOD).
- Support asset reuse: rasterized SVGs, extruded SVGs, parametric procedural meshes and glTF.

Key artifacts added in this branch
- `src/rendererContract.ts` — adapter interface for renderers.
- `src/threeRenderer.ts` — a minimal three.js renderer skeleton (instancing hooks + SVG extrusion utility).
- `src/utils/wrapping.ts` — 3D wrapping utilities and distance computation for periodic bounds.
- `src/simulate/step3d.ts` — fixed-step 60Hz simulation step scaffold with basic integration and naive collision separation.
- `src/types/threeTypes.ts` — 3D-typed `Ship3D` and `GameState3D` definitions.

High level tasks
1. Wire `ThreeRenderer` into `GameManager` via `RendererContract`.
2. Migrate `GameState` consumers to 3D-aware fields (position/velocity/rotation/quaternion).
3. Implement asset pipeline for SVG extrusion & rasterization.
4. Implement instanced mesh archetypes for ship types.
5. Add ghost-instance creation for wrapped rendering when ships are near bounds.
6. Replace naive O(n^2) collision with spatial partitioning (uniform grid or octree).
7. Add tests for wrapping, deterministic sim, and procedural generator reproducibility.

Quick start (developer)
1. Install three.js:
```
npm install three
npm install three-stdlib
```
2. Build/typecheck:
```
npx tsc --noEmit
npm run build
```

Notes and recommendations
- Prefer deterministic procedural generation for ship models; use LLMs only to produce parameter specs rather than raw geometry.
- Compute collision shapes on asset load (bounding sphere / OBB / convex hull) and keep them lightweight for simulation.
- Keep HTML overlay UI for spawning and toggles; render three.js canvas underneath.

Next steps
- Implement `ThreeRenderer` instancing & archetype loader.
- Update `GameManager` to accept a `RendererContract` instance and switch to `ThreeRenderer` by default.
- Add a small playground/demo to validate wrapping and camera controls.

deadronos: what would be needed to move to a 3d simulated spacebattler, maybe three.js?
can the svg be used for  that?
can we generate simple space scifi battleship meshes/models with llm?
should we move simulation to different bounds like +-numbers in x/y/z and have boundaries like a cube, that can "wrap" around top/bottom, left/right,behind/front?

GitHub Copilot: I'll create a short tracked todo list for migrating to a 3D space battler and mark the initial planning task as in-progress so we can track progress. Then I'll present requirements, design, migration plan, tooling, and example interfaces. After that I'll mark the planning todo completed. 

Using "Update Todo List"

Using "Update Todo List"

I'll draft a concise migration plan and practical implementation notes for moving SpaceAutoBattler from the current 2D WebGL renderer to a 3D simulated space battler (suggesting three.js), cover how SVGs fit in, how to generate ship meshes (procedural + LLM), and propose simulation bounds/wrapping behavior. I'll include EARS-style requirements, data shapes, API/adapter suggestions, performance notes (instancing), and a prioritized task list (we already added a tracked todo list).

Summary / plan
- Deliverables in this message:
  - 2–5 EARS-style requirements for the 3D migration (testable).
  - High-level architecture and a small "renderer adapter" contract so you can support both `WebGLRenderer` (existing) and a new `ThreeRenderer`.
  - Asset pipeline options: how to reuse SVGs, convert them to meshes/textures, and recommended formats (glTF).
  - Ship mesh/model generation approaches: procedural parametric meshes first, LLM-assisted generation for glTF/three.js code as a follow-up.
  - Simulation bounds and wrapping semantics for a cube (±X/±Y/±Z) with rendering/visibility implications and test suggestions.
  - Performance and rendering strategies: instanced meshes, LOD, culling, batching.
  - Short migration steps and a minimal API sketch for integrating three.js into the existing code.
  - Next steps / recommended experiments.

EARS-style requirements (2–5 testable requirements)
1) WHEN the game switches to 3D mode, THE RENDERER SHALL render ship entities as 3D meshes positioned in world-space with proper rotation on all three axes. Acceptance: a demo scene shows ships at varied x/y/z positions with visible orientation; tests verify renderer receives 3D position/rotation and that a Three.js scene contains meshes for each ship type.

2) WHEN many ships (>100) are present, THE RENDERER SHALL maintain interactive frame rates by using instanced rendering (THREE.InstancedMesh) or equivalent batching. Acceptance: benchmark demonstrating frame-time < 16ms with 200 instanced ships on target hardware (desktop).

3) WHEN an SVG asset exists for a ship shape, THE SYSTEM SHALL provide at least two valid reuse paths: (a) rasterize SVG to a texture (ImageBitmap) and apply to a planar mesh, or (b) convert SVG to an extruded/lathe mesh or use the outline to procedurally create a 3D mesh; each path must be selectable and documented. Acceptance: doc describing steps + a small test/demo that loads an SVG as a texture and as an extruded mesh.

4) WHEN the simulation moves to 3D bounds, THE SIMULATION SHALL permit defining a 3D axis-aligned bound box with optional periodic wrapping per axis (wrap on/off), and SHALL expose deterministic wrapping logic and distance calculations that account for wrapping. Acceptance: unit tests for distance across wrap boundaries and entity position normalization; integration demo shows ships crossing one face and appearing on the opposite face.

5) WHEN new ship models are required, THE SYSTEM SHALL support procedural parametric generation for simple sci-fi hulls and a pipeline for LLM-assisted generation of glTF or three.js geometry JSON; the procedural generator must produce deterministic meshes from a seed. Acceptance: procedural generator test produces identical geometry for the same seed; a small LLM-assisted prototype produces a valid glTF or .obj file that loads in three.js.

High-level architecture and renderer adapter
- Keep simulation ("GameState", physics, AI) distinct from rendering. Simulation stores positions, velocities, orientation (as Euler or quaternion), and a reference to an asset key for appearance.
- Add a renderer adapter interface (TypeScript sketch):

  - RendererContract:
    - init(canvas: HTMLCanvasElement): boolean
    - resize(width:number, height:number): void (or updateScale())
    - renderState(state: GameState, interpolation:number): void
    - preloadAllAssets(state?:GameState): Promise<void> | void
    - dispose(): void
    - supportsInstancing(): boolean
    - getStats(): any

- Implement a new `src/threeRenderer.ts` that implements the same public API as `WebGLRenderer` so the rest of the code (main.ts) can swap renderers with minimal changes.

Data shape changes for 3D
- Extend ship entity shape in `GameState`:
  - x:number, y:number, z:number
  - vx, vy, vz (optional)
  - rotation: {x:number, y:number, z:number} or quaternion: {w,x,y,z}
  - scale?: number | {x:number,y:number,z:number}
  - assetKey: string (existing)
  - team?: string
- Camera data: add position {x,y,z}, orientation (lookAt or quaternion), fov, near, far
- World bounds config:
  - bounds: { minX, maxX, minY, maxY, minZ, maxZ } or center + extents
  - wrapping: { x: boolean, y: boolean, z: boolean } // axis-level wrapping
- Optionally keep a "render-visible" or "ghost copies" field to track clones used to render wrapped entities.

SVG usage options (pros/cons)
1) Rasterize to texture (fast + simple)
   - Use existing rasterization code (canvas -> ImageBitmap -> THREE.Texture).
   - Apply texture to a simple plane, billboard, or low-poly mesh.
   - Best for 2D-looking ships in 3D scenes.
   - Pros: minimal effort, keeps current artwork, easy to tint/team-color.
   - Cons: no real 3D silhouette; poor silhouette when viewed edge-on.

2) SVG -> geometry (outline/extrude)
   - Use three.js's SVGLoader (reads SVG path strings), then create Shape/extrude geometry.
   - Pros: real 3D geometry with depth, can apply materials and normal maps.
   - Cons: complex shapes may require cleanup; not ideal for every SVG; tessellation and triangulation issues possible.
   - Workflow: clean/normalize SVGs (single path per hull), perhaps auto-scale, provide fallback rasterized texture for complex SVGs.

3) Re-author to parametric templates (recommended for scalable game assets)
   - Define parametric hull templates (e.g., hull length, nose radius, wing length, number of modules).
   - Procedurally generate geometry from parameters (Three.js BufferGeometry).
   - Pros: small code-based assets, deterministic, efficient to LOD/instancing.
   - Cons: requires authoring a parametric system.

4) Convert to glTF (author or export)
   - Use Blender or scripts (svgo + a conversion tool) to create glTF meshes; runtime loads glTF with GLTFLoader.
   - Use when you need rich materials or when LLM-assisted generation outputs glTF.

Ship mesh/model generation strategies
- Step 1: Procedural parametric generator (fast, deterministic)
  - Start with simple hull building blocks: extruded profiles, lathe bodies, boxes, cylinders, boolean unions.
  - Provide code to generate vertex attributes, normals, and UVs.
  - Output: Three.js BufferGeometry or glTF via exporter.
  - Deterministic seed-based generation ensures reproducible content.

- Step 2: Parametric templates + texture atlas
  - Use shared materials and texture atlas where possible to reduce draw calls; combine with instanced meshes and per-instance uniforms for team tinting.

- Step 3: LLM-assisted generation (experimental)
  - LLM can be used to generate metadata/specs or three.js code snippets that produce geometry (e.g., "Return a glTF JSON or a Three.BufferGeometry construction code for a sci-fi frigate").
  - Safer flow: LLM outputs a parametric spec (e.g., { modules: [...], thrusters: [...], colorHints: [...] }) rather than raw code; a deterministic generator consumes the spec to produce geometry.
  - If LLM is asked to generate full glTF, validate & sanitize the output; consider using LLM to produce Blender python scripts or glTF JSON that then is parsed/validated.
  - Acceptance testing: generated file must load in three.js (GLTFLoader) and produce a mesh.

Simulation bounds and wrapping (cube with configurable wrap per axis)
- Represent bounds: either min/max per axis or center + radius. Example config:
  - worldBounds = { min: {x:-500, y:-500, z:-500}, max: {x:500, y:500, z:500}, wrap: { x:true, y:true, z:true } }
- Normalization function (pseudocode):
  - For each axis where wrap=true:
    - width = max - min
    - while pos < min: pos += width
    - while pos >= max: pos -= width
- Distance with wrap:
  - For each axis:
    - dx = abs(a.x - b.x)
    - if wrap: dx = min(dx, width - dx)
  - return sqrt(dx*dx + dy*dy + dz*dz)
- Rendering across boundaries:
  - Entities near a boundary may need to be drawn twice (original + ghost) so they appear correctly near the opposite side.
  - Create ghost render instances with position offset ±width per wrapped axis when distance to boundary < drawThreshold.
  - If using instancing: either add additional instance entries for ghosts or use a shader trick (less common).
- Physics: simulation can operate in unwrapped coordinates then normalize after integration or always operate in normalized coordinates—pick one and be consistent. Recommendation: keep simulation positions canonical within bounds (call normalize after physics step) for simpler neighbor searches.

Rendering considerations for wrapping
- For three.js:
  - Option A: Keep all ship meshes in world coordinates in the canonical box and render ghost clones for ships within threshold. This keeps culling straightforward.
  - Option B: Use camera-space wrapping (less common).
- Ensure frustum culling and LOD are compatible with ghost objects (ghosts should be added to scene only when needed).

Performance and instancing
- Use THREE.InstancedMesh for ship types that share geometry and material.
- Per-instance transforms: use instanceMatrix; per-instance color/tint: use InstancedBufferAttribute or use per-instance color via instanceColor (newer versions).
- For many different ship models, group models into prefab types that can be instanced.
- Keep physics / simulation deterministic (seeded RNG), ensure that moving to 3D doesn't introduce non-determinism (floating precision/ordering).
- For large scale: spatial partitioning (octree / uniform grid) for proximity checks and frustum culling.

Minimal three.js integration sketch
- Add dependencies: three and types if not present:
  - npm i three
  - npm i -D @types/three (if TS types needed; three already ships types)
- Create `src/threeRenderer.ts` with the same public API as `WebGLRenderer`.
- Main differences:
  - Create THREE.WebGLRenderer, scene, camera, controls (optional).
  - For each ship:
    - If model for ship type not yet loaded, create geometry via procedural generator or load glTF.
    - Use instanced mesh(s) for repeated types.
    - Set per-instance transformation (position, quaternion, scale).
  - Use requestAnimationFrame for rendering or integrate with game loop if renderer does not provide its own loop.

Example of how to reuse SVGs in three.js at runtime
- Raster path:
  - Create ImageBitmap via canvas or createImageBitmap(svgBlob)
  - const texture = new THREE.Texture(imageBitmap); texture.needsUpdate=true;
  - Apply to plane or a sprite: new THREE.Mesh(new THREE.PlaneGeometry(w,h), new THREE.MeshBasicMaterial({map:texture, transparent:true}))
- Extrude path:
  - Use three.js SVGLoader to parse paths:
    - const loader = new SVGLoader();
    - const data = loader.parse(svgText); // returns paths
    - Convert each path to shapes: path.toShapes(true)
    - const geom = new THREE.ExtrudeBufferGeometry(shape, { depth: thickness, bevelEnabled: false })
    - Create mesh and apply materials
- glTF path:
  - Export SVG meshes as glTF ahead-of-time (Blender) or via conversion script for complex shapes.

LLM-assisted generation: practical workflow
- Prefer LLM produce parametric spec or procedural parameters rather than raw geometry or code.
- Pipeline:
  1. Prompt LLM for a parametric spec with constraints and a seed.
  2. Validate spec JSON.
  3. Feed spec into deterministic procedural generator to create BufferGeometry.
  4. Optionally export to glTF for reuse.
- If you decide to have LLM produce code or glTF directly, enforce a strict validator that:
  - Confirms valid glTF json structure,
  - Confirms vertex counts not excessive,
  - Sanitizes UVs/normals,
  - Runs a quick load test in a sandboxed worker.

Testing and validation
- Add unit tests for:
  - 3D wrap normalization and distance computations (deterministic).
  - Procedural generator deterministic outputs (seed -> geometry hash).
  - Asset loading pipeline for rasterized SVG -> texture.
- Add a small integration demo in scripts or `playground/three-demo.html` showing instancing, ghosting/wrapping, and a single ship type generated procedurally.

Migration steps (practical order)
1) Design and implement RendererContract (adapter interface). Update main integration to accept a renderer instance rather than constructing WebGLRenderer directly.
2) Add three.js to project and create a minimal `ThreeRenderer` stub that can render a single plane-textured ship using rasterized SVG (fast win).
3) Add 3D fields to `GameState` and update simulation to optionally produce z/vz; keep default z=0 for 2D fallback.
4) Implement world bounds and wrapping logic and unit tests.
5) Add procedural parametric generator for ship geometry and a deterministic seed-based API. Use it to create BufferGeometry and an InstancedMesh.
6) Implement ghosting/duplication for ships near boundaries.
7) Experiment with LLM-assisted spec generation (offline) and build import path (glTF loader).
8) Optimize with instancing, LOD, and atlas-based materials if needed.
9) Publish migration doc in `docs/3d-migration.md` and update readme.

Concrete code snippets & small API examples
- Renderer adapter interface:
  - (I'll sketch exact types if you want; can add a new TS file and tests.)

- Wrap normalization (TypeScript example, can be added as util):
  - function normalizePosition(pos:number, min:number, max:number):number {
      const width = max - min;
      while (pos < min) pos += width;
      while (pos >= max) pos -= width;
      return pos;
    }

- Wrap-aware shortest-delta (axis):
  - const raw = Math.abs(a-b);
    if (wrap) raw = Math.min(raw, width - raw);

Performance / resource notes
- Prefer shared geometry + instancing per ship archetype.
- Use texture atlases for decals or HUD elements.
- Bake normal maps / AO for extruded SVG meshes off-line where possible.
- For many objects, use static draw usage and buffer recycling.
- Test on target hardware and set budgets for draw calls, triangles, and textures.

Risks & tradeoffs
- SVG->mesh conversion can be brittle for complex SVGs; prefer authoring simpler shapes or using parametric templates.
- LLM generated geometry is experimental and potentially unsafe; validate strictly and keep generation offline/curated.
- Switching simulation to 3D increases complexity for code that assumed 2D (collision, targeting, UI overlays). Consider a phased approach (camera/renderer 3D, physics still 2D with z=0 first).

Actionable next steps I can do now (pick any; I'll do automatically if you want)
- Create a TypeScript `RendererContract` interface and add a lightweight `src/threeRenderer.ts` stub implementing it and loading three.js (minimal, loads a plane with rasterized SVG texture). This will require edits to src files and tests; I'd run typecheck/tests.
- Add a utility file with wrap normalization and unit tests.
- Create `docs/3d-migration.md` with the plan above.

Which of these next steps do you want me to execute now? If you want me to start coding, I will:
- Update the todo list (already done).
- Create `src/rendererContract.ts` and `src/threeRenderer.ts` stub matching the existing `WebGLRenderer` public API.
- Run TypeScript checks and a minimal unit test.

If you prefer, I can instead generate the small design doc `docs/3d-migration.md` (complete) first.

deadronos: actually: i accept breaking changes, move to three.js only, as it already provides a new webgl +fallback

i actually want to move the simulation into a 3d space too, we may need to adapt ship/turret ai for that (targeting, evasion/movement)

can we have a 3d space for sim with pointlike representations of ships with collision outlines dervied from meshes we import?

and simstep throught that?

the simulated 3d space can be used as a "scene" for the 3d render, "observer" camera could be made rotatable around 3 axis + zoom or moved (wasd keys)

we can make breaking changes for easiest workflow:
use simple assets, maybe construct/compute at loadtime, extrude from svg (scalable dimensions?)

we should stay "configdriven", but might have to rewrite consolidate a lot of configs

game should still be "red" vs "blue" spacehips (corvette, frigate, destroyer, carrier+fighter spawns from carriers)

the overlaid UI could mostly stay and allow manual spawning and toggling continous reinforcement or pause/play simulation

it should target 60 fps 60 times per second simstep

GitHub Copilot: I'll lay out a concise migration plan and then give concrete, copy-pasteable TypeScript file scaffolds (no edits performed here — paste them into your repo or tell me to apply them) plus commands to install deps and a prioritized task list so you can move the project to a 3D three.js-based simulation + renderer.

Checklist (what I'll deliver below)
- [x] High-level plan and requirements for moving to 3D and three.js
- [x] Data model (GameState) changes for 3D sim
- [x] World bounds & wrapping logic (cube + per-axis wrapping)
- [x] Collision outline strategy (mesh-derived approximations)
- [x] Sim step design (60 Hz fixed-step) and turret targeting in 3D
- [x] Renderer adapter contract and a minimal `ThreeRenderer` skeleton
- [x] Asset pipeline options (SVG -> extrude / raster / glTF / procedural)
- [x] Commands to add dependencies
- [x] Concrete next steps and prioritized migration tasks

High-level plan (one-liner)
- Replace the current WebGL renderer with a three.js-based `ThreeRenderer`, expand `GameState` to 3D (position/velocity/rotation/quaternion), run a deterministic fixed-step simulation at 60 Hz, and reuse SVGs either as raster textures (fast) or extruded meshes (scalable), with collision outlines approximated from meshes for the sim.

EARS-style (testable) requirements (short)
1) WHEN 3D mode is enabled, THE RENDERER SHALL show ships at x,y,z with full orientation; acceptance: demo shows ships at different z with camera orbit.
2) WHEN the simulation runs, THE SIM SHALL run at fixed 60 steps/sec and be deterministic given same seed; acceptance: serialized GameState after N steps matches recorded run.
3) WHEN an SVG asset exists, THE SYSTEM SHALL support rasterized texture and extruded mesh import; acceptance: loader demonstrates both paths for one ship.
4) WHEN many ships of same archetype exist, THE RENDERER SHALL use instancing (THREE.InstancedMesh) to keep frame time acceptable; acceptance: 200 instanced ships render at <16ms on desktop.
5) WHEN collision shapes are required, THE SYSTEM SHALL provide simplified collision outlines derived from mesh (sphere/OBB/convex hull) programmatically; acceptance: unit tests verify hull-derived bounding sphere and IoU behavior.

Design and data shape changes
- GameState (extend):
  - For each ship entity (example fields, add new fields):
    - position: { x:number, y:number, z:number }
    - velocity: { x:number, y:number, z:number }
    - rotation: { x:number, y:number, z:number } // Euler or
    - quaternion?: { x:number, y:number, z:number, w:number } // prefer quaternion
    - scale?: number | { x:number, y:number, z:number }
    - assetKey: string
    - simulationId?: number // deterministic id used in RNG
    - collisionShapeKey?: string // references simplified collision hull data
  - Camera: { position:{x,y,z}, target:{x,y,z} | quaternion, fov, near, far }
  - World bounds config:
    - worldBounds: { min:{x,y,z}, max:{x,y,z}, wrap: { x:boolean, y:boolean, z:boolean } }

Renderer adapter contract (so you can swap renderers easily)
- Add an interface (TypeScript):
````typescript
export interface RendererContract {
  init(canvas: HTMLCanvasElement): boolean;
  updateSize(width: number, height: number): void;
  renderState(state: GameState, interpolation?: number): void;
  preloadAllAssets(state?: GameState): Promise<void> | void;
  dispose(): void;
  supportsInstancing?(): boolean;
  getStats?(): any;
}
````

Why: keeps `main.ts`/`gamemanager` small and lets you swap `WebGLRenderer` → `ThreeRenderer` quickly.

three.js integration & deps (PowerShell)
- Install three (three includes types)
```powershell
npm install three
# optional helpful loaders/tools
npm install three-stdlib
```
- If you plan to load glTF files:
```powershell
npm install three/examples/jsm/loaders/GLTFLoader
# (no npm package — use from node_modules/three/examples/jsm)
```

Asset pipeline options (recommended)
- Fast path (low cost): SVG -> Canvas -> ImageBitmap -> THREE.Texture -> Plane or Sprite. Best for keeping existing artwork and fast runtime conversion.
- Scalable path (higher quality): SVGLoader -> path.toShapes() -> ExtrudeBufferGeometry (apply small depth) -> compute normals and simple materials. Best for proper 3D silhouettes.
- Preferred for long term: parametric procedural generator or small glTF assets (exported once). Procedural generator + team tinting is very lightweight and deterministic.
- LLM-assisted generation: use LLM to produce a JSON param (modules + lengths + thruster positions + color hints). Then pipe spec into your deterministic generator to produce BufferGeometry. Keep the LLM output as spec, not raw code or glTF.

Collision outlines derived from meshes
- Strategies (ordered by simplicity → accuracy):
  1) Bounding Sphere: compute geometry.boundingSphere (cheap). Use for coarse collision and AI distance checks.
  2) Axis-Aligned Bounding Box (AABB) via BufferGeometry bounding box — not rotation-aware, but cheap.
  3) Oriented Bounding Box (OBB) approximations: compute Box3 in object local space + transform using world matrix (you can keep an OBB struct).
  4) Convex Hull: use three.js ConvexGeometry (example from examples/jsm) to compute convex hull from mesh vertices → good collision shape for point-like collisions.
  5) Compound multiple spheres: sample a few local points and create multiple spheres per ship for better fit (fast collision test).
- Recommendation: start with bounding sphere + optional OBB per archetype. If you need more precision, add Convex Hull generation offline or at load-time.

Compute collision shape at loadtime:
- For each imported/extruded mesh, compute:
  - boundingSphere (center + radius)
  - boundingBox (Box3)
  - optionally convex hull vertices (for hull-based checks)

Sim step design (60 Hz fixed-step)
- Use canonical fixed timestep: dt = 1 / 60 = 0.016666...
- Simulation loop pattern:
  - Accumulate real elapsed time, step while accumulator >= dt: simulateStep(dt)
  - Optionally cap number of steps per frame to avoid spiral of death.
- Determinism:
  - Use seeded RNG (already in repo) and ensure all random calls in sim occur in defined order.
  - Use fixed dt and single-threaded loops.
- Integration:
  - Simple integrator: Euler or semi-implicit Euler for velocities and positions:
    - v += a * dt
    - p += v * dt
- Wrapping normalization: after integration run positionNormalization(pos) which wraps axes if configured
- Broadphase: uniform spatial grid or loose octree for proximity queries (needed for turrets & collisions under many ships)

Turret targeting & intercept in 3D
- Targeting: compute intercept time for projectile speed s.
  - Solve for t in |targetPos + targetVel*t - shooterPos| = s * t
  - This is a quadratic in t: (targetVel·targetVel - s^2) t^2 + 2 relVel·relPos * t + relPos·relPos = 0
  - Solve and pick smallest positive t -> aim point = targetPos + targetVel * t
- Evasion: basic steering decisions:
  - If incoming projectile predicted to hit, compute dodge vector perpendicular to approach velocity (3D cross products) and add lateral acceleration.
  - Use simple boids-style behaviors: separate, align, cohesion in 3D if needed.
- For turret aiming, compute target quaternion or Euler to point turret direction vector at aim point.

Rendering & camera controls
- Camera: use THREE.PerspectiveCamera with orbit controls or a custom control: allow yaw/pitch/roll rotations and zoom (distance).
- Input: WASD for translation, QE for up/down, mouse for yaw/pitch. Keep a camera controller that writes to GameState.camera or is separate rendered-only state.
- Overlay UI: keep existing HTML overlays—three.js canvas sits behind DOM overlay for HUD/UI.

Performance & instancing
- Use THREE.InstancedMesh for ships with same geometry + material; update instanceMatrix and per-instance color attribute for tint.
- For many unique models, group by archetype and use a small number of instanced groups.
- LOD: use simplified meshes at distance; swap via LOD or manually based on camera distance.
- Frustum culling: three.js does by default; ensure ghost clones used for wrapping are added only when needed.

Wrapping & rendering ghosts
- Approach: keep canonical positions normalized into bounds for simulation. For rendering, when an object is within threshold distance from a wrap boundary, create temporary "ghost" instances offset by ±width for wrapped axes. For instanced rendering, you can add additional instance entries for ghosts.
- Alternatively, leave simulation positions un-normalized and normalize only when computing neighbor queries — more complex. I recommend canonical normalized positions with ghost rendering.

Concrete file scaffolds to add (copy/paste)
- 1) Renderer contract
````typescript
import type { GameState } from './types';

export interface RendererContract {
  init(canvas: HTMLCanvasElement): boolean;
  updateSize(width: number, height: number): void;
  renderState(state: GameState, interpolation?: number): void;
  preloadAllAssets(state?: GameState): Promise<void> | void;
  dispose(): void;
  supportsInstancing?(): boolean;
  getStats?(): any;
}
````

- 2) Minimal `ThreeRenderer` skeleton (load, extrude SVG or raster, instancing skeleton)
````typescript
import * as THREE from 'three';
import { SVGLoader } from 'three/examples/jsm/loaders/SVGLoader';
import type { RendererContract } from './rendererContract';
import type { GameState } from './types';

export class ThreeRenderer implements RendererContract {
  private canvas: HTMLCanvasElement;
  private renderer: THREE.WebGLRenderer | null = null;
  private scene: THREE.Scene | null = null;
  private camera: THREE.PerspectiveCamera | null = null;
  private instancedPools = new Map<string, { mesh: THREE.InstancedMesh, count: number }>();

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
  }

  init(canvas?: HTMLCanvasElement): boolean {
    try {
      if (canvas) this.canvas = canvas;
      this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true });
      this.renderer.setPixelRatio(window.devicePixelRatio || 1);
      this.scene = new THREE.Scene();
      this.scene.background = new THREE.Color(0x001020);

      this.camera = new THREE.PerspectiveCamera(45, this.canvas.width / this.canvas.height, 0.1, 5000);
      this.camera.position.set(0, 0, 400);
      this.updateSize(this.canvas.width, this.canvas.height);

      // Basic ambient + directional
      this.scene.add(new THREE.AmbientLight(0xffffff, 0.6));
      const dl = new THREE.DirectionalLight(0xffffff, 0.6);
      dl.position.set(1, 1, 0.5).normalize();
      this.scene.add(dl);

      return true;
    } catch (e) {
      console.error('ThreeRenderer.init failed', e);
      return false;
    }
  }

  updateSize(width: number, height: number): void {
    if (!this.renderer || !this.camera) return;
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  async preloadAllAssets(state?: GameState): Promise<void> {
    // TODO: implement loading/extrusion of SVGs & glTF, build instanced archetypes
    // Example: for each assetKey in config create geometry and Octree/BVH/collision shape
    return;
  }

  renderState(state: GameState, _interpolation = 0): void {
    if (!this.renderer || !this.scene || !this.camera) return;
    // sync camera from GameState if present
    try {
      const cam = (state && (state as any).camera) || null;
      if (cam && this.camera) {
        this.camera.position.set(cam.position.x, cam.position.y, cam.position.z);
        if (cam.target) this.camera.lookAt(cam.target.x, cam.target.y, cam.target.z);
        this.camera.updateMatrixWorld();
      }

      // Update instances: for each archetype instance update matrices/colors
      // TODO: hook into instancedPools and update instanceMatrix buffers

      this.renderer.render(this.scene, this.camera);
    } catch (e) {
      // swallow render errors during early migration
      console.error('ThreeRenderer.renderState', e);
    }
  }

  dispose(): void {
    if (this.renderer) {
      // traverse scene and dispose geometries/materials/textures
      if (this.scene) {
        this.scene.traverse((o) => {
          // @ts-ignore
          if (o.geometry) o.geometry.dispose?.();
          // @ts-ignore
          if (o.material) {
            if (Array.isArray(o.material)) {
              o.material.forEach((m: any) => m.dispose && m.dispose());
            } else {
              o.material.dispose && o.material.dispose();
            }
          }
        });
      }
      this.renderer.dispose();
      this.renderer = null;
    }
    this.scene = null;
    this.camera = null;
  }

  supportsInstancing() { return true; }

  // Small helper to extrude an SVG path into geometry (sync; use async SVG text loading outside)
  extrudeSVG(svgText: string, depth = 4, material?: THREE.Material): THREE.Mesh {
    const loader = new SVGLoader();
    const data = loader.parse(svgText);
    const group = new THREE.Group();
    data.paths.forEach((path) => {
      const shapes = path.toShapes(true);
      shapes.forEach((shape) => {
        const geom = new THREE.ExtrudeBufferGeometry(shape, { depth, bevelEnabled: false });
        const mat = material || new THREE.MeshStandardMaterial({ color: 0xb0b7c3 });
        const mesh = new THREE.Mesh(geom, mat);
        group.add(mesh);
      });
    });
    // Return grouped mesh (caller may position/scale)
    const wrapper = new THREE.Mesh();
    wrapper.add(group);
    return wrapper;
  }
}

export default ThreeRenderer;
````

- 3) Wrap & distance utils
````typescript
export type Vec3 = { x: number; y: number; z: number };
export type Bounds3 = { min: Vec3; max: Vec3; wrap: { x: boolean; y: boolean; z: boolean } };

export function normalizePosition(pos: Vec3, bounds: Bounds3): Vec3 {
  const res = { ...pos };
  ['x','y','z'].forEach((axis) => {
    const a = axis as 'x'|'y'|'z';
    const min = (bounds.min as any)[a];
    const max = (bounds.max as any)[a];
    const wrap = (bounds.wrap as any)[a];
    if (!wrap) return;
    const width = max - min;
    let v = (res as any)[a];
    // use modulo safe for negatives
    v = ((v - min) % width + width) % width + min;
    (res as any)[a] = v;
  });
  return res;
}

export function shortestDelta(a: number, b: number, min: number, max: number, wrap: boolean): number {
  const width = max - min;
  let d = a - b;
  if (!wrap) return d;
  d = ((d + width/2) % width) - width/2;
  return d;
}

export function wrappedDistance(a: Vec3, b: Vec3, bounds: Bounds3): number {
  const dx = shortestDelta(a.x, b.x, bounds.min.x, bounds.max.x, bounds.wrap.x);
  const dy = shortestDelta(a.y, b.y, bounds.min.y, bounds.max.y, bounds.wrap.y);
  const dz = shortestDelta(a.z, b.z, bounds.min.z, bounds.max.z, bounds.wrap.z);
  return Math.hypot(dx, dy, dz);
}
````

- 4) Simulation step sketch (deterministic, 60Hz)
````typescript
import { normalizePosition, wrappedDistance, Bounds3, Vec3 } from './utils/wrapping';
import type { GameState, Ship } from './types';
const DT = 1/60;

export function simulateStep(state: GameState, bounds: Bounds3): void {
  // For each ship: integrate velocities and apply simple drag
  for (const s of state.ships) {
    // integrate
    s.velocity.x += (s.acceleration?.x||0) * DT;
    s.velocity.y += (s.acceleration?.y||0) * DT;
    s.velocity.z += (s.acceleration?.z||0) * DT;

    s.position.x += s.velocity.x * DT;
    s.position.y += s.velocity.y * DT;
    s.position.z += s.velocity.z * DT;

    // simple damping
    s.velocity.x *= 0.999;
    s.velocity.y *= 0.999;
    s.velocity.z *= 0.999;

    // turret AI & other effects should update rotation/accel before/after integration
  }

  // collision detection (coarse): simple sphere-sphere checks using archetype radii
  // naive O(n^2) for prototyping; replace with spatial partitioning later.
  const ships = state.ships;
  for (let i=0;i<ships.length;i++){
    for (let j=i+1;j<ships.length;j++){
      const a = ships[i];
      const b = ships[j];
      const dist = wrappedDistance(a.position, b.position, bounds);
      const minDist = (a.collisionRadius || 8) + (b.collisionRadius || 8);
      if (dist < minDist) {
        // simple separation impulse along shortest displacement vector
        const dx = ((a.position.x - b.position.x) || 1);
        const dy = ((a.position.y - b.position.y) || 0);
        const dz = ((a.position.z - b.position.z) || 0);
        const len = Math.hypot(dx,dy,dz) || 1;
        const push = 0.5 * (minDist - dist) / len;
        a.position.x += dx * push;
        a.position.y += dy * push;
        a.position.z += dz * push;
        b.position.x -= dx * push;
        b.position.y -= dy * push;
        b.position.z -= dz * push;
      }
    }
  }

  // normalize positions into bounds (wrap)
  for (const s of state.ships) {
    s.position = normalizePosition(s.position, bounds);
  }

  // update simulation time
  state.t += DT;
}
````

- 5) Example `types` adjustments (sketch)
````typescript
export type Vec3 = { x:number; y:number; z:number };
export interface Ship {
  id: string;
  type: string;
  team?: 'red'|'blue'|string;
  position: Vec3;
  velocity: Vec3;
  acceleration?: Vec3;
  quaternion?: { x:number; y:number; z:number; w:number };
  rotation?: { x:number; y:number; z:number };
  scale?: number;
  assetKey?: string;
  collisionRadius?: number; // simplifying collision prop for early phases
  // other props...
}

export interface GameState {
  ships: Ship[];
  flashes?: any[];
  t: number;
  camera?: {
    position: Vec3;
    target?: Vec3;
    fov?: number;
    near?: number;
    far?: number;
  };
  // ...other existing fields
}
````

Implementation notes / rationale
- Use canonical `GameState` for all runtime state (matches README-GAMEMANAGER.md).
- Keep the simulation separate from rendering: the sim updates GameState; renderer consumes GameState.
- For performance, start with sphere approximations (collisionRadius) and upgrade to OBB/convex hull if required.
- For instancing, build one InstancedMesh per archetype (corvette/frigate/etc). For ghosting, add extra instances offset by ±width for wrapped axes.
- For procedural generation, produce BufferGeometry arrays deterministically from a seed and parameter object; save the generated geometries in an "asset pool" keyed by archetype+seed.

Testing checklist (what to add)
- Unit tests for:
  - wrapping.normalizePosition and wrappedDistance (edge cases crossing boundaries).
  - procedural generator deterministic outputs (same seed -> same geometry hash).
  - intercept function solves quadratic and yields reasonable aim points in 3D.
- Integration smoke:
  - spawn a carrier + fighters (carrier spawning logic as before) and confirm 60 steps of simulation run in ~<50ms on CI per 60 steps (profiling).
- Renderer smoke:
  - instantiate `ThreeRenderer` with a headless canvas (or in browser) and render a simple scene.

Commands to run locally (PowerShell)
- Install deps:
```powershell
npm install three
npm install three-stdlib
```
- Build / typecheck:
```powershell
npx tsc --noEmit
npm run build
```

Prioritized migration tasks (small increments)
1) Add `RendererContract` and change main code to accept a renderer implementing it (small refactor). (Low risk)
2) Add `types` 3D extensions and minimal simulation loop `simulateStep` at 60Hz. (Low-medium)
3) Add `ThreeRenderer` skeleton and wire into the app. Use rasterized SVGs to plane for fastest iteration. (Medium)
4) Implement instancing for archetypes and integrate ghost rendering for wrapping. (Medium-high)
5) Add collision-shape derivation (bounding sphere + OBB) at asset load. (Medium)
6) Replace naive O(n^2) collision with a spatial grid/octree. (High)
7) Add procedural generator + LLM-assisted spec pipeline (experimental). (Optional/experimental)

Edge cases & warnings
- SVG extrusion can produce heavy geometry; prefer low-res or simplified shapes for runtime extrusion.
- LLM-generated geometry should be validated — never load untrusted vertices directly without checks.
- Determinism: floating point differences across browsers/hardware can break bit-for-bit determinism — measure and accept a tolerance or isolate determinism to server-side replays if perfect reproducibility is required.
- Target 60Hz sim step: keep sim step logic very cheap and put heavy work (mesh generation) at load-time, not in sim.

Acceptance & requirements coverage
- Renderer: will be covered by implementing `ThreeRenderer` and tests to show mesh presence (Done: design + skeleton).
- 60Hz sim: `simulateStep` pattern provided; ensure integration into game loop (Done: design + code sketch).
- SVG reuse: raster + extrude options included (Done: strategy + loader code in `ThreeRenderer`).
- Collision outlines: bounding sphere/OBB + convex hull options (Done: recommendation + code utility).
- Instancing/perf: strategy described (Done).

Next steps I can take for you right now
- If you want, I can generate all the above scaffold files exactly (write them into the repo) and run type-checks/tests. I currently do not have write access to your workspace from this chat; if you'd like me to create the files for you, enable file editing tools or paste-confirmation is fine and I will produce complete file contents ready to drop in.
- I can also:
  - produce a working demo HTML/TS sandbox (simple scene + spawn UI) you can run locally,
  - or implement the next two prioritized tasks (RendererContract + ThreeRenderer skeleton) and run `npx tsc --noEmit` to verify types.

Which option do you want me to take next? If you want me to create the files into your repo, say "apply code" and I'll produce full file contents for each file and the PowerShell commands I will run (then you can enable the tools or paste them yourself).