# debug/ - Debug UI Components

Debug components and panels for visualizing and testing game systems during development.

## Debug Files

| File                        | Purpose                                                      |
| --------------------------- | ------------------------------------------------------------ |
| **RingDebugPanel.tsx**      | Debug panel for visualizing debug rings and collision shapes |
| **ErrorCountsPanel.tsx**    | Panel displaying error counts by category (dev only)         |
| **debugPanel.css**          | Styling for debug panels                                     |
| **copilotDebugRegistry.ts** | Registry for the dev-only `window.__copilot_*` debug hooks   |
| **starDebugWindow.ts**      | Shared star debug-window surface/typing                      |
| **starSphereDebug.ts**      | Per-frame `StarSphere` debug scaffolding                     |
| **planetRingsDebug.ts**     | `PlanetRings` debug scaffolding                              |

## Purpose

These debug components provide:

- Visual debugging of physics and collisions
- System state inspection
- Performance profiling display
- Development-only UI overlays

## Development Features

- Collision shape visualization
- Physics body rendering
- State snapshots
- Performance metrics

## Integration

Debug components are conditionally rendered in development:

- Can be toggled on/off
- Non-intrusive to gameplay
- Minimal performance impact when disabled
- Feature-flagged for production builds

## Conditional Rendering

These components are typically wrapped with feature flags:

```tsx
{
  isDevelopment && <RingDebugPanel />;
}
```

This ensures debug UI doesn't ship to production.
