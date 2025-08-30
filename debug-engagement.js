// Debug script to test ship engagement
import('./dist/bundled.js').then(({ gameState }) => {
  const { createInitialState, spawnShip, simulateStep } = gameState;
  
  const state = createInitialState('debug-engagement');

  // Enable AI
  state.behaviorConfig.globalSettings.aiEnabled = true;

  // Spawn two opposing ships close to each other
  const redShip = spawnShip(state, 'red', 'fighter', { x: 200, y: 200, z: 200 });
  const blueShip = spawnShip(state, 'blue', 'fighter', { x: 400, y: 200, z: 200 }); // 200 units apart

  console.log('Initial state:');
  console.log(`Red ship (${redShip.id}): pos=${JSON.stringify(redShip.pos)}, targetId=${redShip.targetId}`);
  console.log(`Blue ship (${blueShip.id}): pos=${JSON.stringify(blueShip.pos)}, targetId=${blueShip.targetId}`);

  // Simulate for a few steps
  for (let i = 0; i < 10; i++) {
    state.time += 0.1;
    state.tick++;
    simulateStep(state, 0.1);
    
    console.log(`\nStep ${i + 1}:`);
    console.log(`Red ship: pos=(${redShip.pos.x.toFixed(1)}, ${redShip.pos.y.toFixed(1)}, ${redShip.pos.z.toFixed(1)}), target=${redShip.targetId}, intent=${redShip.aiState?.currentIntent}, health=${redShip.health}`);
    console.log(`Blue ship: pos=(${blueShip.pos.x.toFixed(1)}, ${blueShip.pos.y.toFixed(1)}, ${blueShip.pos.z.toFixed(1)}), target=${blueShip.targetId}, intent=${blueShip.aiState?.currentIntent}, health=${blueShip.health}`);
    console.log(`Distance: ${Math.hypot(redShip.pos.x - blueShip.pos.x, redShip.pos.y - blueShip.pos.y, redShip.pos.z - blueShip.pos.z).toFixed(1)}`);
    console.log(`Bullets: ${state.bullets.length}`);
  }
}).catch(console.error);