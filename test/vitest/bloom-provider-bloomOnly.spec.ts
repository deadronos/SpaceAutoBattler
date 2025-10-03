import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import React from 'react';
import { Canvas } from '@react-three/fiber';
import { BloomProvider, useBloomContext } from '../../src/renderer/BloomProvider.js';
import { Mesh, MeshBasicMaterial, BoxGeometry, Object3D } from 'three';

function RegisterTest({ setResult }: { setResult: (r: any) => void }) {
  const ctx = useBloomContext();
  React.useEffect(() => {
    if (!ctx) return;
    const meshBloomOnly = new Mesh(new BoxGeometry(1, 1, 1), new MeshBasicMaterial({ color: 0xffffff, transparent: true }));
    const meshForceWrite = new Mesh(new BoxGeometry(1, 1, 1), new MeshBasicMaterial({ color: 0xffffff, transparent: true }));

    // Simulate artist marking the second mesh as "force color write" (not bloom-only)
    (meshForceWrite.material as any).userData = { __copilot_forceColorWrite: true };

    try {
      // Register both meshes to the bloom provider
      ctx.register(meshBloomOnly as unknown as Object3D, { group: 'test', active: true });
      ctx.register(meshForceWrite as unknown as Object3D, { group: 'test', active: true });
    } catch {
      // swallow
    }

    // Report the material colorWrite state so the test can assert on it
    const r = {
      bloomOnlyColorWrite: (meshBloomOnly.material as any).colorWrite,
      forceWriteColorWrite: (meshForceWrite.material as any).colorWrite,
    };
    setResult(r);
  }, [ctx, setResult]);

  return null;
}

describe('BloomProvider bloomOnly wiring', () => {
  it('disables colorWrite for transparent materials that are not force-write (bloom-only path)', () => {
    let result: any = null;
    const Tree = () => (
      React.createElement(
        BloomProvider,
        { enabled: true },
        React.createElement(
          Canvas,
          { style: { width: '20px', height: '20px' } },
          React.createElement(RegisterTest, { setResult: (r: any) => (result = r) })
        )
      )
    );

    const { container } = render(React.createElement(Tree));
    expect(container).toBeTruthy();
    // After registration the provider should have toggled colorWrite to false
    expect(result).toBeTruthy();
    expect(result.bloomOnlyColorWrite).toBe(false);
    // The force-write mesh should have preserved colorWrite==true
    expect(result.forceWriteColorWrite).toBe(true);
  });

  it('restores original colorWrite when unregistered', () => {
    let result: any = null;
    function RegisterAndUnregister() {
      const ctx = useBloomContext();
      React.useEffect(() => {
        if (!ctx) return;
        const mesh = new Mesh(new BoxGeometry(1, 1, 1), new MeshBasicMaterial({ color: 0xffffff, transparent: true }));
        // ensure starting colorWrite is true
        try { (mesh.material as any).colorWrite = true; } catch { /* ignore */ }
        ctx.register(mesh as unknown as Object3D, { group: 'test', active: true });
        // Now unregister immediately and capture state
        ctx.unregister(mesh as unknown as Object3D);
        result = { colorWriteAfterUnregister: (mesh.material as any).colorWrite };
      }, [ctx]);
      return null;
    }

    const Tree = () => (
      React.createElement(BloomProvider, { enabled: true }, React.createElement(Canvas, { style: { width: '20px', height: '20px' } }, React.createElement(RegisterAndUnregister)))
    );

    const { container } = render(React.createElement(Tree));
    expect(container).toBeTruthy();
    expect(result).toBeTruthy();
    // After unregister, colorWrite should have been restored to its original true
    expect(result.colorWriteAfterUnregister).toBe(true);
  });
});
