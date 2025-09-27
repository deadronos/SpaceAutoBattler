import React, { createContext, useContext, useMemo, useRef } from 'react';
import { Selection } from 'postprocessing';
import type { Object3D } from 'three';
import { POSTPROCESSING_CONFIG } from '../config/renderer.js';

export interface BloomRegistrationOptions {
  /** Optional group name that maps to renderer bloom configuration. */
  group?: string;
  /** Whether the object should participate in bloom. */
  active?: boolean;
}

type BloomCtx = {
  enabled: boolean;
  /** Default group used when components omit explicit configuration. */
  defaultGroup: string;
  /** Stable selections per bloom group. */
  selections: Map<string, Selection>;
  register: (obj: Object3D | null | undefined, options?: BloomRegistrationOptions) => void;
  unregister: (obj: Object3D | null | undefined) => void;
};

const Ctx = createContext<BloomCtx | null>(null);

const FALLBACK_GROUP = 'default';
const LAYER_START = POSTPROCESSING_CONFIG.bloomLayerStart ?? 11;

export function BloomProvider({ enabled, children }: { enabled: boolean; children?: React.ReactNode }): React.ReactElement | null {
  const selectionsRef = useRef<Map<string, Selection>>(new Map());
  const objectGroupRef = useRef<Map<Object3D, string>>(new Map());
  const nextLayerRef = useRef<number>(LAYER_START);
  const defaultGroup = POSTPROCESSING_CONFIG.bloomDefaultGroup ?? FALLBACK_GROUP;

  // Ensure selections exist for all configured groups on every render (idempotent).
  const configuredGroups = useMemo(() => {
    const groups = POSTPROCESSING_CONFIG.bloomGroups ?? {};
    return new Set<string>([...Object.keys(groups), defaultGroup]);
  }, [defaultGroup]);

  configuredGroups.forEach((group) => {
    const map = selectionsRef.current;
    let selection = map.get(group);
    if (!selection) {
      selection = new Selection();
      const layer = Math.min(nextLayerRef.current, 31);
      selection.layer = layer;
      nextLayerRef.current = Math.min(layer + 1, 31);
      map.set(group, selection);
    }
  selection.exclusive = false;
  });

  const register = React.useCallback(
    (obj: Object3D | null | undefined, options?: BloomRegistrationOptions) => {
      if (!obj) return;
      const isActive = options?.active ?? true;
      const group = options?.group ?? defaultGroup;

      // Remove from previous group if necessary.
      const previousGroup = objectGroupRef.current.get(obj);
      if (!isActive) {
        if (previousGroup) {
          selectionsRef.current.get(previousGroup)?.delete(obj);
          objectGroupRef.current.delete(obj);
        }
        return;
      }

      if (previousGroup && previousGroup !== group) {
        selectionsRef.current.get(previousGroup)?.delete(obj);
      }

      objectGroupRef.current.set(obj, group);
      let selection = selectionsRef.current.get(group);
      if (!selection) {
        selection = new Selection();
        selection.exclusive = true;
        const layer = Math.min(nextLayerRef.current, 31);
        selection.layer = layer;
        nextLayerRef.current = Math.min(layer + 1, 31);
        selectionsRef.current.set(group, selection);
      }
      if (selection && !selection.has(obj)) {
        selection.add(obj);
        // Objects are automatically assigned to the selection's layer when added
        // No need to manually enable layer 0 as that defeats selective bloom
      }
    },
    [defaultGroup],
  );

  const unregister = React.useCallback((obj: Object3D | null | undefined) => {
    if (!obj) return;
    const group = objectGroupRef.current.get(obj);
    if (!group) return;
    const selection = selectionsRef.current.get(group);
    if (selection && selection.has(obj)) {
      selection.delete(obj);
    }
    objectGroupRef.current.delete(obj);
  }, []);

  const value = useMemo<BloomCtx>(
    () => ({
      enabled,
      defaultGroup,
      selections: selectionsRef.current,
      register,
      unregister,
    }),
    [enabled, defaultGroup, register, unregister],
  );

  return <Ctx.Provider value={value}>{children ?? null}</Ctx.Provider>;
}

export function useBloomContext(): BloomCtx | null {
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
