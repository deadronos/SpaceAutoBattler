## Phase 1 Complete: Fix UI Visibility

Updated the Progression Panel to display XP and event deltas with 1 decimal place (e.g., "0.5 / 100.0 XP"). This ensures that small XP gains are visible to the player instead of being rounded down to zero.

**Files created/changed:**
- `src/components/ProgressionPanel.tsx`
- `test/components/ProgressionPanel.spec.tsx`

**Functions created/changed:**
- `ShipProgressionCard` (updated XP display format)
- `EventRow` (updated delta XP display format)

**Tests created/changed:**
- `test/components/ProgressionPanel.spec.tsx` (new test file)

**Review Status:** APPROVED

**Git Commit Message:**
fix: display fractional XP in progression panel

- Update ProgressionPanel to show XP with 1 decimal place
- Update EventRow to show XP deltas with 1 decimal place
- Add tests for decimal XP display
