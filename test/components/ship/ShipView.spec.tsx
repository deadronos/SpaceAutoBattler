import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test';
import React from 'react';
import { cleanup, render } from '@testing-library/react';
import { BoxGeometry, Group, Mesh, MeshBasicMaterial, Quaternion, Vector3 } from 'three';
import type { ShipEntity } from '../../../src/types/index.js';
import type { HullMaterial } from '../../../src/components/ship/ShipModel.js';
import { ShipView } from '../../../src/components/ship/ShipView.js';
import { useUiStore } from '../../../src/app/uiStore.js';

vi.mock('@react-three/fiber', () => ({
  useFrame: vi.fn(),
}));

const shieldBubbleCalls: Array<{ radius?: number; hasHullMaterialsRef: boolean }> = [];

vi.mock('../../../src/components/ship/ShipShield.js', () => ({
  SHIELD_RENDER_ORDER: 20,
  ShieldBubble: (props: { radius?: number; hullMaterialsRef?: unknown }) => {
    shieldBubbleCalls.push({
      radius: props.radius,
      hasHullMaterialsRef: props.hullMaterialsRef !== undefined,
    });
    return null;
  },
}));

function createTestShip(team: 'blue' | 'red' = 'blue'): ShipEntity {
  return {
    id: 42,
    transform: {
      position: new Vector3(),
      rotation: new Quaternion(),
      scale: 1,
    },
    ship: {
      team,
      hull: 'fighter',
      hp: 100,
      maxHp: 100,
      shield: 50,
      maxShield: 50,
      cooldown: 0,
      fireRate: 1,
      damage: 10,
      projectileSpeed: 20,
      range: 50,
      speed: 10,
      xp: 0,
      level: 1,
      xpToNext: 100,
      damageType: 'kinetic',
      levelBonuses: {},
      subsystems: {},
      armor: 0,
      velocity: new Vector3(),
      angularVelocity: new Vector3(),
      motion: {
        mass: 1,
        maxSpeed: 10,
        linearAcceleration: 5,
        linearDamping: 1,
        maxTurnRate: 2,
        angularAcceleration: 2,
        angularDamping: 1,
      },
    },
  } as unknown as ShipEntity;
}

describe('ShipView conditional model vs fallback rendering', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    shieldBubbleCalls.length = 0;
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    cleanup();
    useUiStore.setState({ selectedShipId: null });
    consoleErrorSpy.mockRestore();
  });

  it('toggles between fallback cone and loaded GLTF scene without hook-order errors', () => {
    const groupRef = React.createRef<Group | null>();
    const visualRef = React.createRef<Group | null>();
    const hullMaterialsRef: React.RefObject<HullMaterial[]> = { current: [] };

    const loadedScene = new Group();
    loadedScene.add(new Mesh(new BoxGeometry(2, 2, 2), new MeshBasicMaterial()));

    const blueShip = createTestShip('blue');
    const redShip = createTestShip('red');

    // Start in fallback mode (scene = null, hasValidPath = false)
    const { rerender, container } = render(
      <ShipView
        entity={blueShip}
        groupRef={groupRef}
        visualRef={visualRef}
        scene={null}
        hasValidPath={false}
        hullMaterialsRef={hullMaterialsRef}
      />,
    );
    expect(container.querySelector('conegeometry')).not.toBeNull();
    expect(shieldBubbleCalls.at(-1)?.hasHullMaterialsRef).toBe(false);

    // Transition to loaded GLTF scene (previously triggered fewer-hooks crash)
    rerender(
      <ShipView
        entity={blueShip}
        groupRef={groupRef}
        visualRef={visualRef}
        scene={loadedScene}
        hasValidPath={true}
        hullMaterialsRef={hullMaterialsRef}
      />,
    );
    expect(container.querySelector('primitive')).not.toBeNull();
    expect(container.querySelector('conegeometry')).toBeNull();
    expect(shieldBubbleCalls.at(-1)?.hasHullMaterialsRef).toBe(true);

    // Transition back to fallback mode with red team
    rerender(
      <ShipView
        entity={redShip}
        groupRef={groupRef}
        visualRef={visualRef}
        scene={null}
        hasValidPath={false}
        hullMaterialsRef={hullMaterialsRef}
      />,
    );
    expect(container.querySelector('conegeometry')).not.toBeNull();
    expect(shieldBubbleCalls.at(-1)?.hasHullMaterialsRef).toBe(false);

    // And back to loaded GLTF scene again
    rerender(
      <ShipView
        entity={redShip}
        groupRef={groupRef}
        visualRef={visualRef}
        scene={loadedScene}
        hasValidPath={true}
        hullMaterialsRef={hullMaterialsRef}
      />,
    );
    expect(container.querySelector('primitive')).not.toBeNull();
    expect(shieldBubbleCalls.at(-1)?.hasHullMaterialsRef).toBe(true);

    const hookErrors = consoleErrorSpy.mock.calls.filter((call) =>
      String(call[0]).toLowerCase().includes('hook'),
    );
    expect(hookErrors).toHaveLength(0);
  });

  it('renders a lightweight 3D selection ring only when the entity is selected', () => {
    const groupRef = React.createRef<Group | null>();
    const visualRef = React.createRef<Group | null>();
    const hullMaterialsRef: React.RefObject<HullMaterial[]> = { current: [] };
    const ship = createTestShip('blue');

    useUiStore.setState({ selectedShipId: null });
    const { rerender, container } = render(
      <ShipView
        entity={ship}
        groupRef={groupRef}
        visualRef={visualRef}
        scene={null}
        hasValidPath={false}
        hullMaterialsRef={hullMaterialsRef}
      />,
    );
    expect(container.querySelector('ringgeometry')).toBeNull();

    useUiStore.setState({ selectedShipId: ship.id });
    rerender(
      <ShipView
        entity={ship}
        groupRef={groupRef}
        visualRef={visualRef}
        scene={null}
        hasValidPath={false}
        hullMaterialsRef={hullMaterialsRef}
      />,
    );
    expect(container.querySelector('ringgeometry')).not.toBeNull();

    useUiStore.setState({ selectedShipId: ship.id + 1 });
    rerender(
      <ShipView
        entity={ship}
        groupRef={groupRef}
        visualRef={visualRef}
        scene={null}
        hasValidPath={false}
        hullMaterialsRef={hullMaterialsRef}
      />,
    );
    expect(container.querySelector('ringgeometry')).toBeNull();

    const hookErrors = consoleErrorSpy.mock.calls.filter((call) =>
      String(call[0]).toLowerCase().includes('hook'),
    );
    expect(hookErrors).toHaveLength(0);
  });
});
