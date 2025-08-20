Feature branch: webgl/streaming-instancing

Summary
-------
This branch contains iterative work to implement a single streaming instance
buffer for ships, bullets, and particles in the WebGL renderer. The goal is to
reduce per-frame allocations and GL uploads and to provide a stable base for
further visual improvements (particle shader, additive blending, atlases).

Current status
--------------
- Implemented `streamInstanceVBO` and `_streamBuffer` with grow-on-demand.
- Ships are written directly into the stream buffer; bullets and particles are
  appended to the buffer and the whole buffer is uploaded once per frame.
- Rendering paths (WebGL2 instanced and fallback) updated to draw ranges using
  attribute byte offsets into the streaming buffer.

Next steps
----------
1. Iterate on visuals: particle shader, additive blending, textured hulls.
2. Benchmark allocation and upload improvements vs previous approach.
3. Remove legacy per-type VBOs and tidy up unused variables.
4. Add unit tests or metrics capturing buffer growth behavior.

Notes for reviewers
-------------------
- This is a work-in-progress branch; please review incremental commits for
  clarity. The PR will target the `webgl` integration branch (not `main`).

Created-by: automation
