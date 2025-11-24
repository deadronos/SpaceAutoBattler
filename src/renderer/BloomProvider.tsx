import React, { createContext, useContext, useMemo, useRef } from 'react';
import type { Camera, Object3D } from 'three';
import { POSTPROCESSING_CONFIG } from '../config/renderer.js';
import type { BloomContextValue, BloomRegistrationOptions, LayerAllocatorState } from './bloom/types.js';
import { FALLBACK_GROUP, LAYER_START, LAYER_MAX } from './bloom/constants.js';
import { createAllocatorState, computeLayerMask } from './bloom/layerAllocator.js';
import { ensureSelectionForGroup, addObjectToSelection, removeObjectFromSelection } from './bloom/selectionManager.js';
import { saveLayerMasks, restoreLayerMasks, enableMainPassLayer } from './bloom/layerMaskManager.js';
import { saveColorWriteState, applyBloomColorWrite, restoreColorWriteState, syncColorWriteForObjects } from './bloom/materialManager.js';
import type { Selection } from 'postprocessing';

// Re-export types for backward compatibility
export type { BloomRegistrationOptions } from './bloom/types.js';

const Ctx = createContext<BloomContextValue | null>(null);

export function BloomProvider({ enabled, children }: { enabled: boolean; children?: React.ReactNode }): React.ReactElement | null {
  const selectionsRef = useRef<Map<string, Selection>>(new Map());
  const objectGroupRef = useRef<Map<Object3D, string>>(new Map());
  const allocatorRef = useRef<LayerAllocatorState>(createAllocatorState(LAYER_START));
  const defaultGroup = POSTPROCESSING_CONFIG.bloomDefaultGroup ?? FALLBACK_GROUP;

  // Ensure selections exist for all configured groups
  const configuredGroupsArray = useMemo(() => {
    const groups = POSTPROCESSING_CONFIG.bloomGroups ?? {};
    return [...new Set([...Object.keys(groups), defaultGroup])];
  }, [defaultGroup]);

  React.useEffect(() => {
    configuredGroupsArray.forEach((group) => {
      ensureSelectionForGroup(selectionsRef.current, group, allocatorRef.current);
    });
  }, [configuredGroupsArray]);

  const register = React.useCallback(
    (obj: Object3D | null | undefined, options?: BloomRegistrationOptions) => {
      if (!obj) return;
      const isActive = options?.active ?? true;
      const group = options?.group ?? defaultGroup;

      const previousGroup = objectGroupRef.current.get(obj);
      if (!isActive) {
        if (previousGroup) {
          const prevSel = selectionsRef.current.get(previousGroup);
          if (prevSel) removeObjectFromSelection(prevSel, obj);
          objectGroupRef.current.delete(obj);
        }
        return;
      }

      if (previousGroup && previousGroup !== group) {
        const prevSel = selectionsRef.current.get(previousGroup);
        if (prevSel) removeObjectFromSelection(prevSel, obj);
      }

      objectGroupRef.current.set(obj, group);
      const selection = ensureSelectionForGroup(selectionsRef.current, group, allocatorRef.current);

      // Only process if not already in this selection
      if (!selection.has(obj)) {
        // Save state BEFORE adding to selection (selection.add modifies layers)
        saveLayerMasks(obj);
        saveColorWriteState(obj);
        // Add to selection (this modifies the object's layers)
        addObjectToSelection(selection, obj);
        enableMainPassLayer(obj);
        applyBloomColorWrite(obj, enabled);
      }
    },
    [defaultGroup, enabled],
  );

  const unregister = React.useCallback((obj: Object3D | null | undefined) => {
    if (!obj) return;
    const group = objectGroupRef.current.get(obj);
    if (!group) return;

    const selection = selectionsRef.current.get(group);
    if (selection) removeObjectFromSelection(selection, obj);
    objectGroupRef.current.delete(obj);

    restoreColorWriteState(obj);
    restoreLayerMasks(obj);
  }, []);

  // Sync colorWrite when enabled state changes
  React.useEffect(() => {
    syncColorWriteForObjects(objectGroupRef.current.keys(), enabled);
  }, [enabled]);

  const value = useMemo<BloomContextValue>(
    () => ({
      enabled,
      defaultGroup,
      selections: selectionsRef.current,
      register,
      unregister,
      getSelectionLayerMask: () => computeLayerMask(selectionsRef.current),
      enableCameraLayers(camera: Camera): number {
        if (!camera?.layers) return 0;
        const prev = camera.layers.mask;
        const mask = computeLayerMask(selectionsRef.current);
        try { camera.layers.mask = prev | mask; } catch { /* ignore */ }
        return prev;
      },
    }),
    [enabled, defaultGroup, register, unregister],
  );

  return <Ctx.Provider value={value}>{children ?? null}</Ctx.Provider>;
}

export function useBloomContext(): BloomContextValue | null {
  return useContext(Ctx);
}

export function useBloomRegistration<T extends Object3D>(
  ref: React.RefObject<T | null>,
  options?: BloomRegistrationOptions,
): void {
  const ctx = useBloomContext();
  const registerFn = ctx?.register;
  const unregisterFn = ctx?.unregister;

  React.useEffect(() => {
    const obj = ref.current;
    if (!ctx || !obj || !registerFn || !unregisterFn) return;
    const isActive = options?.active ?? true;
    if (!isActive) {
      unregisterFn(obj);
      return;
    }
    registerFn(obj, options);
    return () => {
      unregisterFn(obj);
    };
  }, [ctx, registerFn, unregisterFn, ref, options?.group, options?.active]);
}
