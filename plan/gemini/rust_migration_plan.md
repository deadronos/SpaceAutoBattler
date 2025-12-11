# Rust/Wasm Migration Plan

## Motivation

Moving the simulation to Rust/Wasm offers three primary benefits:

1.  **Performance**: Rust's zero-cost abstractions and lack of Garbage Collection (GC) pauses are ideal for high-frequency simulation loops (60Hz+).
2.  **Determinism**: Easier to ensure bit-exact determinism across clients (crucial for multiplayer or replay systems) compared to JS floating point and JIT variability.
3.  **Safety**: Rust's type system prevents entire classes of runtime errors common in complex simulations.

## Proposed Architecture

The application will be split into two distinct layers:

1.  **The Host (JS/TypeScript)**:
    - Responsible for **Rendering** (Three.js/R3F), **Audio**, and **Input**.
    - Acts as a "dumb terminal" that visualizes the state provided by the Wasm module.
2.  **The Core (Rust/Wasm)**:
    - Owns the **Source of Truth** for the game state.
    - Runs the **Game Loop** (Physics -> Logic -> AI).
    - Exposes state via **Shared Memory** (SharedArrayBuffer) or flat buffers to minimize serialization overhead.

### Technology Stack

- **Language**: Rust
- **ECS**: `hecs` (lightweight, fast) or `bevy_ecs` (feature-rich). _Recommendation: `hecs` for easier integration and smaller binary size._
- **Physics**: `rapier3d` (Rust crate). This removes the overhead of the JS bindings layer.
- **Interop**: `wasm-bindgen` for function calls.
- **Serialization**: `bytemuck` for zero-copy views into Wasm memory.

## Data Synchronization Strategy

Transferring thousands of entity transforms every frame via `serde-wasm-bindgen` is too slow (JSON/Object serialization overhead).

**Solution: Structure of Arrays (SoA) in Wasm Memory**

The Rust side will maintain linear vectors for renderable data:

- `position_buffer: Vec<f32>` (x, y, z per entity)
- `rotation_buffer: Vec<f32>` (x, y, z, w per entity)
- `meta_buffer: Vec<u32>` (entity_id, type, team, hp)

JS will access these directly via `Float32Array` views into the Wasm memory buffer.

```typescript
// JS Side
const wasmMemory = wasmInstance.memory.buffer;
const positions = new Float32Array(wasmMemory, wasmInstance.get_position_ptr(), count * 3);
// Update Three.js InstancedMesh directly from `positions`
```

## Migration Steps

### Phase 1: Rust Foundation

1.  Set up a Rust workspace with `wasm-pack`.
2.  Implement the basic **Game Loop** structure in Rust.
3.  Integrate `rapier3d` crate.
4.  Create the "Interop Layer" to expose memory pointers to JS.

### Phase 2: The "Shadow" Simulation

1.  Re-implement the `Ship` and `Projectile` components in Rust.
2.  Port the **Movement System** (physics integration).
3.  Run the Rust sim in the background, logging outputs to verify against the JS sim (optional but good for correctness).

### Phase 3: Switchover & Rendering

1.  Update `App.tsx` to load the Wasm module.
2.  Replace `GameProvider` with a `WasmGameProvider`.
3.  Refactor `Battlefield.tsx` to read from the Wasm memory views instead of Miniplex queries.
    - _Note_: This is a significant change. React components currently bind to Miniplex. We will likely move to `InstancedMesh` managed by a central "RenderSystem" in JS that consumes the Wasm arrays.

### Phase 4: Gameplay Logic Port

1.  Port **AI/Decision Logic** (`aiDoctrine`, `intents`).
2.  Port **Combat Logic** (Turrets, Damage).
3.  Port **Spawning/Lifecycle** logic.

## Key Challenges & Solutions

- **React Interop**: The current UI uses Zustand and React Context.
  - _Solution_: The Wasm bridge will dispatch events (e.g., "HealthChanged") to update the Zustand store for UI, but the main 3D scene will bypass React state for performance.
- **Asset Loading**: Rust doesn't load GLTFs.
  - _Solution_: JS loads assets, calculates bounding boxes/colliders, and passes the _geometry data_ (dimensions, shapes) to Rust to initialize the physics world.

## Example Rust Interface

```rust
#[wasm_bindgen]
pub struct GameCore {
    world: World,
    physics: PhysicsWorld,
}

#[wasm_bindgen]
impl GameCore {
    pub fn new() -> GameCore { /* ... */ }

    pub fn tick(&mut self, dt: f32) {
        // Run systems
        self.physics.step();
        self.ai_system.update();
    }

    pub fn get_ship_positions_ptr(&self) -> *const f32 { /* ... */ }
    pub fn get_ship_count(&self) -> usize { /* ... */ }
}
```
