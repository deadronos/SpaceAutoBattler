I'll search for authoritative pages for each topic (Gaffer on Games, MDN, WebGLFundamentals, WebGL2Fundamentals, Chrome DevTools) to include accurate links for references. Expected outcome: 6–10 trusted links. Task received — I'll summarize authoritative best practices for WebGL game loops (fixed timestep, decoupled update/render, interpolation, clamping, visibility, GC avoidance) and GPU buffer streaming patterns, give a small, idiomatic JS pattern you can adapt for webglRenderer.js, and list references.

Checklist
- [x] Search web for authoritative sources (Gaffer/Glenn Fiedler, MDN, Khronos, WebGLFundamentals, Chrome tools, SpectorJS)
- [x] Summarize practical recommendations and edge cases
- [x] Provide a concise, idiomatic code pattern: fixed timestep + interpolation + streaming buffer example
- [x] Provide references (links and 1-line descriptions)

High-level recommendations (compact)
- Use requestAnimationFrame for rendering. It aligns frames with the browser vsync and allows the browser to throttle when not visible.
- Decouple simulation (update) from rendering. Run deterministic updates on a fixed timestep (e.g., 1/60s) and run rendering at requestAnimationFrame frequency — use an accumulator and integrate multiple fixed steps per frame if needed.
- Interpolate renders between the last and current simulation states using alpha = accumulator / dt so motion is smooth without making physics/time nondeterministic (see Gaffer on Games).
- Clamp extremely large frame deltas (frameTime) to avoid the “spiral of death” — e.g., frameTime = Math.min(frameTime, 0.25).
- Avoid per-frame allocations: reuse TypedArrays, reuse objects or use object pools to keep GC out of the main loop.
- Minimize draw calls and state changes: batch geometry, use instancing (WebGL2 or ANGLE_instanced_arrays), and use texture atlases to reduce texture binds.
- Use efficient buffer streaming strategies: orphaning (re-specify with null), multi-buffering, or persistent mapping patterns (where available). In WebGL you typically use buffer orphaning (gl.bufferData with size/null) then gl.bufferSubData, or pre-allocated large buffers and upload ranges with gl.bufferSubData.
- For streaming dynamic per-instance data prefer instanced attribute buffers (update per-instance buffer, then drawInstanced).
- Profile on actual devices: Chrome DevTools performance + SpectorJS + platform-specific GPU tools. Measure CPU vs GPU time and whether uploads cause implicit sync stalls.
- Handle visibility and throttling: pause updates or reduce tick rate when page is hidden (Page Visibility API). Still use requestAnimationFrame for rendering while visible.
- Handle WebGL context loss and restore: listen for 'webglcontextlost' and 'webglcontextrestored'.
- Avoid blocking the main thread on GPU sync: do not naively map/update buffers that the GPU may still be using — that causes implicit synchronization and stalls.

Why fixed timestep + interpolation matters (short)
- Fixed timestep gives deterministic simulation (important for consistency, networking, and stable physics).
- Rendering interpolation decouples smooth visual motion from the discrete physics ticks: you render a blend between previous and current physics states rather than “older” state — it produces smoother visuals and reduces visible jitter when the frame rate is not an integer multiple of the physics tick rate.
- See the classic explanation: “Fix Your Timestep” by Glenn Fiedler (Gaffer on Games).

Idiomatic JS game-loop pattern (fixed timestep + interpolation)
(Short snippet to adapt into webglRenderer.js; keep typed-array reuse and buffer updates outside allocations.)

```javascript
// small, idiomatic loop pattern
const dt = 1 / 60;                // fixed update timestep (seconds)
let lastTime = performance.now() / 1000;
let accumulator = 0;

let previousState = initialStateCopy();
let currentState = initialStateCopy();

function updateState(state, dtSeconds) {
  // advance simulation by dtSeconds; mutate state
  // ...existing update logic...
}

function renderInterpolated(alpha) {
  // compute interpolated state between previousState and currentState using alpha
  // update GPU buffers (reuse TypedArrays) and issue draw calls
}

function loop(nowMs) {
  const now = nowMs / 1000;
  let frameTime = now - lastTime;
  lastTime = now;

  // guard: clamp large deltas (avoids spiral of death after tab switching)
  frameTime = Math.min(frameTime, 0.25);

  accumulator += frameTime;

  // consume fixed steps: keep previousState = last applied state
  while (accumulator >= dt) {
    // step
    previousState = shallowCopy(currentState); // inexpensive copy or swap references
    updateState(currentState, dt);
    accumulator -= dt;
  }

  const alpha = accumulator / dt; // [0,1)
  renderInterpolated(alpha);

  requestAnimationFrame(loop);
}

// start
requestAnimationFrame(loop);
```

Notes on implementing the above in practice:
- Avoid deep cloning every frame. Instead structure state so you can swap buffers or store just the minimal interpolatable fields (position, rotation, velocity).
- For networked/saved simulation, keep integer tick counter + deterministic update to reproduce state.
- If updates are cheap, you can increase tick rate; otherwise keep dt stable and adjust interpolation.

Buffer streaming / dynamic-vertex update patterns (WebGL1/WebGL2)
- Orphaning (simple & widely compatible):
  - gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  - gl.bufferData(gl.ARRAY_BUFFER, sizeInBytes, gl.DYNAMIC_DRAW); // orphan current storage
  - gl.bufferSubData(gl.ARRAY_BUFFER, 0, typedArrayWithVertexData);
  - This avoids waiting on GPU if the driver provides a fresh backing store.
- Pre-allocate big buffers and update ranges:
  - Reuse a single large TypedArray (no per-frame allocations).
  - Update only ranges with gl.bufferSubData(offset, subarray).
  - Avoid interleaving too many small gl.bufferSubData calls per object — better to compose one contiguous block when possible.
- Multi-buffering (explicit):
  - Maintain N GL buffer objects and rotate which buffer you write to each frame (double or triple buffering). Use the buffer that’s guaranteed not in use by the GPU.
- Instanced data:
  - Store per-instance attributes in a dynamic buffer; update only per-instance attributes and call drawArraysInstanced or drawElementsInstanced (WebGL2) or use ANGLE extension on WebGL1.
- Avoid mapping in WebGL1 (no direct mapping). In WebGL2 or native GL, persistent mapping + fences is the most advanced pattern (not generally available in browsers).
- Minimize driver synchronization: when uploads stall the CPU, the most common cause is writing to a buffer that's currently in use by the GPU — orphaning or multiple buffers prevents this.

Micro-optimizations that matter in browsers
- Reuse a handful of TypedArrays for per-frame uploads.
- Avoid generating many small WebGL calls per object; batch vertex/index data when possible.
- Use VAOs (WebGL2) to avoid re-binding vertex attrib state.
- Minimize uniform updates per draw call (but modern drivers handle many uniforms OK); consider UBOs (WebGL2) if available for shared uniform data.
- Use lower-precision data where acceptable (float16 or normalized unsigned shorts) to reduce bandwidth.
- For 2D/particle games: consider using instancing + per-instance attributes for transform/color rather than issuing individual draws.

Visibility / throttling / battery
- Page Visibility API: when document.hidden, stop heavy updates or throttle to a lower tick rate. Still keep deterministic tick handling if you resume (clamp dt on resume).
- On mobile, watch devicePixelRatio changes; resizing framebuffers reallocate textures and buffers — minimize these reallocations.

Edge cases and defensive measures
- Large frameTime after pause: clamp to a safe max, and consider running a few simulation steps if you want to catch up but avoid running excessive updates in one frame.
- Very slow devices: gracefully lower visual fidelity (fewer particles, smaller batch sizes, lower resolution).
- WebGL context loss: release and recreate GPU resources on 'webglcontextlost' / 'webglcontextrestored'.
- Differing GPUs/browsers: test on several devices; use SpectorJS and Chrome DevTools to inspect draw calls, textures, and buffer uploads.

Quick streaming example (WebGL2-style idiom, WebGL1 similar with ANGLE instancing)
```javascript
// reuse typed arrays to avoid allocations
const instanceData = new Float32Array(maxInstances * floatsPerInstance);

function updateInstanceBuffer(gl, buffer, data, usedCount) {
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  // Orphan buffer to avoid GPU sync
  gl.bufferData(gl.ARRAY_BUFFER, data.byteLength, gl.DYNAMIC_DRAW);
  // fill typed array externally (no alloc)
  gl.bufferSubData(gl.ARRAY_BUFFER, 0, data, 0, usedCount * floatsPerInstance);
}
```
- Practical: call bufferData(null-size) or bufferData(size) then bufferSubData. Don’t allocate a new TypedArray per frame.

Recommended tools / profilers
- SpectorJS — capture and inspect WebGL calls (excellent for draw-call analysis).
- Chrome DevTools — Performance and WebGL/Graphics overlays.
- WebGL Inspector / Firefox devtools for shaders and buffer state.
- Device-specific GPU profilers when available (Adreno/Treble, Mali tools) for deep GPU bottlenecks.

References (authoritative)
- Fix Your Timestep — Glenn Fiedler (Gaffer on Games) — canonical writeup on fixed timestep + interpolation
  - https://gafferongames.com/post/fix_your_timestep/
- MDN — requestAnimationFrame and rendering best practices
  - https://developer.mozilla.org/en-US/docs/Web/API/window/requestAnimationFrame
- Khronos / OpenGL Wiki — Buffer Object Streaming (concepts like orphaning, multi-buffering, persistent mapping)
  - https://www.khronos.org/opengl/wiki/Buffer_Object_Streaming
- WebGLFundamentals — Instanced drawing and WebGL optimization notes
  - https://webglfundamentals.org/webgl/lessons/webgl-instanced-drawing.html
- SpectorJS — WebGL call capture / debug tool
  - https://spector.babylonjs.com/
- WebGL best-practices and optimization posts (practical tips):
  - WebGL performance guides and blog posts — e.g., webglfundamentals.org optimization pages (search their site for “WebGL optimization”).
- Chrome DevTools — Graphics and Performance profiling docs
  - https://developer.chrome.com/docs/devtools/evaluate-performance/

Requirements coverage & verification
- Collected authoritative resources: Done (Gaffer/MDN/Khronos/WebGLFundamentals/SpectorJS).
- Summarized best practices and edge cases: Done (above).
- Provided code pattern and streaming buffer examples: Done (above).
- Provided references with short descriptions: Done (above).

Next steps (optional, low-risk improvements you can ask me to make)
- I can adapt the loop snippet and streaming code into your webglRenderer.js directly and run local tests (unit tests / play tests), ensuring no new allocations and hooking into the project's existing render update flow.
- Add a small smoke test that verifies the simulation update loop behavior (for example a deterministic tick test).
- Add SpectorJS capture instructions or automated profiling hooks for your local testing workflow.

If you want, I’ll:
- plug the loop pattern into webglRenderer.js (I can open it, modify safely on a feature branch `feat/webgl-loop-fix-step`, run tests, and create a PR), or
- produce a minimal example file (standalone) demonstrating instanced streaming + fixed timestep you can run in the browser.

Which of those follow-ups would you like me to do next?