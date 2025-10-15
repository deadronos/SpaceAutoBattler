import React from 'react';
import { Vector3, Color, CanvasTexture } from 'three';
import { Line } from '@react-three/drei';
import type { Archetype, BeamVisualEntity, GameEntity } from '../../types/index.js';
import { useArchetypeEntities } from '../../hooks/useArchetypeEntities.js';
import { TEAM_COLORS } from '../../config/renderer.js';
import { isCopilotDebugEnabled } from '../../utils/starDisk.js';
import { MAX_RENDER_BEAM_LENGTH, MIN_VISIBLE_BEAM_LENGTH } from '../layers/BeamVisualsInstancedLayer.js';

interface BeamDebugOverlayProps {
  archetype: Archetype<GameEntity, ['beamVisual']>;
}

const TMP_DIR = new Vector3();
const FWD = new Vector3(0, 0, 1);

function resolveDir(entity: BeamVisualEntity): Vector3 {
  const d = entity.direction;
  if (d && d.lengthSq() > 1e-6) return TMP_DIR.copy(d).normalize();
  return TMP_DIR.copy(FWD).applyQuaternion(entity.transform.rotation).normalize();
}

function resolveRenderLength(entity: BeamVisualEntity): number {
  const raw = Number.isFinite(entity.beamVisual.length) ? Math.max(0, entity.beamVisual.length) : 0;
  const len = Math.max(raw, MIN_VISIBLE_BEAM_LENGTH);
  return Math.min(len, MAX_RENDER_BEAM_LENGTH);
}

export function BeamDebugOverlay({ archetype }: BeamDebugOverlayProps): React.ReactElement | null {
  if (!isCopilotDebugEnabled()) return null;
  const beams = useArchetypeEntities<BeamVisualEntity>(archetype);
  if (beams.length === 0) return null;

  return (
    <group renderOrder={9999}>
      {beams.map((b) => {
        const start = b.transform.position;
        const dir = resolveDir(b);
        const length = resolveRenderLength(b);
        const end = new Vector3().copy(dir).multiplyScalar(length).add(start);
        const team = b.beamVisual.team ?? 'blue';
        const hex = (TEAM_COLORS as Record<string, string | undefined>)[team] ?? '#ffffff';
        const base = new Color(hex);
        const lineColor = base.clone().multiplyScalar(2.0);
        const markerColor = base.clone().multiplyScalar(1.5);
        const impact = b.beamVisual.impactPosition;
        const hasImpact = !!impact;
        const targetId = b.beamVisual.targetId;

        return (
          <group key={`beam-debug-${b.id}`}>
            <Line
              points={[start.clone(), end.clone()]}
              color={`#${lineColor.getHexString()}`}
              lineWidth={1}
              depthTest={false}
              transparent
              opacity={0.9}
            />
            <mesh position={start.clone()}>
              <sphereGeometry args={[0.25, 12, 12]} />
              <meshBasicMaterial color={`#${markerColor.getHexString()}`} depthTest={false} transparent opacity={0.85} />
            </mesh>
            <mesh position={end.clone()}>
              <sphereGeometry args={[0.25, 12, 12]} />
              <meshBasicMaterial color={`#${markerColor.getHexString()}`} depthTest={false} transparent opacity={0.85} />
            </mesh>
            {hasImpact ? (
              <group position={impact?.clone()}>
                {/* Impact ring */}
                <Line
                  points={Array.from({ length: 33 }, (_, i) => {
                    const t = (i / 32) * Math.PI * 2;
                    const r = Math.max(0.8, Math.min(2.5, length * 0.02));
                    return new Vector3(Math.cos(t) * r, 0, Math.sin(t) * r);
                  })}
                  closed
                  color={`#${markerColor.getHexString()}`}
                  lineWidth={1}
                  depthTest={false}
                  transparent
                  opacity={0.9}
                />
                {/* Target label */}
                {typeof targetId === 'number' ? (
                  <DebugSpriteLabel text={`id:${targetId}`} color={`#${lineColor.getHexString()}`} position={[0, 1.2, 0]} scale={0.8} />
                ) : null}
              </group>
            ) : null}
            {/* Ship-forward arrow to compare with locked beam direction */}
            <Line
              points={[start.clone(), start.clone().addScaledVector(new Vector3(0, 0, 1).applyQuaternion(b.transform.rotation), 5)]}
              color="#ffffff"
              lineWidth={1}
              depthTest={false}
              dashed
              dashSize={0.5}
              gapSize={0.3}
              transparent
              opacity={0.6}
            />
          </group>
        );
      })}
    </group>
  );
}

function DebugSpriteLabel({ text, color = '#ffffff', position = [0, 0, 0] as [number, number, number], scale = 1.0 }: { text: string; color?: string; position?: [number, number, number]; scale?: number }): React.ReactElement {
  const canvas = React.useMemo(() => {
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 128;
    const ctx = c.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, c.width, c.height);
      ctx.font = '28px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      // Outline for readability
      ctx.lineWidth = 6;
      ctx.strokeStyle = 'rgba(0,0,0,0.9)';
      ctx.strokeText(text, c.width / 2, c.height / 2);
      ctx.fillStyle = color;
      ctx.fillText(text, c.width / 2, c.height / 2);
    }
    return c;
  }, [text, color]);

  const texture = React.useMemo(() => new CanvasTexture(canvas), [canvas]);
  React.useEffect(() => () => texture.dispose(), [texture]);

  const w = 2.2 * scale;
  const h = 1.1 * scale;
  return (
    <sprite position={position} scale={[w, h, 1]}> 
      <spriteMaterial map={texture} depthTest={false} transparent opacity={0.95} />
    </sprite>
  );
}

export default BeamDebugOverlay;
