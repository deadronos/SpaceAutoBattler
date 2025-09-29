import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { GameState, ShipEntity, ProgressionEvent } from '../../src/types/index.js';
import { ProgressionPanel } from '../../src/components/ProgressionPanel.js';
import { GameProvider } from '../../src/game/context.js';
import { useUiStore } from '../../src/game/uiStore.js';
import { createProgressionDefaults } from '../../src/game/progression.js';

// Mock GameState for testing
function createMockGameState(): GameState {
  const mockShips: ShipEntity[] = [
    {
      id: 1,
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

  return {
    queries: {
      ships: {
        entities: mockShips
      }
    },
    progressionEvents,
    // Add other required GameState fields as minimal mocks
    rapier: {} as any,
    physicsWorld: {} as any,
    eventQueue: {} as any,
    world: {} as any,
    colliderLookup: new Map(),
    nextEntityId: 3,
    nextExplosionId: 1,
    time: 0,
    rng: { next: () => 0.5 } as any,
    paused: false,
    timeScale: 1,
    simulation: {} as any,
    ai: {} as any,
    blackboard: {} as any,
    uiFlags: { hudHealthBars: false },
    explosions: [],
    explosionPool: [],
  } as GameState;
}

describe('ProgressionPanel', () => {
  beforeEach(() => {
    // Reset UI store state
    useUiStore.getState().setProgressionPanelEnabled(false);
  });

  it('renders null when disabled', () => {
    const mockState = createMockGameState();
    
    const { container } = render(
      <GameProvider value={mockState}>
        <ProgressionPanel />
      </GameProvider>
    );

    expect(container.firstChild).toBeNull();
  });

  it('renders progression panel when enabled', () => {
    const mockState = createMockGameState();
    
    // Enable the progression panel
    useUiStore.getState().setProgressionPanelEnabled(true);
    
    render(
      <GameProvider value={mockState}>
        <ProgressionPanel />
      </GameProvider>
    );

    expect(screen.getByText('Progression')).toBeInTheDocument();
    expect(screen.getByText('2 ships tracked')).toBeInTheDocument();
  });

  it('displays ships with correct information', () => {
    const mockState = createMockGameState();
    useUiStore.getState().setProgressionPanelEnabled(true);
    
    render(
      <GameProvider value={mockState}>
        <ProgressionPanel />
      </GameProvider>
    );

    // Check for ship names and levels
    expect(screen.getByText('fighter-1')).toBeInTheDocument();
    expect(screen.getByText('Lv 2')).toBeInTheDocument();
    expect(screen.getByText('destroyer-2')).toBeInTheDocument();
    expect(screen.getByText('Lv 1')).toBeInTheDocument();

    // Check for XP display
    expect(screen.getByText('150 / 50 XP')).toBeInTheDocument();
    expect(screen.getByText('75 / 125 XP')).toBeInTheDocument();
  });

  it('sorts ships by level then XP', () => {
    const mockState = createMockGameState();
    useUiStore.getState().setProgressionPanelEnabled(true);
    
    render(
      <GameProvider value={mockState}>
        <ProgressionPanel />
      </GameProvider>
    );

    const shipCards = screen.getAllByText(/Lv \d+/);
    // Level 2 ship (fighter) should come first, then Level 1 ship (destroyer)
    expect(shipCards[0]).toHaveTextContent('Lv 2');
    expect(shipCards[1]).toHaveTextContent('Lv 1');
  });

  it('displays progression events when ship is expanded', () => {
    const mockState = createMockGameState();
    useUiStore.getState().setProgressionPanelEnabled(true);
    
    render(
      <GameProvider value={mockState}>
        <ProgressionPanel />
      </GameProvider>
    );

    // Find and click the expand button for the first ship (fighter-1)
    const expandButtons = screen.getAllByLabelText(/Expand events|Collapse events/);
    expandButtons[0].click();

    // Check for event details
    expect(screen.getByText('+10 XP')).toBeInTheDocument();
    expect(screen.getByText('15.0 damage dealt')).toBeInTheDocument();
    expect(screen.getByText('+50 XP')).toBeInTheDocument();
    expect(screen.getByText('Enemy destroyed (100 HP)')).toBeInTheDocument();
    expect(screen.getByText('Level 1 → 2')).toBeInTheDocument();
  });
});