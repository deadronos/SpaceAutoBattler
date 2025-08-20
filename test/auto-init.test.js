// @vitest-environment node
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('standalone auto-init fingerprint', () => {
  it('built standalone HTML includes fingerprint-aware AUTO_INIT', () => {
    // The build script writes the standalone file to ./dist and repo root.
    const candidates = [
      path.resolve(process.cwd(), 'dist', 'space_themed_autobattler_canvas_red_vs_blue_standalone.html'),
      path.resolve(process.cwd(), 'space_themed_autobattler_canvas_red_vs_blue_standalone.html'),
    ];

    let found = false;
    let content = '';
    for (const p of candidates) {
      if (fs.existsSync(p)) {
        content = fs.readFileSync(p, 'utf8');
        found = true;
        break;
      }
    }
    expect(found).toBe(true);

    // Expect the AUTO_INIT block markers and the fingerprint check
    expect(content).toContain('AUTO_INIT_SNIPPET_START');
    expect(content).toContain('__isSpaceAutoRenderer');
    // The snippet proactively calls window.startSimulation fallback
    expect(content).toContain('window.startSimulation');
  });
});
