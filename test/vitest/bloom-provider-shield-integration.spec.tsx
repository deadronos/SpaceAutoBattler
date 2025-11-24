import React from 'react';
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { Mesh, SphereGeometry } from 'three';
import { BloomProvider, useBloomRegistration } from '../../src/renderer/bloom/index.js';
import { createShieldHexShaderMaterial } from '../../src/renderer/materialRegistry.js';

describe('BloomProvider integration with shield materials (TDD)', () => {
  it('should NOT disable material.colorWrite for shield materials that opt-out', () => {
    // Create a shield material via the canonical factory
    const mat = createShieldHexShaderMaterial('fighter', 'blue');
    // Ensure material starts with colorWrite=true so we can detect changes
    (mat as any).colorWrite = true;

    const mesh = new Mesh(new SphereGeometry(1, 8, 8), mat);

    const TestComponent = () => {
      const ref = React.useRef(mesh);
      useBloomRegistration(ref, { group: 'shields' });
      return null;
    };

    // Mount the BloomProvider with postprocessing enabled so registration will
    // try to apply colorWrite changes. The desired behavior is that shields
    // which opt-out (via material.userData.__copilot_forceColorWrite) keep
    // writing color into the main pass and thus remain visible.
    render(
      <BloomProvider enabled={true}>
        <TestComponent />
      </BloomProvider>
    );

    expect((mesh.material as any).colorWrite).toBe(true);

    mat.dispose();
  });
});
