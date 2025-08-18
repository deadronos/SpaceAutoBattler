# DiceTycoon - Incremental Dice Game Instructions

## Purpose
Short, actionable guidance so an AI coding agent (and humans) can be immediately productive in this incremental dice rolling game repository.

## Project Overview
DiceTycoon is an incremental/idle game where players roll up to 6 dice simultaneously, earning credits based on dice faces and individual multipliers. Players can upgrade dice, unlock new dice, and automate rolling for progression.

**Core Game Formula:** `credits = Σ (die_i_face × multiplier_i)` across all unlocked dice.

**Architecture:**
- Single-page web app: `index.html`, `styles.css`, `app.js` (or TypeScript equivalent)
- Uses @Patashu/break_eternity.js Decimal for all numeric operations (required for large numbers)
- Game state persisted in `localStorage` with Decimal values serialized as strings
- Focus on incremental progression, dice upgrading, and automation mechanics

## Code Style
- Use 2-space indentation.
- Use semicolons consistently.
- Prefer single quotes for JS strings; double quotes allowed in HTML.
- Prefer const/let (no var).
- Keep functions small and single-responsibility.
- **TypeScript preferred** for better type safety with Decimal operations.
- Run Prettier and ESLint before committing. Example devDependencies:
  - eslint, prettier, eslint-config-prettier, eslint-plugin-html, @typescript-eslint/*

## Naming Conventions
- Files: kebab-case (e.g., `app.js`, `styles.css`, `dice-utils.ts`).
- JS/TS variables: camelCase.
- Constants: UPPER_SNAKE_CASE (STORAGE_KEY, BASE_COST, BASE_GROWTH).
- DOM ids: kebab-case (e.g., `dice-container`, `roll-button`, `credits-display`).
- Data keys in localStorage: include a version suffix (e.g., `.v1`) to indicate shape changes.

## Required Dependencies
- **@Patashu/break_eternity.js**: For all numeric operations (credits, costs, multipliers)
- Install via: `npm install @patashu/break_eternity.js`
- Import: `import { Decimal } from '@patashu/break_eternity.js';`

## Key files & DOM conventions
- `index.html`: semantic markup for incremental dice game interface
- `app.js/app.ts`: single source of game behavior. Important patterns:
  - `render()` drives DOM updates; avoid ad-hoc DOM mutations outside it.
  - Game state management for dice (unlocked, level, multiplier), credits, autoroll
  - All numeric operations use Decimal from @Patashu/break_eternity.js
- Required DOM elements for dice game functionality:
  - Game area: `#game-container`, `#dice-container` (grid for up to 6 dice)
  - Individual dice: `.die-slot` with `data-die-id` attribute
  - Controls: `#roll-button`, `#autoroll-toggle`, `#reset-button`
  - Display: `#credits-display`, `#roll-history`
  - Upgrades: `.die-upgrade-button`, `.die-unlock-button`
  - Settings: `#theme-toggle`, `#export-save`, `#import-save`

## Game Development Guidelines
- **Core mechanics:**
  - Up to 6 dice, each with unlocked/level/multiplier/animationUnlocked properties
  - Roll action: simultaneous roll of all unlocked dice, credits = Σ(face × multiplier)
  - Leveling: exponential cost scaling using Decimal math
  - Autoroll: unlockable automation with upgradeable speed/cooldown
- **Incremental game patterns:**
  - Exponential progression with soft/hard caps to prevent runaway inflation
  - Clear upgrade paths and player choices
  - Satisfying feedback loops (roll → earn → upgrade → roll more efficiently)
- **Technical requirements:**
  - ALL numeric values use Decimal (never mix with native Number)
  - Implement proper randomization for dice faces (crypto.getRandomValues preferred)
  - Maintain game state consistency across browser sessions
  - Handle offline progress accumulation when player returns
- **UI/UX:**
  - Clear visual feedback for dice rolls and credit gains
  - Format large numbers with suffixes (K, M, B, etc.) or scientific notation
  - Responsive design for various screen sizes
  - Accessibility features for keyboard navigation

## Decimal Math Operations (Critical)
- **NEVER use native Number for game values** - use Decimal exclusively
- Common operations with Decimal:
````javascript
import { Decimal } from '@patashu/break_eternity.js';

// Creating Decimals
const credits = new Decimal(0);
const cost = new Decimal('123.45'); // strings for precision
const multiplier = Decimal.fromNumber(2.5); // from number if needed

// Operations
credits = credits.plus(earnedCredits);     // addition
cost = baseCost.times(growthRate.pow(level)); // multiplication and power
const canAfford = credits.gte(cost);       // comparison (>=)

// Formatting for display
const formatted = credits.toStringWithDecimalPlaces(2);
const suffixed = credits.toExponential(2); // for very large numbers
````

## Safe localStorage access (required)
- Wrap all localStorage reads/writes in try/catch and serialize Decimal as strings
````javascript
// Example localStorage wrapper (use in app.js)
const STORAGE_KEY = 'dicetycoon.gamestate.v1';

function safeLoad(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    
    // Convert string values back to Decimal
    if (parsed.credits) parsed.credits = new Decimal(parsed.credits);
    if (parsed.dice) {
      parsed.dice.forEach(die => {
        if (die.multiplier) die.multiplier = new Decimal(die.multiplier);
      });
    }
    
    return parsed;
  } catch (err) {
    console.error('Load failed', key, err);
    return fallback;
  }
}

function safeSave(key, data) {
  try {
    // Convert Decimal values to strings for storage
    const serializable = { ...data };
    if (serializable.credits) serializable.credits = serializable.credits.toString();
    if (serializable.dice) {
      serializable.dice = serializable.dice.map(die => ({
        ...die,
        multiplier: die.multiplier ? die.multiplier.toString() : die.multiplier
      }));
    }
    
    localStorage.setItem(key, JSON.stringify(serializable));
  } catch (err) {
    console.error('Save failed', key, err);
  }
}
````

## Data Model Example
````javascript
// Game state structure (all Decimal values stored as strings in localStorage)
const gameState = {
  credits: new Decimal(0),
  dice: [
    {
      id: 1,
      unlocked: true,
      level: 1,
      multiplier: new Decimal(1),
      animationUnlocked: false
    },
    {
      id: 2,
      unlocked: false,
      level: 0,
      multiplier: new Decimal(1),
      animationUnlocked: false
    }
    // ... up to 6 dice
  ],
  autoroll: {
    enabled: false,
    level: 0,
    cooldown: new Decimal(2.0) // seconds
  },
  settings: {
    sound: true,
    formatting: 'suffixed' // 'suffixed', 'scientific', 'engineering'
  }
};
````

## Development Notes
- **Refer to PROJECT-REQUIREMENTS.md** for complete game mechanics, acceptance criteria, and technical specifications
- **MVP Requirements:**
  - Player can unlock and upgrade up to 6 dice
  - Roll button triggers simultaneous dice animation and credit calculation
  - Autoroll system with upgradeable speed
  - Persistent save/load with proper Decimal serialization
  - Large number formatting for display
- **Incremental game balance:**
  - Test progression rates to ensure satisfying but not overwhelming growth
  - Implement cost scaling formulas: `cost = baseCost × (growthRate ^ level)`
  - Consider prestige/rebirth mechanics for long-term progression
- **Performance considerations:**
  - Batch Decimal operations to avoid performance spikes
  - Debounce UI updates for high-frequency autoroll
  - Use requestAnimationFrame for dice roll animations


