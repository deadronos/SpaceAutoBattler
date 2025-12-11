## Plan: Fix XP Progression Visibility and Rate

The user reports that ships rarely earn XP. This is caused by a low XP multiplier combined with UI rounding that hides fractional gains. This plan improves visibility by showing decimals and increases the XP gain rate.

**Phases**

1. **Phase 1: Fix UI Visibility**
   - **Objective:** Update the Progression Panel to display XP with decimal precision instead of rounding to integers.
   - **Files/Functions to Modify/Create:**
     - `src/components/ProgressionPanel.tsx` (ShipProgressionCard, EventRow)
   - **Tests to Write:**
     - `test/components/ProgressionPanel.spec.tsx` (verify decimal formatting)
   - **Steps:**
     1. Create a test verifying that fractional XP is displayed correctly (e.g. "0.5 / 100 XP").
     2. Update `ShipProgressionCard` to use `.toFixed(1)` for XP display.
     3. Update `EventRow` to use `.toFixed(1)` for XP deltas.

2. **Phase 2: Tune Progression Config**
   - **Objective:** Increase the XP multiplier so ships level up at a more satisfying rate.
   - **Files/Functions to Modify/Create:**
     - `src/config/progression.ts` (`XP_CONFIG`)
   - **Tests to Write:**
     - `test/game/progression.spec.ts` (verify new multiplier values)
   - **Steps:**
     1. Update `XP_CONFIG.damageXpMultiplier` from `0.1` to `0.5`.
     2. Verify that damage calculations now award 5x more XP.

**Open Questions**

1. None. User confirmed keeping the "dead attackers get no XP" rule.
