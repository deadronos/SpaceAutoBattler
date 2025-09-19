# SpaceAutoBattler - Vitest Test Suite

This directory contains the comprehensive unit test suite for the SpaceAutoBattler game, built with Vitest and happy-dom for browser environment simulation.

## Overview

The test suite validates the game's configuration-driven architecture, ensuring that all game systems work correctly with the defined configurations. Tests focus on:

- **Config-driven validation**: Verifying that configuration values produce expected game behavior
- **Balance validation**: Ensuring game balance assumptions are maintained
- **Deterministic behavior**: Testing RNG and simulation systems for consistency
- **Edge case handling**: Validating system behavior under boundary conditions

## Test Structure

### Core Principles

- **No hardcoded values**: All tests use configuration values from `/src/config/` rather than magic numbers
- **Comprehensive coverage**: Tests validate both happy paths and edge cases
- **Deterministic testing**: RNG and simulation systems are tested for predictable behavior
- **Balance validation**: Tests ensure game balance assumptions are maintained across config changes

### Test Files

#### `setupTests.ts`

**Purpose**: Shared test infrastructure and utilities

**Responsibilities**:

- WebGL and Three.js mocking for browser environment simulation
- Game state creation utilities (`createMockGameState`, `createMockShip`)
- Performance API mocking
- Shared test helpers for common operations
- GL context and texture mocking utilities

#### `config-entities.spec.ts` (16 tests)

**Purpose**: Validate ship and turret configurations

**Responsibilities**:

- Ship class configuration validation (fighter, corvette, frigate, destroyer, carrier)
- Turret configuration and progression testing
- Balance validation for damage scaling and ship health ratios
- Armor progression and stat increases across ship classes
- Turret count and configuration per ship class

#### `config-behavior.spec.ts` (24 tests)

**Purpose**: Validate AI behavior and personality systems

**Responsibilities**:

- AI personality traits for all ship classes
- Team modifier application and clamping
- Formation configurations and spacing
- Roaming pattern validation
- Turret AI behavior settings
- Intent reevaluation rates and behavior modes

#### `config-progression.spec.ts` (18 tests)

**Purpose**: Validate XP and leveling systems

**Responsibilities**:

- XP calculation functions (`nextLevelXp`, `applyLevelUps`)
- Level progression curves and exponential growth
- XP reward balance (damage vs kill values)
- Level scaling and stat growth validation
- Integration testing for combat scenarios

#### `utils-rng.spec.ts` (23 tests)

**Purpose**: Validate random number generation systems

**Responsibilities**:

- RNG determinism with seeded values
- Statistical distribution testing
- Edge cases (empty arrays, boundary values)
- Random selection functions (`pick`, `pickWeighted`)
- Shuffle and sampling algorithm validation

#### `core-entities.spec.ts` (29 tests)

**Purpose**: Validate core game entity mechanics

**Responsibilities**:

- Ship spawning and fleet creation
- Game state management and reset functionality
- Entity stats calculation and level scaling
- Turret initialization and AI state
- Simulation integration testing
- Edge cases and boundary condition handling

#### `build-system.spec.ts` (12 tests)

**Purpose**: Validate build system outputs and deployment artifacts

**Responsibilities**:

- Build command output verification (`npm run build`)
- Standalone build validation (`npm run build-standalone`)
- File existence and content validation
- Asset inlining verification for standalone builds
- Bundle size and structure checks
- HTML template injection testing
- SVG asset embedding validation
- Build artifact integrity testing

## Running Tests

```bash
# Run all tests
npm test

# Run specific test file
npm test config-entities.spec.ts

# Run tests in watch mode
npm test -- --watch

# Run tests with coverage
npm test -- --coverage
```

## Test Categories

### Configuration Validation

Tests that ensure configuration values are valid and produce expected behavior:

- Structure validation
- Value range checking
- Cross-reference validation
- Balance assumption verification

### Balance Validation

Tests that ensure game balance is maintained:

- Progressive stat increases
- Appropriate scaling ratios
- Incentive structures (XP, damage)
- Role specialization validation

### Integration Testing

Tests that validate system interactions:

- Config-to-game state translation
- Simulation integration
- Multi-entity interactions
- State persistence and reset

### Edge Case Testing

Tests for boundary conditions and error handling:

- Empty collections
- Invalid inputs
- Boundary values
- Error state recovery

## Configuration-Driven Testing

All tests are designed to work with the configuration system:

```typescript
// Example: Testing uses actual config values
const fighterConfig = getShipClassConfig('fighter');
expect(ship.health).toBe(fighterConfig.baseHealth); // Not hardcoded 80
```

This approach ensures:

- Tests automatically adapt to config changes
- Balance changes are validated automatically
- No need to update test expectations when tweaking balance

## Mocking Strategy

The test suite uses comprehensive mocking:

- **WebGL**: Mocked canvas and context for Three.js compatibility
- **Three.js**: Essential objects mocked for 3D rendering tests
- **Performance API**: Mocked for timing-sensitive tests
- **Game State**: Factory functions for consistent test data

## Coverage Goals

The test suite aims to cover:

- ✅ All configuration validation
- ✅ Core entity mechanics
- ✅ RNG system determinism
- ✅ XP and leveling systems
- ✅ AI behavior configuration
- ✅ Balance assumption validation
- ✅ Edge cases and error handling
- ✅ Build system output validation

## Maintenance

When adding new features:

1. Add corresponding tests to the appropriate spec file
2. Update this README if new test files are added
3. Ensure tests use configuration values, not hardcoded numbers
4. Add balance validation tests for new game mechanics

When modifying configurations:

1. Run the full test suite to ensure balance is maintained
2. Update test expectations if balance assumptions change intentionally
3. Add new balance validation tests for significant changes

When modifying build scripts:

1. Update `build-system.spec.ts` to reflect new output expectations
2. Add tests for new build artifacts or validation requirements
3. Ensure standalone build tests validate proper asset inlining
4. Test both regular and standalone build outputs

## Dependencies

- **Vitest**: Test runner and assertion library
- **happy-dom**: Browser environment simulation
- **Three.js mocks**: Custom WebGL and Three.js mocking utilities
- **TypeScript**: Full type checking for test files
