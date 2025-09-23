# Agents Guide: src/renderer

- Purpose: Rendering utilities, material registries, and post-processing glue for React Three Fiber.
- Separation: Consume game data via props or context; avoid duplicating simulation logic here.
- Performance: Cache materials/buffers, dispose manual Three.js resources, and avoid frame-to-frame allocations.
- Compatibility: Keep exports tree-shakeable and respect SSR safety for any code imported on the client.
- Testing: Exercise critical rendering flows with Playwright visual checks or story-driven snapshots when possible.
