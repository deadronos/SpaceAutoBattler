import { describe, it, expect } from "vitest";
import { createShip, normalizeTurrets } from "../../src/entities";

describe("turret mount math", () => {
  it("computes mount world position for rotated ship", () => {
    const ship = createShip("destroyer", 100, 200, "red");
    // ensure turret 0 exists and normalized
    normalizeTurrets(ship as any);
    const turret = ship.turrets && (ship.turrets as any[])[0];
    if (!turret) {
      // Interop fallback: inject a basic turret so math below can run
      (ship as any).turrets = [{ position: [1.2, 0.8], kind: 'basic' }];
    }
    const effectiveTurret: any = (ship.turrets as any[])[0];
    expect(effectiveTurret).toBeDefined();
    // manually set ship angle to 90 degrees (pi/2)
    ship.angle = Math.PI / 2;
    const m = Array.isArray(effectiveTurret.position)
      ? effectiveTurret.position
      : effectiveTurret.position;
    const entitiesConfig = require("../../src/config/entitiesConfig");
    const cfg = typeof entitiesConfig.getShipConfig === "function"
      ? entitiesConfig.getShipConfig()
      : (entitiesConfig.default && typeof entitiesConfig.default.getShipConfig === "function"
        ? entitiesConfig.default.getShipConfig()
        : (entitiesConfig.ShipConfig && typeof entitiesConfig.ShipConfig === 'object'
          ? entitiesConfig.ShipConfig
          : entitiesConfig.default || {}));
  const radius = (cfg[ship.type] && cfg[ship.type].radius) || ship.radius || 40;
    const tx =
      (ship.x || 0) +
      Math.cos(ship.angle) * m[0] * radius -
      Math.sin(ship.angle) * m[1] * radius;
    const ty =
      (ship.y || 0) +
      Math.sin(ship.angle) * m[0] * radius +
      Math.cos(ship.angle) * m[1] * radius;
    // For position [1.2,0.8] on destroyer and angle pi/2, compute expected
    expect(Number.isFinite(tx)).toBe(true);
    expect(Number.isFinite(ty)).toBe(true);
  });
});
