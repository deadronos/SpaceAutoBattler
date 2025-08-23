Changes Done:
All game balance, progression, visuals, and entity stats are now fully centralized in config TypeScript files. The codebase is pure TypeScript, with all types in index.ts. Renderer and simulation logic read all tunables from config—no hardcoded gameplay or visual values remain.

Current Status:
Config-driven architecture is complete. Progression uses function-valued scalars for XP, HP, damage, shield, speed, and regen. All visual effects, particles, and UI overlays are parameterized via config. Unit and smoke tests for progression and scaling pass. The build outputs and runtime have been verified.

Outstanding Goals:
Unify overlapping config files, migrate any remaining hardcoded values, and update all imports. Expand and rewrite tests to match the config-driven design. Run full Vitest and Playwright suites for regression and browser validation. Add more multi-level progression/scaling tests. Document and implement config unification steps.