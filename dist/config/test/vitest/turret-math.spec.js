import { normalizeTurrets } from "../../src/entities";
// Note: Use safe helper for interop if needed
import { createShip } from "../../src/entities";
// Simple tests for turret mount math
describe("turret mount math", () => {
    test("mount world position rotates with ship angle", () => {
        const ship = createShip("fighter", 100, 200);
        ship.angle = Math.PI / 2; // 90deg
        ship.radius = 10;
        ship.turrets = [[1, 0]]; // mount at +x in local coords
        normalizeTurrets(ship);
        const t = ship.turrets[0];
        // compute mount world
        const tx = t.position[0];
        const ty = t.position[1];
        const mountX = ship.x +
            Math.cos(ship.angle) * tx * ship.radius -
            Math.sin(ship.angle) * ty * ship.radius;
        const mountY = ship.y +
            Math.sin(ship.angle) * tx * ship.radius +
            Math.cos(ship.angle) * ty * ship.radius;
        // With angle = 90deg, local +x becomes world +y
        expect(Math.round(mountX)).toBe(100);
        expect(Math.round(mountY)).toBe(210);
    });
});
