# components/ship/ - Ship Rendering Components

Specialized components for rendering ship models, shields, and ship-specific visual effects.

## Core Ship Components

| File | Purpose |
|------|---------|
| **ShipView.tsx** | Main ship view component; orchestrates model, shield, and health rendering |
| **ShipModel.tsx** | Renders the 3D ship model (GLTF loaded from assets) |
| **ShipShield.tsx** | Renders the energy shield effect and damage visualization |
| **shieldUtils.ts** | Utility functions for shield calculations and effects |
| **rippleUtils.ts** | Utility functions for shield ripple/impact effects |

## Shield System

The shield system provides visual feedback for:
- Shield health and recharge state
- Impact ripples when taking damage
- Hexagonal shield geometry with custom material
- Color feedback based on shield status

## Integration

- ShipView is used by Ship component in parent directory
- Shields use custom shaders (see `src/renderer/shields/`)
- Models loaded from `src/assets/gltf/`
- Part of the ECS entity rendering system
