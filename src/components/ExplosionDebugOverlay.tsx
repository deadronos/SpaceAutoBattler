import React from 'react';
import { useOptionalGameState } from '../game/context.js';
import { useUiStore } from '../game/uiStore.js';
import { getExplosionConfig } from '../config/explosions.js';
import type { ShipHull } from '../types/index.js';

export function ExplosionDebugOverlay(): React.ReactElement | null {
  const state = useOptionalGameState();
  const debugEnabled = useUiStore((s) => s.explosionDebugEnabled);

  if (!debugEnabled || !state) return null;

  const activeExplosions = state.explosions;
  
  return (
    <div className="explosion-debug-overlay" style={{
      position: 'absolute',
      top: '80px',
      right: '10px',
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      color: 'white',
      padding: '10px',
      borderRadius: '5px',
      fontSize: '12px',
      fontFamily: 'monospace',
      maxWidth: '300px',
      zIndex: 1000,
    }}>
      <h4 style={{ margin: '0 0 10px 0', color: '#ffa500' }}>Explosion Debug</h4>
      
      <div style={{ marginBottom: '10px' }}>
        <strong>Active Explosions:</strong> {activeExplosions.length} / 48
      </div>

      {activeExplosions.length > 0 && (
        <div style={{ marginBottom: '10px' }}>
          <strong>Recent Events:</strong>
          {activeExplosions.slice(-3).map((event, idx) => (
            <div key={event.id} style={{ 
              marginLeft: '10px', 
              padding: '5px', 
              backgroundColor: 'rgba(255, 255, 255, 0.1)',
              marginTop: '5px',
              borderRadius: '3px' 
            }}>
              <div><strong>#{event.id}</strong> {event.faction} {event.hull}</div>
              <div>Duration: {event.duration.toFixed(2)}s (elapsed: {event.elapsed.toFixed(2)}s)</div>
              <div>Light: {event.lightDuration.toFixed(2)}s (elapsed: {event.lightElapsed.toFixed(2)}s)</div>
              <div>Shockwave: {event.shockwave.delay.toFixed(2)}s + {event.shockwave.duration.toFixed(2)}s</div>
              <div>Fireball: {event.fireball.delay.toFixed(2)}s + {event.fireball.duration.toFixed(2)}s</div>
            </div>
          ))}
        </div>
      )}

      <div>
        <strong>Config Samples:</strong>
        <ConfigSample faction="alliance" hull="fighter" />
        <ConfigSample faction="ravers" hull="carrier" />
      </div>
    </div>
  );
}

function ConfigSample({ faction, hull }: { faction: 'alliance' | 'ravers'; hull: ShipHull }): React.ReactElement {
  const config = getExplosionConfig(faction, hull);
  
  return (
    <div style={{ 
      marginLeft: '10px', 
      marginTop: '5px', 
      padding: '5px',
      backgroundColor: 'rgba(255, 255, 255, 0.05)',
      borderRadius: '3px' 
    }}>
      <div style={{ color: faction === 'alliance' ? '#a6d8ff' : '#ffb347' }}>
        <strong>{faction} {hull}</strong>
      </div>
      <div>Duration: {config.timing.duration}s</div>
      <div>Light: {config.timing.lightDuration}s</div>
      <div>Flash Intensity: {config.flashIntensity}</div>
      <div>Debris: {config.debrisCount} @ {config.timing.debrisSpeed[0]}-{config.timing.debrisSpeed[1]}</div>
    </div>
  );
}

export default ExplosionDebugOverlay;