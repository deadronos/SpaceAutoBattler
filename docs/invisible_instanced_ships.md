# Top 10 Causes for Invisible Instanced Ships in Three.js

When working with `InstancedMesh` in Three.js, it's common to encounter scenarios where instances are present in the scene graph (e.g., visible via `console.log(scene)`) but do not render on screen. This document outlines the most frequent causes for this issue, along with an estimated percentage likelihood based on common debugging experiences.

---

## 1. Incorrect Instance Matrix Updates (30%)

This is by far the most common reason. Each instance's position, rotation, and scale are defined by a 4x4 transformation matrix.

*   **Missing `setMatrixAt()` calls:** You must call `instancedMesh.setMatrixAt(index, matrix)` for each instance you want to render.
*   **Forgetting `instanceMatrix.needsUpdate = true`:** After updating any instance matrices (even if just one), you *must* set `instancedMesh.instanceMatrix.needsUpdate = true` to tell Three.js to re-upload the data to the GPU.
*   **Data Transfer Issues (Web Workers):** If your instance matrices are computed in a Web Worker (e.g., for physics), ensure the `Float32Array` containing the matrices is correctly transferred back to the main thread and assigned to `instancedMesh.instanceMatrix.array`.

## 2. Material Issues (20%)

Problems with the material applied to the `InstancedMesh` can make instances invisible.

*   **Transparency/Opacity:**
    *   `material.transparent = true` but `material.opacity` is `0`.
    *   Incorrect `alphaTest` or `alphaToCoverage` settings for transparent textures.
*   **Blending:** Incorrect `material.blending` settings can cause objects to disappear, especially with complex scenes.
*   **Depth Write/Test:** `material.depthWrite = false` or `material.depthTest = false` can lead to objects being occluded by others or not rendering at all, particularly if render order is not carefully managed.
*   **Shader Errors:** If using custom shaders, bugs in the vertex or fragment shader can prevent rendering.

## 3. Frustum Culling (15%)

Three.js performs frustum culling to avoid rendering objects outside the camera's view.

*   **Incorrect Bounding Box/Sphere:** If the `InstancedMesh`'s `geometry.boundingSphere` or `geometry.boundingBox` is not correctly calculated or updated (especially after transformations or if the base geometry is very small), Three.js might incorrectly cull the entire instanced mesh.
*   **Camera Clipping Planes:** Instances might be outside the `camera.near` or `camera.far` clipping planes.

## 4. Scale Too Small/Large (10%)

Instances might be rendering, but are imperceptible.

*   **Too Small:** The scale applied via the instance matrix might be extremely small, making the instances microscopic.
*   **Too Large:** The scale might be so large that the instances encompass or extend beyond the camera's view, or exceed floating point precision limits.

## 5. Position Far from Origin / Camera (5%)

*   **Floating Point Precision:** If instances are positioned extremely far from the scene origin (e.g., millions of units away), floating-point precision issues can cause rendering artifacts or complete disappearance.
*   **Outside Camera View:** Instances might simply be positioned far away from the camera's current view, even if within valid rendering range.

## 6. Lighting Issues (5%)

If your material requires lighting (e.g., `MeshStandardMaterial`, `MeshPhysicalMaterial`), but there are no lights in the scene, or the lights are too dim/far away, the objects will appear black and thus invisible against a dark background.

## 7. Render Order / Z-fighting (5%)

*   **Transparent Objects:** If you have multiple transparent objects, or transparent and opaque objects overlapping, incorrect `renderOrder` or `material.transparent` settings can lead to some objects being drawn incorrectly or completely occluded.
*   **Z-fighting:** When objects are very close to each other on the same plane, Z-fighting can cause flickering or parts of objects to disappear.

## 8. `visible` Property (4%)

While `console.log(scene)` might show the `InstancedMesh` object, its `visible` property, or the `visible` property of one of its parent `Object3D`s, might be set to `false`.

## 9. Incorrect Geometry (3%)

The base `geometry` used for the `InstancedMesh` might be problematic.

*   **Degenerate Geometry:** The geometry might be zero-sized, have inverted normals, or contain corrupted vertex data, leading to nothing being drawn.
*   **Missing Attributes:** Ensure the geometry has at least `position` and `normal` attributes if your material requires them.

## 10. Web Worker Data Transfer (3%)

(Reiterating from point 1, but specifically for data transfer) If your instance matrices are computed in a web worker, ensure the `Float32Array` (or similar typed array) containing the matrices is correctly transferred back to the main thread. This often involves using `postMessage` with `transferList` for performance. If the data isn't correctly transferred or assigned, the main thread will be rendering stale or empty data.
