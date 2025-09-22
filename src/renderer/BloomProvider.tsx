import React, { createContext, useContext, useMemo, useRef } from 'react';
import type { Object3D } from 'three';

type BloomCtx = {
  enabled: boolean;
  /** live set of objects that should be affected by selective bloom */
  selection: Set<Object3D>;
  register: (obj: Object3D | null | undefined) => void;
  unregister: (obj: Object3D | null | undefined) => void;
};

const Ctx = createContext<BloomCtx | null>(null);

export function BloomProvider({ enabled, children }: { enabled: boolean; children: React.ReactNode }): React.ReactElement {
  // Keep selection set instance stable across renders
  const selectionRef = useRef<Set<Object3D>>(new Set());

  const value = useMemo<BloomCtx>(() => ({
    enabled,
    selection: selectionRef.current,
    register: (obj) => {
      if (obj) selectionRef.current.add(obj);
    },
    unregister: (obj) => {
      if (obj) selectionRef.current.delete(obj);
    },
  }), [enabled]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useBloomContext(): BloomCtx | null {
  return useContext(Ctx);
}

export function useBloomRegistration<T extends Object3D>(ref: React.RefObject<T | null>, active: boolean = true): void {
  const ctx = useBloomContext();
  React.useEffect(() => {
    const obj = ref.current;
    if (!active || !ctx) return;
    if (obj) ctx.register(obj);
    return () => {
      if (obj && ctx) ctx.unregister(obj);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ref?.current, active, ctx]);
}
