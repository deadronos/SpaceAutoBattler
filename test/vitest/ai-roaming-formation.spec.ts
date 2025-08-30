import { describe, test, expect, beforeEach } from 'vitest';
import { createInitialState, spawnShip, simulateStep } from '../../src/core/gameState.js';
import { AIController } from '../../src/core/aiController.js';
import type { GameState } from '../../src/types/index.js';

describe('AI Roaming and Formation Systems', () => {
  let gameState: GameState;
  let aiController: AIController;

  beforeEach(() => {
    gameState = createInitialState('test-seed-roaming-formation');
    aiController = new AIController(gameState);
    
    // Ensure AI is enabled and configure for testing
    gameState.behaviorConfig!.globalSettings.aiEnabled = true;
    gameState.behaviorConfig!.globalSettings.roamingAnchorMinSeparation = 150;
    
    // Disable interfering features for focused testing
    gameState.behaviorConfig!.globalSettings.enableScoutBehavior = false;
    gameState.behaviorConfig!.globalSettings.enableAlarmSystem = false;
  });

  describe('Roaming Anchor Assignment', () => {
    test('ships in roaming mode should get distinct anchors with minimum separation', () => {
      // Spawn several ships near each other
      const ships = [];
      for (let i = 0; i < 4; i++) {
        const ship = spawnShip(gameState, 'red', 'fighter', {
          x: 100 + i * 20, // Close together
          y: 100,
          z: 100
        });
        ships.push(ship);
      }

      // Set all fighters to roaming mode
      gameState.behaviorConfig!.shipPersonalities.fighter = {
        ...gameState.behaviorConfig!.shipPersonalities.fighter!,
        mode: 'roaming'
      };

      // Force intent reevaluation by advancing time
      gameState.time = 10;

      // Step the simulation to trigger AI updates
      for (let i = 0; i < 10; i++) {
        aiController.updateAllShips(0.1);
        simulateStep(gameState, 0.1);
      }

      // Collect assigned roaming anchors
      const anchors = ships
        .map(ship => ship.aiState?.roamingAnchor)
        .filter(anchor => anchor !== undefined);

      // Should have anchors assigned
      expect(anchors.length).toBeGreaterThan(0);

      // Check minimum separation between anchors
      const minSeparation = gameState.behaviorConfig!.globalSettings.roamingAnchorMinSeparation;
      for (let i = 0; i < anchors.length; i++) {
        for (let j = i + 1; j < anchors.length; j++) {
          const anchor1 = anchors[i]!;
          const anchor2 = anchors[j]!;
          const distance = Math.sqrt(
            Math.pow(anchor1.x - anchor2.x, 2) +
            Math.pow(anchor1.y - anchor2.y, 2) +
            Math.pow(anchor1.z - anchor2.z, 2)
          );
          expect(distance).toBeGreaterThanOrEqual(minSeparation);
        }
      }
    });

    test('roaming anchors should be released when ships leave roaming mode', () => {
      // Spawn a ship in roaming mode
      const ship = spawnShip(gameState, 'red', 'fighter', { x: 100, y: 100, z: 100 });
      
      // Set to roaming mode
      gameState.behaviorConfig!.shipPersonalities.fighter = {
        ...gameState.behaviorConfig!.shipPersonalities.fighter!,
        mode: 'roaming'
      };

      // Force intent reevaluation
      gameState.time = 10;

      // Step simulation to assign anchor
      for (let i = 0; i < 10; i++) {
        aiController.updateAllShips(0.1);
        simulateStep(gameState, 0.1);
      }

      // Should have anchor assigned
      expect(ship.aiState?.roamingAnchor).toBeDefined();

      // Change to aggressive mode (non-roaming)
      gameState.behaviorConfig!.shipPersonalities.fighter = {
        ...gameState.behaviorConfig!.shipPersonalities.fighter!,
        mode: 'aggressive'
      };

      // Force intent reevaluation by advancing time
      gameState.time += 10;
      
      // Step simulation to trigger cleanup
      aiController.updateAllShips(0.1);

      // Anchor should be released
      expect(ship.aiState?.roamingAnchor).toBeUndefined();
    });
  });

  describe('Formation Slot Assignment', () => {
    test('ships forming up should get unique slot indices and positions', () => {
      // Create a formation scenario with 4 ships
      const ships = [];
      for (let i = 0; i < 4; i++) {
        const ship = spawnShip(gameState, 'red', 'frigate', {
          x: 200 + i * 30,
          y: 200,
          z: 200
        });
        ships.push(ship);
      }

      // Set to formation mode
      gameState.behaviorConfig!.shipPersonalities.frigate = {
        ...gameState.behaviorConfig!.shipPersonalities.frigate!,
        mode: 'formation'
      };

      // Force intent reevaluation
      gameState.time = 10;

      // Step simulation to trigger formation assignment
      for (let i = 0; i < 15; i++) {
        aiController.updateAllShips(0.1);
        simulateStep(gameState, 0.1);
      }

      // Check that ships have formation data assigned
      const formationShips = ships.filter(ship => 
        ship.aiState?.formationId && 
        ship.aiState?.formationSlotIndex !== undefined &&
        ship.aiState?.formationPosition
      );

      expect(formationShips.length).toBeGreaterThan(0);

      // Verify slot indices are unique
      const slotIndices = formationShips.map(ship => ship.aiState!.formationSlotIndex!);
      const uniqueSlotIndices = new Set(slotIndices);
      expect(uniqueSlotIndices.size).toBe(slotIndices.length);

      // Verify formation positions are different
      const positions = formationShips.map(ship => ship.aiState!.formationPosition!);
      for (let i = 0; i < positions.length; i++) {
        for (let j = i + 1; j < positions.length; j++) {
          const pos1 = positions[i];
          const pos2 = positions[j];
          const distance = Math.sqrt(
            Math.pow(pos1.x - pos2.x, 2) +
            Math.pow(pos1.y - pos2.y, 2) +
            Math.pow(pos1.z - pos2.z, 2)
          );
          // Formation positions should be separated by at least formation spacing / 2
          expect(distance).toBeGreaterThan(40); // Half of typical formation spacing
        }
      }
    });

    test('ships should maintain formation positions for stability', () => {
      // Create ships in formation
      const ships = [];
      for (let i = 0; i < 3; i++) {
        const ship = spawnShip(gameState, 'blue', 'frigate', {
          x: 300 + i * 25,
          y: 300,
          z: 300
        });
        gameState.behaviorConfig!.shipPersonalities.frigate = {
          ...gameState.behaviorConfig!.shipPersonalities.frigate!,
          mode: 'formation'
        };
        ships.push(ship);
      }

      // Step simulation to establish formation
      for (let i = 0; i < 10; i++) {
        aiController.updateAllShips(0.1);
        simulateStep(gameState, 0.1);
      }

      // Record initial formation assignments
      const initialAssignments = ships.map(ship => ({
        slotIndex: ship.aiState?.formationSlotIndex,
        position: ship.aiState?.formationPosition ? { ...ship.aiState.formationPosition } : null
      }));

      // Continue simulation for several more steps
      for (let i = 0; i < 10; i++) {
        aiController.updateAllShips(0.1);
        simulateStep(gameState, 0.1);
      }

      // Check that assignments remained stable
      ships.forEach((ship, index) => {
        expect(ship.aiState?.formationSlotIndex).toBe(initialAssignments[index].slotIndex);
        if (initialAssignments[index].position && ship.aiState?.formationPosition) {
          const initialPos = initialAssignments[index].position!;
          const currentPos = ship.aiState.formationPosition;
          expect(Math.abs(currentPos.x - initialPos.x)).toBeLessThan(1);
          expect(Math.abs(currentPos.y - initialPos.y)).toBeLessThan(1);
          expect(Math.abs(currentPos.z - initialPos.z)).toBeLessThan(1);
        }
      });
    });

    test('formation and roaming systems work independently', () => {
      // Test that the systems can coexist
      // Create formation ships
      const formationShips = [];
      for (let i = 0; i < 3; i++) {
        const ship = spawnShip(gameState, 'red', 'frigate', { 
          x: 400 + i * 25, 
          y: 400, 
          z: 400 
        });
        formationShips.push(ship);
      }
      
      // Create roaming ship
      const roamingShip = spawnShip(gameState, 'red', 'fighter', { x: 500, y: 500, z: 500 });
      
      // Set different modes
      gameState.behaviorConfig!.shipPersonalities.frigate = {
        ...gameState.behaviorConfig!.shipPersonalities.frigate!,
        mode: 'formation'
      };
      
      gameState.behaviorConfig!.shipPersonalities.fighter = {
        ...gameState.behaviorConfig!.shipPersonalities.fighter!,
        mode: 'roaming'
      };

      // Force intent reevaluation
      gameState.time = 10;

      // Step simulation
      for (let i = 0; i < 15; i++) {
        aiController.updateAllShips(0.1);
        simulateStep(gameState, 0.1);
      }

      // Check that both systems are working
      // Formation ships should have formation data
      const formationShipsWithFormation = formationShips.filter(ship => ship.aiState?.formationId);
      expect(formationShipsWithFormation.length).toBeGreaterThan(0);
      
      // Roaming ship should have roaming anchor
      expect(roamingShip.aiState?.roamingAnchor).toBeDefined();
      
      // Systems should not interfere with each other
      expect(roamingShip.aiState?.formationId).toBeUndefined();
      formationShipsWithFormation.forEach(ship => {
        expect(ship.aiState?.roamingAnchor).toBeUndefined();
      });
    });
  });
});