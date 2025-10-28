# components/lod/ - Level of Detail Management

Manages Level of Detail (LOD) switching for distant objects to optimize rendering performance.

## Files

| File | Purpose |
|------|---------|
| **ShipLODManager.tsx** | React component managing LOD switching for ships based on camera distance |

## Overview

The LOD system provides:
- Automatic model swapping based on distance from camera
- Performance optimization for large ship counts
- Seamless transitions between LOD levels
- Configurable distance thresholds

## LOD Strategy

Ships use different levels of detail:
- **High Detail (Close)** - Full geometry and effects
- **Medium Detail (Mid)** - Simplified geometry
- **Low Detail (Far)** - Bounding box or simple mesh
- **Culled (Very Far)** - Not rendered at all

## Integration

- Integrated with Battlefield scene rendering
- Works with camera system to determine distance
- Coordinates with layer rendering system
- Improves performance in large battle scenarios
