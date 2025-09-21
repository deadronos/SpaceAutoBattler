# Optimizing WebGL Game Performance with R3F, Drei, and State Management

WebGL games built with React-Three-Fiber (R3F) can achieve high performance if you carefully manage your scene graph, state updates, and rendering loop. Below are best practices to minimize frame drops and memory churn in an R3F + Drei + TypeScript stack (with Zustand or Miniplex for state, on Next.js or Vite). The guidance covers component/scene optimization, efficient Drei patterns, state management choices, mesh/memory strategies, frame loop tuning, asset loading, browser bottlenecks, and experimental techniques.

---

## 1) Component & Scene Graph Optimization (R3F)

**Goals:** reduce unnecessary React work and CPU draw-call overhead.

- **Batch/instance aggressively.** Each mesh = ≥1 draw call. Combine static meshes (e.g., `BufferGeometryUtils.mergeBufferGeometries`) and use instancing for repeated objects (`<instancedMesh>` or Drei `<Instances>/<Instance>`). Target only a few hundred draw calls total.
- **Share & reuse objects.** Memoize and reuse geometries/materials/textures. Avoid re-creating Three objects per frame.
  ```tsx
  const geom = useMemo(() => new THREE.BoxGeometry(), [])
  const mat  = useMemo(() => new THREE.MeshStandardMaterial({ color: 'red' }), [])
  return <mesh geometry={geom} material={mat} />
  ```
- **Avoid frequent mount/unmount churn.** Toggle `visible` on groups instead of destroying/creating large branches. Keep scenes “warm” and switch visibility, not components.
- **Cull smartly.** Flatten deep hierarchies when possible. Group by regions so whole branches can be toggled/cull-tested cheaply.
- **On-demand rendering when idle.** Use `<Canvas frameloop="demand">` and call `invalidate()` on state changes. In Next.js, dynamically import Canvas `{ ssr: false }`.

---

## 2) Drei Usage Patterns That Scale

- **Level of Detail (`<Detailed>`).** Provide hi/med/low variants and distance thresholds. Use impostors/billboards for distant detail.
- **Adaptive quality (`<PerformanceMonitor>`).** Drop `dpr`, disable heavy post-effects or shadows when FPS declines; restore when FPS recovers.
  ```jsx
  <PerformanceMonitor
    bounds={[30, 60]}
    onDecline={() => setDpr(1)}
    onIncline={() => setDpr(2)}
  />
  ```
- **Pause when tab is hidden.** Tie `frameloop` to `document.visibilityState` to stop rendering offscreen.
- **Use helpers prudently.**
  - `<Html>` is great in small numbers; avoid mass `occlude` (raycasts are expensive).
  - Outlines (`<Edges>`/`<Outline>`) double draw calls—reserve for hero meshes or implement as one post-process pass.
  - Prefer a single `<Canvas>`; multiple canvases multiply work. If you need multi-views, use `<View>`/scissor.

---

## 3) State Management: Zustand vs. Miniplex

**Rule #1:** Don’t tie per-frame values to React re-renders.

- **Zustand (reactive store).**
  - Subscribe narrowly via selectors; avoid global subscriptions that re-render many components.
  - For per-frame values, **read imperatively** inside `useFrame` (e.g., `store.getState()`) and mutate Three objects directly—don’t `setState` every frame.
- **Miniplex (ECS).**
  - Keep many dynamic entities in a data-oriented ECS. Update arrays of components each frame; render via a small number of R3F components (often instanced).
- **Hybrid approach.**
  - Use Zustand for UI/high-level flags; ECS for many moving entities (bullets, enemies). Map ECS data to InstancedMeshes in one render component.

---

## 4) Mesh, Geometry & Memory Management

- **Reuse geometry/materials/textures.** Loader hooks (`useLoader`, `useGLTF`) cache by URL. Share instances across meshes.
- **Kill GC churn.** Reuse math objects; don’t allocate in tight loops:
  ```tsx
  const tmp = new THREE.Vector3()
  useFrame(() => {
    ref.current.position.lerp(tmp.set(tx, ty, tz), 0.1)
  })
  ```
- **Dispose what you truly discard.** R3F disposes on unmount by default. If you replace textures/models manually, dispose old ones explicitly.
- **Dynamic buffers.** Mark frequently updated attributes as `DynamicDrawUsage`. For instancing, batch matrix updates then set `instanceMatrix.needsUpdate = true` once.
- **Pre-optimize assets.**
  - Simplify meshes; remove unseen faces; merge materials in DCC.
  - Use `.glb` with Draco for geometry and KTX2/Basis for texture compression.
  - Power-of-two textures for proper mipmapping; right-size resolutions.
  - Bake lighting/AO for static scenes; use cheaper materials at runtime.
- **Profile with r3f-perf/Spector.** Track draw calls, triangles, programs, texture count, VRAM, buffer uploads, and leaks.

---

## 5) Tuning `useFrame` & Animations

- **Animate imperatively; avoid React setState per frame.**
  ```tsx
  useFrame((_, dt) => { ref.current.position.x += speed * dt })
  ```
- **Use `delta` for frame-rate independent motion.** No fixed per-frame steps.
- **Consolidate loops.** Thousands of `useFrame` hooks are okay but centralizing heavy loops can help organization and micro-overhead.
- **Pause/cap work.** Skip heavy logic when paused; consider sub-stepping/capping costly systems at lower rates (e.g., AI @ 30 Hz).
- **Damping/tweening for smoothness.** Use lerp/damp functions for camera and object motion; frame-rate independent smoothing.
- **Offload heavy work.** Use web workers for AI/pathfinding/procgen; wrap heavy UI state updates in `startTransition` (React 18).

---

## 6) Texture & Asset Loading Strategies

- **Suspense-first.** Wrap heavy assets in `<Suspense fallback={...}>`; progressively swap LODs or lo-res → hi-res models.
- **Use loader caches.** `useGLTF` / `useLoader(TextureLoader, url)` reuse across components; avoid duplicate fetch/parse/GPU uploads.
- **Stream & code-split.** Load assets just-in-time (Next dynamic imports, Vite lazy imports). Preload when the player nears new content.
- **Compress & atlas.** Prefer KTX2 for textures. Atlas many small textures. Ensure mipmaps and appropriate filtering.
- **Next/Vite specifics.** Disable SSR for Canvas. Keep initial bundle lean; host large assets on CDN with good cache headers.

---

## 7) WebGL Browser Bottlenecks (Know Your Limits)

- **Draw calls (CPU).** Batch and instance to keep calls low. Consolidate materials; avoid excessive state changes.
- **Vertex throughput (GPU).** Use LOD/impostors; frustum/occlusion strategies; simplify distant geometry.
- **Fill rate/overdraw.** Limit heavy transparency layers and fullscreen passes. Lower effect resolution/quality dynamically.
- **High-DPI.** Clamp DPR via `<Canvas dpr={[1, 2]}>` and scale with `<PerformanceMonitor>` as needed.
- **Lights & shadows.** Minimize shadow-casting lights. Tight shadow frustums. Prefer baked/static lighting where possible.
- **Raycasting/events.** Many interactive objects → consider grouping, broad-phase, or instancing-aware raycast handling.
- **Cross-browser/device testing.** Profile on real devices (mobile Safari!). Monitor VRAM; avoid texture explosions.

---

## 8) Advanced / Experimental

- **React 18 concurrency & `startTransition`.** Keep the app responsive under load; time-slice non-urgent updates.
- **OffscreenCanvas/Workers.** Explore worker-driven rendering to free the main thread (advanced, ecosystem evolving).
- **WebGPU (future-ready).** Three.js WebGPU renderer is maturing; expect better parallelism/throughput over WebGL.
- **Physics in workers.** Use Rapier/Ammo with worker integration; prefer primitive colliders over mesh colliders.
- **Performance budgets & instrumentation.** Define frame-time budgets; use Chrome Performance + `console.time()` for hot paths.
- **Game-loop architecture.** Decouple game logic (ECS/worker) from rendering; send minimal render data to the main thread.

---

## Practical Checklist (TL;DR)

- [ ] Instance repeated objects; merge static geometry.
- [ ] Reuse geometries/materials/textures; avoid per-frame allocations.
- [ ] Keep draw calls in the low hundreds; track with r3f-perf/Spector.
- [ ] Clamp DPR and scale quality via `<PerformanceMonitor>`.
- [ ] Animate in `useFrame` using `delta`; avoid React setState per frame.
- [ ] Use ECS (Miniplex) for many entities; Zustand for UI/global flags.
- [ ] Compress assets (Draco/KTX2); use Suspense & progressive loading.
- [ ] Minimize shadow-casting lights; bake where possible.
- [ ] Pause/stop rendering offscreen; use `frameloop="demand"` if idle.
- [ ] Profile continuously and enforce budgets.

---

### Starter Snippets

**Instanced mesh for thousands of items:**
```tsx
function Boxes({ count = 10000 }) {
  const ref = useRef<THREE.InstancedMesh>(null!)
  const mat = useMemo(() => new THREE.Matrix4(), [])
  useEffect(() => {
    for (let i = 0; i < count; i++) {
      mat.setPosition(
        (Math.random() - 0.5) * 100,
        (Math.random() - 0.5) * 10,
        (Math.random() - 0.5) * 100
      )
      ref.current.setMatrixAt(i, mat)
    }
    ref.current.instanceMatrix.needsUpdate = true
  }, [count, mat])
  return (
    <instancedMesh ref={ref} args={[undefined as any, undefined as any, count]}>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial />
    </instancedMesh>
  )
}
```

**Adaptive DPR with PerformanceMonitor:**
```tsx
function AdaptiveCanvas() {
  const [dpr, setDpr] = useState(2)
  return (
    <Canvas dpr={dpr}>
      <PerformanceMonitor
        bounds={[30, 60]}
        onDecline={() => setDpr(1)}
        onIncline={() => setDpr(2)}
      />
      {/* ... */}
    </Canvas>
  )
}
```

**Zustand + useFrame (no per-frame setState):**
```tsx
const useStore = create<{ target: THREE.Vector3 }>(() => ({
  target: new THREE.Vector3()
}))

function Follower() {
  const ref = useRef<THREE.Mesh>(null!)
  const get = useStore.getState
  const tmp = useMemo(() => new THREE.Vector3(), [])
  useFrame((_, dt) => {
    ref.current.position.lerp(tmp.copy(get().target), 1 - Math.pow(0.9, dt * 60))
  })
  return <mesh ref={ref}><boxGeometry /><meshStandardMaterial /></mesh>
}
```

**Visibility toggle instead of mount/unmount:**
```tsx
function Scenes() {
  const [mode, setMode] = useState<'menu' | 'game'>('menu')
  return (
    <>
      <group visible={mode === 'menu'}>{/* menu scene */}</group>
      <group visible={mode === 'game'}>{/* game scene */}</group>
    </>
  )
}
```

---

**Recommended Tools:** r3f-perf (stats overlay), Spector.js (WebGL inspector), Chrome Performance/Memory profiler, gltfjsx CLI, KTX2/Draco encoders, react-three-rapier (physics with workers).

**Stack Targets:** TypeScript + R3F + Drei + Zustand/Miniplex on Next.js/Vite.

