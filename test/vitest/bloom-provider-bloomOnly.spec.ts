import { describe, it, expect } from 'vite-plus/test';
import { render, waitFor } from '@testing-library/react';
import React from 'react';
import { BloomProvider, useBloomContext } from '../../src/renderer/bloom/index.js';
import { Mesh, MeshBasicMaterial, BoxGeometry, Object3D } from 'three';

function RegisterTest({ setResult }: { setResult: (r: any) => void }) {
  const ctx = useBloomContext();
  React.useEffect(() => {
    if (!ctx) return;
    const meshBloomOnly = new Mesh(
      new BoxGeometry(1, 1, 1),
      new MeshBasicMaterial({ color: 0xffffff, transparent: true }),
    );
    const meshForceWrite = new Mesh(
      new BoxGeometry(1, 1, 1),
      new MeshBasicMaterial({ color: 0xffffff, transparent: true }),
    );

    (meshForceWrite.material as any).userData = { __copilot_forceColorWrite: true };

    try {
      ctx.register(meshBloomOnly as unknown as Object3D, { group: 'test', active: true });
      ctx.register(meshForceWrite as unknown as Object3D, { group: 'test', active: true });
    } catch {
      // ignore registration errors in tests
    }

    setResult({
      bloomOnlyColorWrite: (meshBloomOnly.material as any).colorWrite,
      forceWriteColorWrite: (meshForceWrite.material as any).colorWrite,
    });
  }, [ctx, setResult]);

  return null;
}

describe('BloomProvider bloomOnly wiring', () => {
  it('disables colorWrite for transparent materials that are not force-write (bloom-only path)', async () => {
    let result: any = null;
    const Tree = () =>
      React.createElement(
        BloomProvider,
        { enabled: true },
        React.createElement(RegisterTest, { setResult: (r: any) => (result = r) }),
      );

    const { container } = render(React.createElement(Tree));
    expect(container).toBeTruthy();
    await waitFor(() => expect(result).toBeTruthy());
    expect(result.bloomOnlyColorWrite).toBe(false);
    expect(result.forceWriteColorWrite).toBe(true);
  });

  it('restores original colorWrite when unregistered', async () => {
    let result: any = null;
    function RegisterAndUnregister() {
      const ctx = useBloomContext();
      React.useEffect(() => {
        if (!ctx) return;
        const mesh = new Mesh(
          new BoxGeometry(1, 1, 1),
          new MeshBasicMaterial({ color: 0xffffff, transparent: true }),
        );
        try {
          (mesh.material as any).colorWrite = true;
        } catch {}
        ctx.register(mesh as unknown as Object3D, { group: 'test', active: true });
        ctx.unregister(mesh as unknown as Object3D);
        result = { colorWriteAfterUnregister: (mesh.material as any).colorWrite };
      }, [ctx]);
      return null;
    }

    const Tree = () =>
      React.createElement(
        BloomProvider,
        { enabled: true },
        React.createElement(RegisterAndUnregister),
      );

    const { container } = render(React.createElement(Tree));
    expect(container).toBeTruthy();
    await waitFor(() => expect(result).toBeTruthy());
    expect(result.colorWriteAfterUnregister).toBe(true);
  });
});
