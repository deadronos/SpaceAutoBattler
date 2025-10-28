# components/debris/ - Debris Management

Handles debris particle rendering and instanced mesh management for destroyed objects and explosion fragments.

## Files

| File | Purpose |
|------|---------|
| **DebrisInstancedManager.ts** | Manages instanced rendering of debris particles; handles lifecycle, pooling, and mesh updates |

## Overview

The debris system provides efficient rendering of:
- Ship fragments from destroyed vessels
- Collision debris
- Material chunks from explosions
- Performance optimizations through instancing

## Integration

- Triggered by destruction events in combat system
- Uses instanced meshes for thousands of particles
- Part of the overall particle effects pipeline
- Debris particles gradually fade and despawn
