# Memory Index for SpaceAutoBattler

This index lists internal memory files created by the Serena MCP agent for quick discovery.

Core memories (handwritten or agent-updated):
- project_purpose: Short project purpose and tech stack summary
- code_structure: High-level code structure and important modules (src/)
- entrypoints: Main entrypoints and npm scripts (package.json, src/main.ts)
- turret_firing_api: Contract for `fireTurrets` behavior and bullet creation
- update_bullets_api: Contract for `updateBullets` behavior and collision handling
- process_deaths_xp_api: Contract for `processDeathsAndXP` and kill crediting
- handle_level_ups_api: Contract for `handleLevelUps` progression logic
- carrier_spawn_logic_api: Contract for `carrierSpawnLogic` and fighter spawning

Auto-generated stub files (created by `scripts/generate_memories.mjs`):
- game_state_api.md (memory/game_state_api.md)
- ai_controller_api.md (memory/ai_controller_api.md)
- physics_api.md (memory/physics_api.md)
- search_utils_api.md (memory/search_utils_api.md)
- spatial_index_api.md (memory/spatial_index_api.md)
- asset_loader_api.md (memory/asset_loader_api.md)
- svg_loader_api.md (memory/svg_loader_api.md)
- sim_worker_api.md (memory/sim_worker_api.md)
- three_renderer_api.md (memory/three_renderer_api.md)

Other memories:
- contributor_notes: (existing memory placeholder)
- ci_instructions: (existing memory placeholder)
- style_conventions: (existing memory placeholder)
- suggested_commands: (existing memory placeholder)

See `memory/README.md` for regeneration instructions.

_Last updated: 2025-08-31_
