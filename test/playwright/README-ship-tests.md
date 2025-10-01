# Ship Hull Rendering Tests

Playwright-based visual regression tests for ship hull rendering. These tests validate that GLTF models render correctly with proper scene structure, materials, and visual output.

## Test Strategy

The test suite uses a **two-tier verification approach**:

### 1. Scene Introspection (Primary - Fast)
- Validates mesh presence and naming
- Checks material types and properties
- Verifies shader uniform values
- Ensures bounding boxes are reasonable

### 2. Screenshot Comparison (Secondary - High Confidence)
- Captures canvas screenshots
- Compares against baseline images
- Uses configurable pixel diff tolerances
- Runs on representative subset in CI

## Running Tests

### Run all ship hull tests
```bash
npm run test:playwright:ship
```

### Run in headed mode (for debugging)
```bash
npx playwright test ship-hulls.spec.ts --headed
```

### Run for specific browser
```bash
npx playwright test ship-hulls.spec.ts --project=chromium
```

## Baseline Management

### Generating Baselines

When you need to create or update baseline screenshots:

```bash
# Generate baselines for all hulls
npm run generate-baselines

# Generate baseline for specific hull
npm run build && npm run serve &
npx tsx scripts/generate-playwright-baselines.ts -- --hull=fighter
```

**Important:** Always review generated baselines visually before committing!

### When to Update Baselines

Update baselines when:
- Adding new ship hulls
- Modifying GLTF models
- Changing renderer settings (lighting, camera, materials)
- Fixing visual bugs that affect screenshots

### Baseline Update Workflow

1. Make your changes to ships/renderer
2. Run `npm run generate-baselines`
3. Review the generated images in `test/playwright/baselines/`
4. Compare with previous baselines to confirm changes are intentional
5. Commit the updated baselines with a descriptive message:
   ```bash
   git add test/playwright/baselines/
   git commit -m "Update ship baselines: improved engine glow rendering"
   ```

## Test Configuration

### Hull List
Hulls are defined in `test/playwright/hulls-list.json`:
```json
{
  "hulls": [
    { "id": "fighter", "category": "small", ... },
    ...
  ]
}
```

### CI Subset
For faster CI runs, only a representative subset is tested:
- Small: fighter
- Medium: frigate  
- Large: carrier

Full hull suite runs locally and in nightly CI builds.

### Tolerances
Configure in `test/playwright/ship-hulls.spec.ts`:
```typescript
const TEST_CONFIG = {
  maxDiffPixelRatio: 0.05,  // 5% pixel difference allowed
  threshold: 0.2,            // Color difference threshold
  loadTimeout: 30000         // 30s model load timeout
};
```

## Test Page

The test harness uses a minimal Three.js page (`test/playwright/pages/ship-renderer.html`) that:
- Loads GLTF models with fixed camera/lighting
- Renders deterministically (no animations, seeded RNG)
- Exposes `window.__TEST__` API for Playwright

### Test API

```typescript
window.__TEST__ = {
  // Wait for model load and render completion
  async waitForReady(): Promise<{ frameRendered: number }>,
  
  // Get scene introspection data
  async getSceneSummary(): Promise<SceneSummary>,
  
  // Set rendering options (shield, engine, etc.)
  async setOptions(options): Promise<void>
}
```

## Debug Artifacts

When tests fail, debug artifacts are saved to `test/playwright/debug/<hull>-<timestamp>/`:
- `fullpage.png` - Complete page screenshot
- `canvas.png` - Canvas-only screenshot  
- `scene-summary.json` - Scene introspection data
- `failure.md` - Failure analysis and next steps

## Determinism

Tests are designed for deterministic rendering:
- Fixed viewport (1280x800)
- Fixed camera position and FOV
- Fixed lighting (ambient + directional)
- Pixel ratio locked to 1
- No animations or time-based effects
- Postprocessing disabled for functional tests

## Troubleshooting

### Flaky Screenshot Comparisons

If screenshots differ across runs:
1. Check if GPU/driver differences are causing variations
2. Use SwiftShader for software rendering: `--use-gl=swiftshader`
3. Increase `maxDiffPixelRatio` tolerance
4. Disable postprocessing for affected tests

### Model Loading Failures

If GLTF models fail to load:
1. Verify model paths in `test/playwright/pages/ship-renderer.js`
2. Check that `npm run build` completed successfully
3. Ensure `npm run serve` is running on port 8080
4. Review browser console in headed mode

### Scene Introspection Issues

If scene structure assertions fail:
1. Check `scene-summary.json` in debug artifacts
2. Verify mesh names match expected patterns
3. Ensure materials have required properties
4. Check for missing or renamed nodes in GLTF

## Future Enhancements

Planned additions:
- [ ] Shield rendering validation (mesh + uniforms)
- [ ] Engine glow validation (emissive materials)
- [ ] Postprocessing variant tests (bloom effects)
- [ ] Per-hull tolerance configuration
- [ ] Nightly full-hull visual regression runs
- [ ] Automated failure triage

## References

- Design Document: `memory/designs/design-ship-mock-test.md`
- Task Tracking: `memory/tasks/TASK154-playwright-ship-screenshots.md`
- Playwright Config: `playwright.config.cjs`
