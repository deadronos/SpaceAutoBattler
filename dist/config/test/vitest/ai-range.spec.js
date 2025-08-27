import { describe, it, expect } from "vitest";
import { applySimpleAI } from "../../src/behavior";
import { getShipConfigSafe } from "./utils/entitiesConfigSafe";
// Minimal ship-like fixtures
function makeShip(x, y, team = "A", type = "fighter") {
    const cfg = getShipConfigSafe()[type];
    return {
        id: Math.floor(Math.random() * 100000),
        x,
        y,
        vx: 0,
        vy: 0,
        team,
        hp: cfg.maxHp || 10,
        maxHp: cfg.maxHp || 10,
        cannons: cfg.cannons ? JSON.parse(JSON.stringify(cfg.cannons)) : [],
        turrets: cfg.turrets ? JSON.parse(JSON.stringify(cfg.turrets)) : [],
        angle: 0,
        type,
    };
}
describe("AI firing respects weapon range", () => {
    it("does not spawn bullets when target is out of cannon range", () => {
        const ship = makeShip(0, 0, "A", "fighter");
        const enemy = makeShip(10000, 10000, "B", "fighter");
        const state = { ships: [ship, enemy], bullets: [] };
        // Ensure cooldown expired
        ship.cannons.forEach((c) => (c.__cd = 0));
        applySimpleAI(state, 0.016);
        expect(state.bullets.length).toBe(0);
    });
    it("spawns bullets when target is within cannon range", () => {
        const ship = makeShip(0, 0, "A", "fighter");
        const enemy = makeShip(10, 10, "B", "fighter");
        const state = { ships: [ship, enemy], bullets: [] };
        ship.cannons.forEach((c) => (c.__cd = 0));
        applySimpleAI(state, 0.016);
        expect(state.bullets.length).toBeGreaterThan(0);
    });
});
