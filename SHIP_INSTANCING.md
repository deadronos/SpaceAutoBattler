# Ship Instancing Pilot Implementation

This document describes the Phase 3 ship instancing implementation for SpaceAutoBattler.

## Overview

The ship instancing system replaces individual ship meshes with InstancedMesh rendering for improved performance when many ships of the same class and team are present.

## Features

### ✅ Implemented
- **Feature Flag**: `RendererConfig.instancing.enableShips` controls ship instancing
- **Automatic Grouping**: Ships are grouped by `${class}_${team}` (e.g., "fighter_red", "corvette_blue")
- **Multiple Submeshes**: Each ship group contains multiple InstancedMesh objects for different parts
- **Async Asset Loading**: Ships start as placeholders and upgrade to textured when SVG assets load
- **Dynamic Capacity**: Automatic capacity growth when instance limits are reached
- **Proper Cleanup**: Handles ship removal and resource disposal correctly

### 🏗️ Architecture

```
ShipInstancerRegistry
├── ShipInstanceGroup ("fighter_red")
│   ├── InstancedMesh (body)
│   ├── InstancedMesh (nose)
│   └── InstancedMesh (wings)
├── ShipInstanceGroup ("fighter_blue")
│   └── ...
└── ShipInstanceGroup ("corvette_red")
    └── ...
```

## Configuration

### Enable Ship Instancing
```typescript
// In src/config/rendererConfig.ts
instancing: {
  enableShips: true, // Enable ship instancing
  ships: {
    initialCapacity: 50,   // Ships per group initially
    maxCapacity: 200,      // Maximum ships per group
    growthFactor: 1.5,     // Grow by 50% when needed
    warnThreshold: 0.8     // Warn at 80% capacity
  }
}
```

### Testing Different Ship Classes
The system automatically creates instance groups for different combinations:
- `fighter_red` - Red team fighters
- `fighter_blue` - Blue team fighters  
- `corvette_red` - Red team corvettes
- `destroyer_blue` - Blue team destroyers
- etc.

## Performance Benefits

### Expected Improvements
- **Reduced Draw Calls**: One draw call per submesh instead of per ship
- **Lower CPU Overhead**: Batch transform updates via instance matrices
- **Memory Efficiency**: Shared geometry and materials across ships
- **GPU Optimization**: Better GPU cache utilization with instanced rendering

### Best Performance Scenarios
- Large fleets of identical ships (same class + team)
- Many fighters vs. few different ship types
- Battles with 50+ ships of the same type

## Testing Guide

### Visual Validation
1. Enable ship instancing: `RendererConfig.instancing.enableShips = true`
2. Spawn multiple ships of the same class and team
3. Verify they appear identical to non-instanced rendering
4. Check placeholder → textured ship transitions work smoothly

### Performance Testing
1. Create scenarios with many identical ships (e.g., 100 fighters)
2. Compare draw calls: DevTools → Performance → Rendering
3. Monitor frame rates with large fleets
4. Test capacity growth with > 50 ships per group

### Debug Information
```typescript
// Get instancer statistics
const stats = shipInstancer.getStats();
console.log('Total Groups:', stats.totalGroups);
console.log('Group Stats:', stats.groups);
```

## Current Limitations

1. **Simplified Submeshes**: Current implementation uses basic ship parts
2. **Static Materials**: Materials are not yet dynamically updated per ship
3. **Culling**: InstancedMeshes are culled as a group (may need subdivision)
4. **Asset Dependencies**: Requires proper SVG asset loading infrastructure

## Future Enhancements

- [ ] More detailed ship submesh decomposition
- [ ] Per-instance material variations (damage, upgrades)
- [ ] Spatial subdivision for better culling
- [ ] Performance metrics and benchmarking
- [ ] Level-of-detail (LOD) integration
- [ ] Support for animated ship parts

## Debugging

### Common Issues
- **Ships not appearing**: Check `enableShips` flag and asset loading
- **Performance not improved**: Verify ships are actually being grouped (same class+team)
- **Visual artifacts**: Check matrix transforms and material sharing

### Useful Console Commands
```javascript
// Check if ship instancing is enabled
console.log(RendererConfig.instancing.enableShips);

// Get instance group information
console.log(shipInstancer.getStats());

// Check ship group keys
state.ships.forEach(s => console.log(`${s.class}_${s.team}`));
```

## Implementation Details

### Key Files
- `src/renderer/shipInstancer.ts` - Main implementation
- `src/renderer/threeRenderer.ts` - Integration point
- `src/config/rendererConfig.ts` - Configuration
- `test/vitest/ship-instancer.spec.ts` - Unit tests

### Integration Points
- Ship creation: `syncEntities()` function
- Transform updates: `updateTransforms()` function  
- Cleanup: `dispose()` function
- Matrix updates: `markMatrixNeedsUpdate()` calls

The pilot implementation provides a solid foundation for ship instancing with proper abstraction and extensibility for future enhancements.