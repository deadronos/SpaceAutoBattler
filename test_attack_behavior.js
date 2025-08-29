// Simple test to check if ships are attacking properly
import { createInitialState, spawnShip, stepGame } from './src/core/gameState.js';

const state = createInitialState('test-attack');
state.running = true;

// Spawn two opposing ships close to each other
const redShip = spawnShip(state, 'red', 'fighter', { x: 200, y: 200, z: 200 });
const blueShip = spawnShip(state, 'blue', 'fighter', { x: 300, y: 200, z: 200 });

console.log('Initial setup:');
console.log(`Red ship: pos=(${redShip.pos.x}, ${redShip.pos.y}, ${redShip.pos.z}), intent=${redShip.aiState?.currentIntent || 'none'}`);
console.log(`Blue ship: pos=(${blueShip.pos.x}, ${blueShip.pos.y}, ${blueShip.pos.z}), intent=${blueShip.aiState?.currentIntent || 'none'}`);
console.log('Distance:', Math.sqrt((redShip.pos.x - blueShip.pos.x)**2 + (redShip.pos.y - blueShip.pos.y)**2 + (redShip.pos.z - blueShip.pos.z)**2));

// Step the game for several iterations to see what happens
for (let i = 0; i < 50; i++) {
  stepGame(state, 0.1); // 100ms steps
  
  if (i % 10 === 0) {
    console.log(`\nStep ${i}:`);
    console.log(`Red ship: pos=(${redShip.pos.x.toFixed(1)}, ${redShip.pos.y.toFixed(1)}, ${redShip.pos.z.toFixed(1)}), intent=${redShip.aiState?.currentIntent || 'none'}, health=${redShip.health}, recentDamage=${redShip.aiState?.recentDamage || 0}`);
    console.log(`Blue ship: pos=(${blueShip.pos.x.toFixed(1)}, ${blueShip.pos.y.toFixed(1)}, ${blueShip.pos.z.toFixed(1)}), intent=${blueShip.aiState?.currentIntent || 'none'}, health=${blueShip.health}, recentDamage=${blueShip.aiState?.recentDamage || 0}`);
    console.log(`Bullets in game: ${state.bullets.length}`);
    
    const distance = Math.sqrt((redShip.pos.x - blueShip.pos.x)**2 + (redShip.pos.y - blueShip.pos.y)**2 + (redShip.pos.z - blueShip.pos.z)**2);
    console.log(`Distance: ${distance.toFixed(1)}`);
  }
}