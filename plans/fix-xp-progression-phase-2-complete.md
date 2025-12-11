## Phase 2 Complete: Tune Progression Config

Increased the XP multiplier from `0.1` to `0.5` to make progression faster and more rewarding.

**Files created/changed:**

- `src/config/progression.ts`
- `test/game/progression.spec.ts`

**Functions created/changed:**

- `XP_CONFIG` (updated `damageXpMultiplier`)

**Tests created/changed:**

- `test/game/progression.spec.ts` (new test file)

**Review Status:** APPROVED

**Git Commit Message:**
feat: increase damage XP multiplier to 0.5

- Increase damageXpMultiplier from 0.1 to 0.5 for faster progression
- Add tests to verify progression configuration
