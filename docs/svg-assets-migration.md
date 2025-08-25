# SVG Asset Migration & Turret/Engine Integration Guide

## Overview
This document details the migration to SVG-based ship assets in SpaceAutoBattler, the extraction and use of SVG-defined turret and engine mountpoints, and the integration of rasterized turret sprites. It covers what has been implemented, the minimum viable product (MVP) status, and possible future expansions.

---

## SVG Inclusions

### Ship SVGs
- **Location:** `src/config/assets/svg/`
- **Files:**
  - `destroyer.svg`
  - `carrier.svg`
  - `frigate.svg`
  - `corvette.svg`
- **Purpose:**
  - Provide high-fidelity ship hull visuals for large ships (carrier, destroyer, frigate, corvette).
  - Define turret mountpoints via explicit SVG elements (e.g., `<rect class="turret">` for turrets).
  - Define engine trail mountpoints via `<rect class="engine">` elements for correct trail placement.

### Example: `frigate.svg`
- Contains main hull, cockpit, engine glows, two turret rectangles, and two engine rectangles:
  - `<rect x="57" y="22" width="6" height="14" rx="2" fill="#fff" class="turret" />`
  - `<rect x="65" y="22" width="6" height="14" rx="2" fill="#fff" class="turret" />`
  - `<rect x="54" y="110" width="4" height="6" rx="2" fill="#53ffd8" class="engine" />`
  - `<rect x="70" y="110" width="4" height="6" rx="2" fill="#53ffd8" class="engine" />`
- Turret and engine mountpoints are extracted by scanning for elements matching turret/engine semantics.

---

## What Has Been Done So Far

### 1. SVG Asset Plumbing
- Ship SVGs are mapped in `AssetsConfig.svgAssets` for carrier, destroyer, frigate, corvette.
- Automatic SVG preloading and mountpoint extraction (turret and engine) implemented in `CanvasRenderer.preloadAllAssets()`.
- Mountpoints are normalized to ship-local radius units and cached in `_svgMountCache` and `AssetsConfig.svgMounts`.

### 2. Turret & Engine Integration
- Renderer draws turrets and engine trails at mountpoints, using either instance data, shape config, or SVG mounts.
- Turrets rotate independently using `turret.angle` (driven by simulation).
- Engine trails are placed using extracted engine mountpoints for correct visual alignment.
- Rasterized turret sprites are generated and cached for each turret kind.

### 3. Simulation Plumbing
- Simulation (`simulate.ts`) advances each turret's angle toward a targetAngle using turnRate.
- Basic AI sets turret.targetAngle toward the nearest enemy ship for visual confirmation.

### 4. Testing & Validation
- Headless smoke scripts and vitest tests validate SVG mount extraction (turret and engine), turret angle integration, engine trail placement, and AI targeting.
- Renderer and simulation run successfully in headless and UI environments.

---

## Minimum Viable Product (MVP) Checklist
- [x] SVG assets for large ships included and mapped.
- [x] Automatic SVG preloading and mountpoint extraction (turret and engine).
- [x] Turret and engine mountpoints normalized and used in renderer.
- [x] Turret sprites rasterized and drawn at mountpoints.
- [x] Engine trails placed using SVG engine mountpoints.
- [x] Simulation advances turret angles using turnRate.
- [x] Basic AI sets turret.targetAngle toward nearest enemy.
- [x] Tests/smoke scripts validate all above behaviors.

**MVP Remaining:**
- [ ] UI/renderer: visually confirm SVG hulls are drawn (currently only vector shapes are rendered; SVG hull rendering is stubbed).
- [ ] Optionally block app startup until SVG assets and mounts are loaded (preloadAllAssets promise).
- [ ] Add fallback and error handling for missing SVGs or mountpoints.

---

## Expansion Opportunities
- **SVG Hull Rendering:**
  - Implement actual SVG hull drawing in CanvasRenderer and WebGLRenderer for large ships.
- **Turret & Engine Visuals:**
  - Support SVG-based turret sprites for higher fidelity.
  - Animate turret firing, recoil, and effects using SVG layers.
  - Animate engine trails and effects using SVG layers.
- **Mountpoint Authoring Tools:**
  - Create a visual editor or script to author and validate turret/engine mountpoints in SVGs.
- **Asset Hot-Reload:**
  - Enable live reload of SVG assets and mountpoints for rapid iteration.
- **Advanced AI:**
  - Expand turret AI to support target prioritization, predictive aiming, and multi-target tracking.
- **Performance Optimization:**
  - Profile and optimize SVG parsing, rasterization, and rendering for large fleets.
- **WebGL Parity:**
  - Convert rasterized turret sprites to GL textures for use in WebGLRenderer.
- **Replay/Determinism:**
  - Add tests to validate deterministic turret/engine behavior and asset loading for replays.

---

## References & Further Reading
- See `/docs/agentic-migration-workflow.md` for GameState migration and workflow.
- See `/spec/IMPLEMENTATION_STATUS.md` for current status and migration progress.
- See `/PR_NOTES/` and `.copilot-tracking/changes/` for decision records and granular change logs.
- See `AGENTS.md` for contributor workflow and requirements.
