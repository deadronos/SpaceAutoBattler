import { describe, expect, it } from 'vite-plus/test';
import { useUiStore } from '../../src/app/uiStore.js';
import { AI_CONFIG } from '../../src/game/config.js';
import { SETTINGS_TOGGLES } from '../../src/components/hudToggleConfig.js';

describe('uiStore defaults', () => {
  it('enables postprocessing by default', () => {
    const snapshot = useUiStore.getState();
    expect(snapshot.postprocessingEnabled).toBe(true);
  });

  it('respects AI config default and defaults to enabled', () => {
    const snapshot = useUiStore.getState();
    expect(snapshot.aiV2Enabled).toBe(AI_CONFIG.v2Enabled);
    expect(snapshot.aiV2Enabled).toBe(true);
  });

  it('defaults ship follow off with no selection', () => {
    const snapshot = useUiStore.getState();
    expect(snapshot.selectedShipId).toBeNull();
    expect(snapshot.cameraFollowEnabled).toBe(false);
  });

  it('selects, toggles, and clears ship follow state', () => {
    useUiStore.getState().selectShip(42);
    expect(useUiStore.getState().selectedShipId).toBe(42);

    useUiStore.getState().toggleCameraFollow();
    expect(useUiStore.getState().cameraFollowEnabled).toBe(true);
    useUiStore.getState().toggleCameraFollow();
    expect(useUiStore.getState().cameraFollowEnabled).toBe(false);

    useUiStore.getState().setCameraFollowEnabled(true);
    expect(useUiStore.getState().cameraFollowEnabled).toBe(true);
    useUiStore.getState().setCameraFollowEnabled(false);

    useUiStore.getState().selectShip(null);
    expect(useUiStore.getState().selectedShipId).toBeNull();
  });

  it('exposes a camera-follow toggle disabled without a selection', () => {
    const toggle = SETTINGS_TOGGLES.find((entry) => entry.id === 'camera-follow');
    expect(toggle).toBeDefined();
    expect(toggle?.select(useUiStore.getState())).toBe(false);
    expect(toggle?.disabled?.(useUiStore.getState())).toBe(true);

    useUiStore.setState({ selectedShipId: 7, cameraFollowEnabled: true });
    expect(toggle?.select(useUiStore.getState())).toBe(true);
    expect(toggle?.disabled?.(useUiStore.getState())).toBe(false);
    useUiStore.setState({ selectedShipId: null, cameraFollowEnabled: false });
  });
});
