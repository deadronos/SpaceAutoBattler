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
  // Keep selection non-exclusive by default for configured groups.
  // We disable colorWrite on registered meshes below to avoid these
  // objects from writing into the main color buffer while still
  // participating in bloom. Setting `exclusive` caused the selective
  // bloom system to alter main-pass visibility in ways that produced
  // black mask-like artifacts in some compositor configurations.
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
        // Default to non-exclusive so objects remain visible in the main
        // render pass. Exclusive selections may remove objects from the
        // main pass which can cause them to disappear when postprocessing
        // is enabled after the scene has already registered objects.
        selection.exclusive = false;
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
        // Preserve original layer mask for restoration on unregister.
        try {
          (obj as any).traverse((child: any) => {
            if (!child || !child.isMesh) return;
            try {
              if (!child.userData) child.userData = {};
              if (typeof child.userData.__copilot_bloomOrigLayerMask === 'undefined') {
                child.userData.__copilot_bloomOrigLayerMask = (child.layers as any).mask;
              }
            } catch { /* ignore */ }
          });
        } catch { /* ignore traversal errors */ }

        selection.add(obj);
        // Ensure object is still visible in the main (layer 0) pass by
        // enabling layer 0 in addition to the bloom selection layer.
        try {
          (obj as any).traverse((child: any) => {
            if (!child || !child.layers) return;
            try { if (typeof child.layers.enable === 'function') child.layers.enable(0); } catch { /* ignore */ }
          });
        } catch { /* ignore */ }
        // Objects are automatically assigned to the selection's layer when added
        // No need to manually enable layer 0 as that defeats selective bloom
        // Additionally, ensure objects registered for bloom do not write
        // to the main color buffer. Some additive halo/ring shaders can
        // produce high-contrast masks when they also write to the base
        // color pass; disabling colorWrite prevents those artifacts while
        // still allowing depth and bloom contributions. Store previous
        // material.colorWrite values on object.userData so they can be
        // restored on unregister.
        // If postprocessing is enabled, apply colorWrite changes immediately.
        // Otherwise, store original flags but defer modification until the
        // composer (postprocessing) is active so objects remain visible when
        // bloom is disabled.
        try {
          (obj as any).traverse((child: any) => {
            if (!child || !child.isMesh) return;
            const mats = Array.isArray(child.material) ? child.material : [child.material];
            const origs: Array<boolean | undefined> = [];
            for (const m of mats) {
              try {
                origs.push(typeof m?.colorWrite === 'boolean' ? m.colorWrite : undefined);
                if (m && typeof m === 'object') {
                  try {
                    // Only modify if provider is enabled and material is transparent
                    if (enabled && (typeof m.transparent === 'boolean' ? m.transparent : false)) {
                      m.colorWrite = false;
                    }
                  } catch { /* ignore */ }
                }
              } catch { origs.push(undefined); }
            }
            try {
              if (!child.userData) child.userData = {};
              child.userData.__copilot_bloomOrigColorWrite = origs;
            } catch { /* ignore */ }
          });
        } catch { /* ignore traversal errors */ }
      }
    },
    [defaultGroup, enabled],
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
    // Restore any saved material.colorWrite flags when object is removed
    try {
      (obj as any).traverse((child: any) => {
        if (!child || !child.isMesh) return;
        const mats = Array.isArray(child.material) ? child.material : [child.material];
        const origs: Array<boolean | undefined> | undefined = child.userData && child.userData.__copilot_bloomOrigColorWrite;
        if (Array.isArray(origs)) {
          for (let i = 0; i < mats.length; i++) {
            const m = mats[i];
            try {
              const orig = origs[i];
              if (typeof orig === 'boolean' && m && typeof m === 'object') {
                try { m.colorWrite = orig; } catch { /* ignore */ }
              }
            } catch { /* ignore */ }
          }
        }
        try { delete child.userData.__copilot_bloomOrigColorWrite; } catch { /* ignore */ }
      });
    } catch { /* ignore traversal errors */ }
    // Restore any saved layer masks so the object returns to its original
    // layer membership when it is unregistered from bloom.
    try {
      (obj as any).traverse((child: any) => {
        if (!child || !child.layers) return;
        try {
          const origMask = child.userData && child.userData.__copilot_bloomOrigLayerMask;
          if (typeof origMask === 'number') {
            try { (child.layers as any).mask = origMask; } catch { /* ignore */ }
          }
          try { delete child.userData.__copilot_bloomOrigLayerMask; } catch { /* ignore */ }
        } catch { /* ignore */ }
      });
    } catch { /* ignore traversal errors */ }
  }, []);

  // When the provider's enabled state toggles, apply or restore colorWrite
  // flags for all registered objects so bloom-only behavior only takes
  // effect when postprocessing is active. This ensures that when postproc
  // is turned off, halos/rings remain visible in the main color pass.
  React.useEffect(() => {
    try {
      for (const obj of objectGroupRef.current.keys()) {
        try {
          (obj as any).traverse((child: any) => {
            if (!child || !child.isMesh) return;
            const mats = Array.isArray(child.material) ? child.material : [child.material];
            const origs: Array<boolean | undefined> | undefined = child.userData && child.userData.__copilot_bloomOrigColorWrite;
            if (enabled) {
              // Apply colorWrite=false for transparent materials as needed
              for (let i = 0; i < mats.length; i++) {
                const m = mats[i];
                try {
                  if (m && typeof m === 'object' && (typeof m.transparent === 'boolean' ? m.transparent : false)) {
                    try { m.colorWrite = false; } catch { /* ignore */ }
                  }
                } catch { /* ignore */ }
              }
            } else {
              // Restore previously stored originals
              if (Array.isArray(origs)) {
                for (let i = 0; i < mats.length; i++) {
                  const m = mats[i];
                  try {
                    const orig = origs[i];
                    if (typeof orig === 'boolean' && m && typeof m === 'object') {
                      try { m.colorWrite = orig; } catch { /* ignore */ }
                    }
                  } catch { /* ignore */ }
                }
              }
            }
          });
        } catch { /* ignore per-object traversal errors */ }
      }
    } catch { /* ignore overall */ }
  }, [enabled]);

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
