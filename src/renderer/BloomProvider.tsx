import React, { createContext, useContext, useMemo, useRef } from 'react';
import { Selection } from 'postprocessing';
import type { Camera, Object3D } from 'three';
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
  /**
   * Compute the union bitmask of all selection layers.
   * Useful for telling a Camera which layers must be visible to render
   * selective-bloom objects (e.g. star layer, muzzle flashes, etc.).
   */
  getSelectionLayerMask: () => number;
  /**
   * Enable all selection layers on a given camera and return the
   * camera's previous layers.mask so callers can restore it.
   */
  enableCameraLayers: (camera: Camera) => number;
};

const Ctx = createContext<BloomCtx | null>(null);

const FALLBACK_GROUP = 'default';
const LAYER_START = POSTPROCESSING_CONFIG.bloomLayerStart ?? 11;

// Helper: ensure a provided layer index is an integer in the valid Three.js
// range [0..31]. If input is not finite, return a safe fallback (LAYER_START).
function normalizeLayerIndex(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return Math.max(0, Math.min(Math.floor(Number(LAYER_START) || 11), 31));
  // integer clamp
  const i = Math.floor(n);
  return Math.max(0, Math.min(i, 31));
}

export function BloomProvider({ enabled, children }: { enabled: boolean; children?: React.ReactNode }): React.ReactElement | null {
  const selectionsRef = useRef<Map<string, Selection>>(new Map());
  const objectGroupRef = useRef<Map<Object3D, string>>(new Map());
  const nextLayerRef = useRef<number>(LAYER_START);
  const defaultGroup = POSTPROCESSING_CONFIG.bloomDefaultGroup ?? FALLBACK_GROUP;

  // Ensure selections exist for all configured groups - only run when groups change.
  const configuredGroupsArray = useMemo(() => {
    const groups = POSTPROCESSING_CONFIG.bloomGroups ?? {};
    return [...new Set([...Object.keys(groups), defaultGroup])];
  }, [defaultGroup]);

  // Initialize selections for all configured groups only when groups change
  React.useEffect(() => {
    const map = selectionsRef.current;
    configuredGroupsArray.forEach((group) => {
      let selection = map.get(group);
      if (!selection) {
        selection = new Selection();
        // Defensive: normalize the candidate layer index before assigning to
        // the selection. Log debug info to help reproduce intermittent
        // "Layer out of range" warnings when present in runtime.
        const candidate = nextLayerRef.current;
        const layer = normalizeLayerIndex(candidate);
        // Debug logging (kept at debug level) prints the configured start and
        // the resolved layer we will assign. Avoid logging during tests.
        if (process.env.NODE_ENV !== 'test') {
          // eslint-disable-next-line no-console
          console.debug('[BloomProvider] allocating layer', { group, candidate, layer, LAYER_START });
        }
        selection.layer = layer;
        // advance next layer; keep it normalized as well
        nextLayerRef.current = Math.min(layer + 1, 31);
        map.set(group, selection);
      }
      selection.exclusive = false;
    });
  }, [configuredGroupsArray]);

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
        const candidate = nextLayerRef.current;
        const layer = normalizeLayerIndex(candidate);
        if (process.env.NODE_ENV !== 'test') {
          // eslint-disable-next-line no-console
          console.debug('[BloomProvider] register allocating layer', { group, candidate, layer, LAYER_START });
        }
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
      /**
       * Compute the union bitmask of all selection layers.
       * Useful for telling a Camera which layers must be visible to render
       * selective-bloom objects (e.g. star layer, muzzle flashes, etc.).
       */
      getSelectionLayerMask(): number {
        let mask = 0;
        for (const sel of selectionsRef.current.values()) {
          const layer = (sel as any).layer;
          if (typeof layer === 'number' && Number.isFinite(layer) && layer >= 0 && layer <= 31) {
            mask |= (1 << layer);
          }
        }
        return mask;
      },
      /**
       * Enable all selection layers on a given camera and return the
       * camera's previous layers.mask so callers can restore it.
       */
      enableCameraLayers(camera: Camera): number {
        if (!camera || typeof camera.layers === 'undefined') return 0;
        const prev = camera.layers.mask;
        const mask = (() => {
          let m = 0;
          for (const sel of selectionsRef.current.values()) {
            const layer = (sel as any).layer;
            if (typeof layer === 'number' && Number.isFinite(layer) && layer >= 0 && layer <= 31) {
              m |= (1 << layer);
            }
          }
          return m;
        })();
        try {
          camera.layers.mask = prev | mask;
        } catch { /* ignore */ }
        return prev;
      },
    }),
    [enabled, defaultGroup, register, unregister],
  );

  // Expose a small dev helper so E2E tests can query the current selection
  // layer mask without coupling to internal refs. This is only a debug aid
  // and intentionally attached to window to keep test code concise.
  React.useEffect(() => {
    try {
      const win = typeof window !== 'undefined' ? (window as any) : undefined;
      if (win) {
        win.__copilot_getSelectionLayerMask = () => {
          let mask = 0;
          for (const sel of selectionsRef.current.values()) {
            const layer = (sel as any).layer;
            if (typeof layer === 'number' && Number.isFinite(layer) && layer >= 0 && layer <= 31) {
              mask |= (1 << layer);
            }
          }
          return mask;
        };
      }
    } catch { /* ignore */ }
    return () => {
      try {
        const win = typeof window !== 'undefined' ? (window as any) : undefined;
        if (win && win.__copilot_getSelectionLayerMask) delete win.__copilot_getSelectionLayerMask;
      } catch { /* ignore */ }
    };
  }, []);

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
