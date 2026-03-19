import React, { useEffect, useState } from 'react';
import type { ShaderMaterial } from 'three';
import './debugPanel.css';
import { isCopilotDebugEnabled } from '../utils/copilotDebug.js';
import type { PlanetRingsUniforms } from '../types/renderer.js';

// Debug window interface for ring material access
interface CopilotDebugWindow extends Window {
  __copilot_ringMaterial?: ShaderMaterial & { uniforms: PlanetRingsUniforms };
}

// Minimal dev-only overlay for tweaking ring shadow and penumbra.
// Automatically reads/writes values from `window.__copilot_ringMaterial` if available.
export default function RingDebugPanel(): React.ReactElement | null {
  // Only render when copilot_debug=1 is present or in non-production
  const enabled = isCopilotDebugEnabled();
  if (!enabled) return null;

  const debugWindow = typeof window !== 'undefined' ? (window as CopilotDebugWindow) : null;
  const mat = debugWindow?.__copilot_ringMaterial ?? null;

  const initialShadow = mat?.uniforms?.uShadowStrength?.value ?? 0.6;
  const initialPenumbra = mat?.uniforms?.uPenumbra?.value ?? 0.04;

  const [shadow, setShadow] = useState<number>(initialShadow);
  const [penumbra, setPenumbra] = useState<number>(initialPenumbra);

  useEffect(() => {
    const m = (window as CopilotDebugWindow).__copilot_ringMaterial;
    if (!m || !m.uniforms) return;
    try {
      m.uniforms.uShadowStrength.value = shadow;
      m.uniforms.uPenumbra.value = penumbra;
      try {
        m.needsUpdate = true;
      } catch {
        /* ignore */
      }
    } catch {
      /* ignore */
    }
  }, [shadow, penumbra]);

  return (
    <div className="copilot-debug-panel">
      <h4>Ring Debug</h4>
      <label>
        Shadow strength: {shadow.toFixed(2)}
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={shadow}
          onChange={(e) => setShadow(Number(e.target.value))}
        />
      </label>
      <label>
        Penumbra (fraction of planet radius): {penumbra.toFixed(3)}
        <input
          type="range"
          min={0}
          max={0.2}
          step={0.001}
          value={penumbra}
          onChange={(e) => setPenumbra(Number(e.target.value))}
        />
      </label>
      <div className="copilot-debug-hint">
        Use <code>?copilot_debug=1</code> to enable this panel.
      </div>
    </div>
  );
}
