# components/thrusters/ - Thruster Effects

Renders thruster/engine fire effects for ship propulsion and maneuvering.

## Files

| File                             | Purpose                                                                                                     |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| **ThrusterInstancedManager.tsx** | React component managing instanced rendering of thruster particles; handles thruster state and fire effects |

## Overview

The thruster system provides:

- Engine fire effects when ships accelerate
- Maneuvering thruster jets for rotation
- Continuous propulsion feedback
- Performance-optimized instanced rendering

## Integration

- Driven by ship movement and control systems
- Particles spawn from thruster attachment points
- Intensity scales with throttle/acceleration
- Works with particle trails for enhanced effect
