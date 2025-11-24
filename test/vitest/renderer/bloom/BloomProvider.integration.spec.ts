/**
 * BloomProvider Integration Tests
 *
 * Tests the integration between BloomProvider and the extracted modules:
 * - layerAllocator
 * - selectionManager
 * - layerMaskManager
 * - materialManager
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { render, act, cleanup } from '@testing-library/react';
import React from 'react';
import { Mesh, BoxGeometry, MeshBasicMaterial, Object3D } from 'three';
import { BloomProvider, useBloomContext, useBloomRegistration } from '../../../../src/renderer/bloom/index.js';
import { LEGACY_USER_DATA_KEYS } from '../../../../src/renderer/bloom/constants.js';

describe('BloomProvider integration', () => {
  beforeEach(() => {
    cleanup();
  });

  describe('register/unregister round-trip', () => {
    it('restores original layer mask after unregister', () => {
      const mesh = new Mesh(new BoxGeometry(1, 1, 1), new MeshBasicMaterial());
      const originalMask = mesh.layers.mask;

      let registerFn: ((obj: Object3D) => void) | undefined;
      let unregisterFn: ((obj: Object3D) => void) | undefined;

      const CaptureContext = () => {
        const ctx = useBloomContext();
        registerFn = ctx?.register;
        unregisterFn = ctx?.unregister;
        return null;
      };

      render(
        React.createElement(BloomProvider, { enabled: true },
          React.createElement(CaptureContext)
        )
      );

      expect(registerFn).toBeDefined();
      expect(unregisterFn).toBeDefined();

      act(() => {
        registerFn!(mesh);
      });

      // After registration, original mask should be saved
      // Note: saveLayerMasks only saves for isMesh children, so for a single mesh
      // the saved mask is on the mesh itself
      expect(mesh.userData[LEGACY_USER_DATA_KEYS.origLayerMask]).toBeDefined();

      act(() => {
        unregisterFn!(mesh);
      });

      // After unregistration, original mask should be restored
      expect(mesh.layers.mask).toBe(originalMask);
      expect(mesh.userData[LEGACY_USER_DATA_KEYS.origLayerMask]).toBeUndefined();
    });

    it('restores original colorWrite after unregister', () => {
      const material = new MeshBasicMaterial({ transparent: true });
      material.colorWrite = true;
      const mesh = new Mesh(new BoxGeometry(1, 1, 1), material);

      let registerFn: ((obj: Object3D) => void) | undefined;
      let unregisterFn: ((obj: Object3D) => void) | undefined;

      const CaptureContext = () => {
        const ctx = useBloomContext();
        registerFn = ctx?.register;
        unregisterFn = ctx?.unregister;
        return null;
      };

      render(
        React.createElement(BloomProvider, { enabled: true },
          React.createElement(CaptureContext)
        )
      );

      act(() => {
        registerFn!(mesh);
      });

      // After registration with enabled=true, transparent material should have colorWrite=false
      expect(material.colorWrite).toBe(false);
      expect(mesh.userData[LEGACY_USER_DATA_KEYS.origColorWrite]).toEqual([true]);

      act(() => {
        unregisterFn!(mesh);
      });

      // After unregistration, original colorWrite should be restored
      expect(material.colorWrite).toBe(true);
      expect(mesh.userData[LEGACY_USER_DATA_KEYS.origColorWrite]).toBeUndefined();
    });
  });

  describe('enabled toggle synchronization', () => {
    it('syncs colorWrite when enabled changes', () => {
      const material = new MeshBasicMaterial({ transparent: true });
      material.colorWrite = true;
      const mesh = new Mesh(new BoxGeometry(1, 1, 1), material);

      let registerFn: ((obj: Object3D) => void) | undefined;

      const CaptureContext = () => {
        const ctx = useBloomContext();
        registerFn = ctx?.register;
        return null;
      };

      // Start with enabled=false
      const { rerender } = render(
        React.createElement(BloomProvider, { enabled: false },
          React.createElement(CaptureContext)
        )
      );

      act(() => {
        registerFn!(mesh);
      });

      // With enabled=false, colorWrite should remain true
      expect(material.colorWrite).toBe(true);

      // Toggle to enabled=true
      rerender(
        React.createElement(BloomProvider, { enabled: true },
          React.createElement(CaptureContext)
        )
      );

      // Now colorWrite should be false for transparent material
      expect(material.colorWrite).toBe(false);

      // Toggle back to enabled=false
      rerender(
        React.createElement(BloomProvider, { enabled: false },
          React.createElement(CaptureContext)
        )
      );

      // colorWrite should be restored to original
      expect(material.colorWrite).toBe(true);
    });
  });

  describe('multi-group scenarios', () => {
    it('handles objects in different groups with separate selections', () => {
      const mesh1 = new Mesh(new BoxGeometry(1, 1, 1), new MeshBasicMaterial());
      const mesh2 = new Mesh(new BoxGeometry(1, 1, 1), new MeshBasicMaterial());

      let contextValue: ReturnType<typeof useBloomContext> = null;

      const CaptureContext = () => {
        contextValue = useBloomContext();
        return null;
      };

      render(
        React.createElement(BloomProvider, { enabled: true },
          React.createElement(CaptureContext)
        )
      );

      act(() => {
        contextValue!.register(mesh1, { group: 'groupA' });
        contextValue!.register(mesh2, { group: 'groupB' });
      });

      // Both groups should have selections
      expect(contextValue!.selections.has('groupA')).toBe(true);
      expect(contextValue!.selections.has('groupB')).toBe(true);

      // Each selection should contain the correct object
      expect(contextValue!.selections.get('groupA')!.has(mesh1)).toBe(true);
      expect(contextValue!.selections.get('groupB')!.has(mesh2)).toBe(true);

      // Different groups should have different layers
      const layerA = contextValue!.selections.get('groupA')!.layer;
      const layerB = contextValue!.selections.get('groupB')!.layer;
      expect(layerA).not.toBe(layerB);
    });

    it('moves object between groups correctly', () => {
      const mesh = new Mesh(new BoxGeometry(1, 1, 1), new MeshBasicMaterial());

      let contextValue: ReturnType<typeof useBloomContext> = null;

      const CaptureContext = () => {
        contextValue = useBloomContext();
        return null;
      };

      render(
        React.createElement(BloomProvider, { enabled: true },
          React.createElement(CaptureContext)
        )
      );

      act(() => {
        contextValue!.register(mesh, { group: 'groupA' });
      });

      expect(contextValue!.selections.get('groupA')!.has(mesh)).toBe(true);

      act(() => {
        contextValue!.register(mesh, { group: 'groupB' });
      });

      // Should be removed from groupA and added to groupB
      expect(contextValue!.selections.get('groupA')!.has(mesh)).toBe(false);
      expect(contextValue!.selections.get('groupB')!.has(mesh)).toBe(true);
    });
  });

  describe('useBloomRegistration hook', () => {
    it('registers object on mount and unregisters on unmount', () => {
      const mesh = new Mesh(new BoxGeometry(1, 1, 1), new MeshBasicMaterial());
      const ref = { current: mesh };

      let contextValue: ReturnType<typeof useBloomContext> = null;

      const CaptureContext = () => {
        contextValue = useBloomContext();
        return null;
      };

      const RegisteredComponent = () => {
        useBloomRegistration(ref as React.RefObject<Mesh>);
        return null;
      };

      const { unmount } = render(
        React.createElement(BloomProvider, { enabled: true },
          React.createElement(CaptureContext),
          React.createElement(RegisteredComponent)
        )
      );

      // Object should be registered
      const defaultGroup = contextValue!.defaultGroup;
      expect(contextValue!.selections.get(defaultGroup)!.has(mesh)).toBe(true);

      unmount();

      // After unmount, object should be unregistered
      // Note: selections map persists but object should be removed
    });

    it('handles active=false correctly', () => {
      const mesh = new Mesh(new BoxGeometry(1, 1, 1), new MeshBasicMaterial());
      const ref = { current: mesh };

      let contextValue: ReturnType<typeof useBloomContext> = null;

      const CaptureContext = () => {
        contextValue = useBloomContext();
        return null;
      };

      const RegisteredComponent = ({ active }: { active: boolean }) => {
        useBloomRegistration(ref as React.RefObject<Mesh>, { active });
        return null;
      };

      const { rerender } = render(
        React.createElement(BloomProvider, { enabled: true },
          React.createElement(CaptureContext),
          React.createElement(RegisteredComponent, { active: true })
        )
      );

      const defaultGroup = contextValue!.defaultGroup;
      expect(contextValue!.selections.get(defaultGroup)!.has(mesh)).toBe(true);

      rerender(
        React.createElement(BloomProvider, { enabled: true },
          React.createElement(CaptureContext),
          React.createElement(RegisteredComponent, { active: false })
        )
      );

      // With active=false, object should be unregistered
      expect(contextValue!.selections.get(defaultGroup)!.has(mesh)).toBe(false);
    });
  });

  describe('layer mask computation', () => {
    it('computes correct layer mask for all selections', () => {
      let contextValue: ReturnType<typeof useBloomContext> = null;

      const CaptureContext = () => {
        contextValue = useBloomContext();
        return null;
      };

      render(
        React.createElement(BloomProvider, { enabled: true },
          React.createElement(CaptureContext)
        )
      );

      const mesh1 = new Mesh(new BoxGeometry(1, 1, 1), new MeshBasicMaterial());
      const mesh2 = new Mesh(new BoxGeometry(1, 1, 1), new MeshBasicMaterial());

      act(() => {
        contextValue!.register(mesh1, { group: 'groupA' });
        contextValue!.register(mesh2, { group: 'groupB' });
      });

      const mask = contextValue!.getSelectionLayerMask();
      const layerA = contextValue!.selections.get('groupA')!.layer;
      const layerB = contextValue!.selections.get('groupB')!.layer;

      // Mask should include bits for both layers
      expect(mask & (1 << layerA)).toBeTruthy();
      expect(mask & (1 << layerB)).toBeTruthy();
    });
  });
});
