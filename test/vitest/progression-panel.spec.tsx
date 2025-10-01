import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { act } from 'react-dom/test-utils';
import type { GameState, ShipEntity, ProgressionEvent } from '../../src/types/index.js';
import { ProgressionPanel } from '../../src/components/ProgressionPanel.js';
import { GameProvider } from '../../src/game/context.js';
import { useUiStore } from '../../src/game/uiStore.js';
import { createProgressionDefaults } from '../../src/game/progression.js';
import { createTestGameState } from './helpers/fixtures.js';

// Inject a mockable GameState into ProgressionPanel by mocking game context hooks/provider locally
let __injectedGameState: GameState | null = null;
vi.mock('../../src/game/context.js', async (importOriginal) => {
  const actual = await importOriginal<any>();
  return {
    ...actual,
    // Pass-through provider to avoid creating a real GameState in tests
    GameProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    // Return the injected GameState for components under test
    useOptionalGameState: () => __injectedGameState,
  };
});

// Mock GameState for testing
function createMockGameState(): GameState {
  const mockShips: ShipEntity[] = [
    {
      id: 1,
      rigidBody: { setNextKinematicTranslation: () => {}, setNextKinematicRotation: () => {} } as any,
      collider: {} as any,
      ship: {
        team: 'blue',
        hull: 'fighter',
        hp: 100,
        maxHp: 100,
        shield: 50,
        maxShield: 50,
        cooldown: 0,
        fireRate: 1,
        damage: 10,
        projectileSpeed: 100,
        range: 200,
        speed: 50,
        velocity: { x: 0, y: 0, z: 0 } as any,
        angularVelocity: { x: 0, y: 0, z: 0 } as any,
        lateralAcceleration: 0,
        motion: {} as any,
        ...createProgressionDefaults('fighter'),
        xp: 150,
        level: 2,
        xpToNext: 50,
      },
      transform: {
        position: { x: 0, y: 0, z: 0 } as any,
        rotation: { x: 0, y: 0, z: 0, w: 1 } as any,
        scale: 1,
      },
    },
    {
      id: 2,
      rigidBody: { setNextKinematicTranslation: () => {}, setNextKinematicRotation: () => {} } as any,
      collider: {} as any,
      ship: {
        team: 'red',
        hull: 'destroyer',
        hp: 200,
        maxHp: 200,
        shield: 100,
        maxShield: 100,
        cooldown: 0,
        fireRate: 0.5,
        damage: 25,
        projectileSpeed: 80,
        range: 300,
        speed: 30,
        velocity: { x: 0, y: 0, z: 0 } as any,
        angularVelocity: { x: 0, y: 0, z: 0 } as any,
        lateralAcceleration: 0,
        motion: {} as any,
        ...createProgressionDefaults('destroyer'),
        xp: 75,
        level: 1,
        xpToNext: 125,
      },
      transform: {
        position: { x: 100, y: 0, z: 0 } as any,
        rotation: { x: 0, y: 0, z: 0, w: 1 } as any,
        scale: 1,
      },
    },
  ];

  const progressionEvents = new Map<number, ProgressionEvent[]>();
  progressionEvents.set(1, [
    {
      ts: Date.now() - 5000,
      type: 'damage',
      deltaXp: 10,
      details: '15.0 damage dealt'
    },
    {
      ts: Date.now() - 3000,
      type: 'kill',
      deltaXp: 50,
      details: 'Enemy destroyed (100 HP)'
    },
    {
      ts: Date.now() - 1000,
      type: 'levelup',
      details: 'Level 1 → 2'
    }
  ]);

  const base = createTestGameState({ queries: { ships: { entities: mockShips }, projectiles: { entities: [] }, turrets: { entities: [] } } });
  base.progressionEvents = progressionEvents;
  base.nextEntityId = 3;
  base.nextExplosionId = 1;
  base.time = 0;
  base.rng = { next: () => 0.5 } as any;
  base.ai = base.ai ?? ({} as any);
  base.blackboard = base.blackboard ?? ({} as any);
  base.uiFlags = { hudHealthBars: false };
  base.explosions = [];
  base.explosionPool = [];

  return base as GameState;
}

describe('ProgressionPanel', () => {
  beforeEach(() => {
    // Reset UI store state
    useUiStore.getState().setProgressionPanelEnabled(false);
    __injectedGameState = null;
  });

  it('renders null when disabled', () => {
    const mockState = createMockGameState();
    __injectedGameState = mockState;
    
    const { container } = render(
      <GameProvider>
        <ProgressionPanel />
      </GameProvider>
    );

    expect(container.firstChild).toBeNull();
  });

  it('renders progression panel when enabled', () => {
    const mockState = createMockGameState();
    __injectedGameState = mockState;
    
    // Enable the progression panel
    useUiStore.getState().setProgressionPanelEnabled(true);
    
    render(
      <GameProvider>
        <ProgressionPanel />
      </GameProvider>
    );

  expect(screen.getByText('Progression')).to.exist;
  expect(screen.getByText('2 ships tracked')).to.exist;
  });

  it('displays ships with correct information', () => {
    const mockState = createMockGameState();
    __injectedGameState = mockState;
    useUiStore.getState().setProgressionPanelEnabled(true);
    
    render(
      <GameProvider>
        <ProgressionPanel />
      </GameProvider>
    );

    // Check for ship names and levels
  expect(screen.getByText('fighter-1')).to.exist;
  expect(screen.getByText('Lv 2')).to.exist;
  expect(screen.getByText('destroyer-2')).to.exist;
  expect(screen.getByText('Lv 1')).to.exist;

    // Check for XP display
  expect(screen.getByText('150 / 50 XP')).to.exist;
  expect(screen.getByText('75 / 125 XP')).to.exist;
  });

  it('sorts ships by level then XP', () => {
    const mockState = createMockGameState();
    __injectedGameState = mockState;
    useUiStore.getState().setProgressionPanelEnabled(true);
    
    render(
      <GameProvider>
        <ProgressionPanel />
      </GameProvider>
    );

    const shipCards = screen.getAllByText(/Lv \d+/);
    // Level 2 ship (fighter) should come first, then Level 1 ship (destroyer)
  expect((shipCards[0] as HTMLElement).textContent).to.contain('Lv 2');
  expect((shipCards[1] as HTMLElement).textContent).to.contain('Lv 1');
  });

  it('displays progression events when ship is expanded', () => {
    const mockState = createMockGameState();
    __injectedGameState = mockState;
    useUiStore.getState().setProgressionPanelEnabled(true);
    
    render(
      <GameProvider>
        <ProgressionPanel />
      </GameProvider>
    );

    // Find and click the expand button for the first ship (fighter-1)
  const expandButtons = screen.getAllByLabelText(/Expand events|Collapse events/);
  fireEvent.click(expandButtons[0]);

    // Check for event details
  expect(screen.getByText('+10 XP')).to.exist;
  expect(screen.getByText('15.0 damage dealt')).to.exist;
  expect(screen.getByText('+50 XP')).to.exist;
  expect(screen.getByText('Enemy destroyed (100 HP)')).to.exist;
  expect(screen.getByText('Level 1 → 2')).to.exist;
  });

  it('does not change hooks order when toggling enabled without unmount', () => {
    const mockState = createMockGameState();
    __injectedGameState = mockState;

    // Start disabled and render
    useUiStore.getState().setProgressionPanelEnabled(false);
    render(
      <GameProvider>
        <ProgressionPanel />
      </GameProvider>
    );

    // Initially the panel should not be present
    expect(screen.queryByText('Progression')).toBeNull();

    // Toggle enabled without unmounting and assert no hook errors (React would throw if hooks order changed)
    act(() => {
      useUiStore.getState().setProgressionPanelEnabled(true);
    });

    // After enabling, the panel should render
    expect(screen.queryByText('Progression')).toBeTruthy();

    // Toggle back to disabled to ensure hooks remain stable across toggles
    act(() => {
      useUiStore.getState().setProgressionPanelEnabled(false);
    });

    expect(screen.queryByText('Progression')).toBeNull();
  });
});