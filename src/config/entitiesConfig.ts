// entitiesConfig.ts - ship-type defaults and visuals helpers (typed)
import { getShipAsset, getBulletAsset, getTurretAsset } from './assets/assetsConfig';

export type CannonCfg = {
  damage: number; rate: number; spread?: number; muzzleSpeed?: number; bulletRadius?: number; bulletTTL?: number;
};

export type ShipTypeCfg = {
  maxHp: number; armor?: number; maxShield?: number; shieldRegen?: number; dmg?: number; damage?: number; radius?: number;
  cannons?: CannonCfg[]; accel?: number; turnRate?: number; carrier?: { fighterCooldown: number; maxFighters: number; spawnPerCooldown: number };
};

export type ShipConfigMap = Record<string, ShipTypeCfg>;

export const ShipConfig: ShipConfigMap = {
  fighter: {
    maxHp: 15, armor: 0, maxShield: 8, shieldRegen: 1.0, dmg: 3, damage: 3, radius: 4,
    cannons: [ { damage: 3, rate: 3, spread: 0.1, muzzleSpeed: 300, bulletRadius: 1.5, bulletTTL: 1.2 } ],
    accel: 600, turnRate: 6,
  },
  corvette: {
    maxHp: 50, armor: 0, maxShield: Math.round(50 * 0.6), shieldRegen: 0.5, dmg: 5, damage: 5, radius: 8,
    accel: 200, turnRate: 3,
    cannons: [ { damage: 6, rate: 1.2, spread: 0.05, muzzleSpeed: 220, bulletRadius: 2, bulletTTL: 2.0 } ],
  },
  frigate: {
    maxHp: 80, armor: 1, maxShield: Math.round(80 * 0.6), shieldRegen: 0.4, dmg: 8, damage: 8, radius: 12,
    cannons: [ { damage: 8, rate: 1.0, spread: 0.06, muzzleSpeed: 200, bulletRadius: 2.5, bulletTTL: 2.2 } ],
    accel: 120, turnRate: 2.2,
  },
  destroyer: {
    maxHp: 120, armor: 2, maxShield: Math.round(120 * 0.6), shieldRegen: 0.3, dmg: 12, damage: 12, radius: 16,
    cannons: new Array(6).fill(0).map(() => ({ damage: 6, rate: 0.8, spread: 0.08, muzzleSpeed: 240, bulletRadius: 2.5, bulletTTL: 2.4 })),
    accel: 80, turnRate: 1.6,
  },
  carrier: {
    maxHp: 200, armor: 3, maxShield: Math.round(200 * 0.6), shieldRegen: 0.2, dmg: 2, damage: 2, radius: 24,
    cannons: new Array(4).fill(0).map(() => ({ damage: 4, rate: 0.6, spread: 0.12, muzzleSpeed: 180, bulletRadius: 3, bulletTTL: 2.8 })),
    accel: 40, turnRate: 0.8,
    carrier: { fighterCooldown: 1.5, maxFighters: 6, spawnPerCooldown: 2 }
  }
};

export default ShipConfig;

export function setShipConfig(newCfg: Partial<ShipConfigMap> = {}) {
  function merge(target: any, src: any) {
    for (const k of Object.keys(src)) {
      const sv = (src as any)[k];
      if (sv && typeof sv === 'object' && !Array.isArray(sv)) {
        if (!target[k] || typeof target[k] !== 'object') target[k] = {};
        merge(target[k], sv);
      } else if (Array.isArray(sv)) {
        target[k] = sv.map(item => (item && typeof item === 'object' ? Object.assign({}, item) : item));
      } else if (['number', 'string', 'boolean'].includes(typeof sv)) {
        target[k] = sv;
      }
    }
  }
  merge(ShipConfig as any, newCfg as any);
}

export function getShipConfig(): ShipConfigMap {
  return JSON.parse(JSON.stringify(ShipConfig)) as ShipConfigMap;
}

export const VisualMappingConfig = {
  bulletRadiusThresholds: [
    { threshold: 0.22, kind: 'small' },
    { threshold: 0.32, kind: 'medium' },
    { threshold: Infinity, kind: 'large' }
  ],
  defaultTurretKind: 'basic',
  shipAssetKey: {
    fighter: 'fighter', corvette: 'corvette', frigate: 'frigate', destroyer: 'destroyer', carrier: 'carrier'
  }
};

export function bulletKindForRadius(r = 0.2): string {
  for (const t of VisualMappingConfig.bulletRadiusThresholds) {
    if (r <= t.threshold) return t.kind;
  }
  return 'small';
}

export function getBulletAssetForCannon(cannon: { bulletRadius?: number; radius?: number } = {}) {
  const r = typeof cannon.bulletRadius === 'number' ? cannon.bulletRadius : (typeof cannon.radius === 'number' ? cannon.radius : 0.2);
  const kind = bulletKindForRadius(r);
  return getBulletAsset(kind as any);
}

export function getShipAssetForType(type = 'fighter') {
  const key = (VisualMappingConfig as any).shipAssetKey[type] || type;
  return getShipAsset(key as any);
}

export function getTurretAssetForShip(_shipType = 'fighter') {
  return getTurretAsset(VisualMappingConfig.defaultTurretKind as any);
}

export function getVisualsForShipType(type = 'fighter', cannon: any = undefined) {
  return { hull: getShipAssetForType(type), turret: getTurretAssetForShip(type), bullet: getBulletAssetForCannon(cannon) };
}

export function getDefaultShipType(): string {
  const keys = Object.keys(ShipConfig || {} as any);
  return keys.length ? keys[0] as string : 'fighter';
}
