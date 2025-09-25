rapped the Shadertoy-style texture work into the renderer; here’s what landed.

actions taken
Added generate_star_disk_textures.mjs and exported the new PNGs (star-organic.png, star-noise-rgba.png) plus starDiskTextures.ts so the pipeline can regenerate and import deterministic assets.
Extended StarDisk.tsx to load those textures via useTexture, set SRGB/anisotropy/nearest sampling, and pass them into the material config.
Reworked starDiskMaterial.ts with sampler-aware uniforms, blend/flicker controls, cached fallback DataTextures, and updated signatures; rewired StarDisk to keep uniforms/textures in sync.
Upgraded starDisk.fragment.glsl to sample the organic/Noise RGBA textures, modulating corona tint, flicker, and alpha, and added new shader uniforms. Introduced textureMix/textureFlicker config knobs and defaults (environment.ts), plus a dedicated bloom group in renderer.ts.
Updated tsconfig.json to include scripts/**/*.mjs, refreshed tests in star-disk-material.spec.ts, and generated the PNG outputs. Memory bank entries (activeContext, design doc, progress, TASK125) were completed and moved to the completed index.
validation 🧪
Build – PASS (npm run build, expected asset-size warnings including the new 281 KiB organic texture)
Typecheck – PASS (npm run typecheck)
Unit tests – PASS (npm test, existing Three.js/deprecation warnings only)
files changed
StarDisk.tsx, starDiskMaterial.ts, starDisk.fragment.glsl
starDiskTextures.ts, generate_star_disk_textures.mjs, src/assets/textures/star/{star-organic.png,star-noise-rgba.png}
environment.ts, renderer.ts, tsconfig.json
star-disk-material.spec.ts
Memory updates: activeContext.md, design-star-disk-shader.md, progress.md, _index.md, TASK125-star-disk-textures.md
notes & follow-ups
The production build flags the new organic texture as >244 KiB; that’s expected for the 1024² asset but keep an eye on perf budgeting.
Visual baselines/playwright screenshots still need updating to capture the textured star disk (tracked in memory next steps).
TASK125 is fully wrapped; future tuning can focus on bloom intensity or exposing the new shader knobs in UI if needed.