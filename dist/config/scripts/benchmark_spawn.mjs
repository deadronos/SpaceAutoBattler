// Quick micro-benchmark for carrier spawn hotspots
// Measures cost of createShip (cannon cloning) and spawn counting per simulateStep
import { simulateStep } from "../dist/simulate.js";
import { makeInitialState, createShip } from "../dist/entities.js";
function hrtimeMs() {
    const [s, ns] = process.hrtime();
    return s * 1000 + ns / 1e6;
}
function bench(label, fn, iters = 1000) {
    const t0 = hrtimeMs();
    for (let i = 0; i < iters; i++)
        fn();
    const t1 = hrtimeMs();
    console.log(`${label}: ${(t1 - t0).toFixed(2)} ms for ${iters} iters`);
}
function main() {
    const state = makeInitialState();
    const carriers = 100;
    for (let i = 0; i < carriers; i++) {
        const c = createShip("carrier", Math.random() * 2000, Math.random() * 1200, i % 2 ? "red" : "blue");
        state.ships.push(c);
    }
    // Warm-up
    simulateStep(state, 0.016, { W: 3000, H: 2000 });
    bench("simulateStep spawn loop (100 carriers)", () => {
        simulateStep(state, 0.016, { W: 3000, H: 2000 });
    }, 200);
    // Direct createShip cost
    bench("createShip fighter (cannon clone)", () => {
        const s = createShip("fighter", 0, 0, "red");
        // prevent DCE
        if (!s || !s.cannons)
            throw new Error("no ship");
    }, 5000);
}
if (import.meta.url === `file://${process.argv[1]}`) {
    main();
}
