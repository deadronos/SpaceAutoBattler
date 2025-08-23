The following config files were removed because repository-wide searches showed they were not imported anywhere in `src/`:

- `src/config/behaviorConfig.js`
- `src/config/behaviorConfig.ts`
- `src/config/simConfig.js`
- `src/config/simConfig.ts`

If these are needed for future work, restore them from git history or the spec/ directory. Removal was performed to reduce duplicate/unused config clutter.

Reason: No importers found across `src/` at time of removal (checked with grep_search).

Date: 2025-08-23
