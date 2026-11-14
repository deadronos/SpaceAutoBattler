import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test';
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import RingDebugPanel from '../../src/debug/RingDebugPanel.js';

interface TestDebugWindow extends Window {
  __copilotDebugForce?: boolean;
  __copilot_ringMaterial?: {
    uniforms: {
      uShadowStrength: { value: number };
      uPenumbra: { value: number };
    };
    needsUpdate?: boolean;
  };
}

describe('RingDebugPanel conditional rendering', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    const win = window as TestDebugWindow;
    delete win.__copilotDebugForce;
    delete win.__copilot_ringMaterial;
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    cleanup();
    const win = window as TestDebugWindow;
    delete win.__copilotDebugForce;
    delete win.__copilot_ringMaterial;
    consoleErrorSpy.mockRestore();
  });

  it('toggles between disabled and enabled without Rules-of-Hooks errors', () => {
    const win = window as TestDebugWindow;
    win.__copilotDebugForce = false;

    const { rerender, container } = render(<RingDebugPanel />);
    expect(container.firstChild).toBeNull();
    expect(screen.queryByText('Ring Debug')).toBeNull();

    win.__copilotDebugForce = true;
    rerender(<RingDebugPanel />);
    expect(screen.getByText('Ring Debug')).toBeDefined();

    win.__copilotDebugForce = false;
    rerender(<RingDebugPanel />);
    expect(container.firstChild).toBeNull();

    win.__copilotDebugForce = true;
    rerender(<RingDebugPanel />);
    expect(screen.getByText('Ring Debug')).toBeDefined();

    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  it('updates ring material uniforms when enabled and sliders change', () => {
    const win = window as TestDebugWindow;
    const mat = {
      uniforms: {
        uShadowStrength: { value: 0.6 },
        uPenumbra: { value: 0.04 },
      },
      needsUpdate: false,
    };
    win.__copilot_ringMaterial = mat;
    win.__copilotDebugForce = true;

    render(<RingDebugPanel />);

    const sliders = screen.getAllByRole('slider');
    expect(sliders).toHaveLength(2);

    fireEvent.change(sliders[0], { target: { value: '0.85' } });
    expect(mat.uniforms.uShadowStrength.value).toBeCloseTo(0.85, 5);
    expect(mat.needsUpdate).toBe(true);
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });
});
