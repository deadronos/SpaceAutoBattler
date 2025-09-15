## IntentManager

Last-Reviewed: 2025-09-15

The `IntentManager` class is a small helper module responsible for computing and applying AI intent lifetimes to ships. It ensures that intents have a duration based on the ship's personality and other factors, which is crucial for controlling the pacing of AI decision-making.

### Class: `IntentManager`

#### Methods

- **`computeDuration(personality: AIPersonality, rng: RNG, opts?: ComputeOptions): number`**
  - **Purpose:** Computes the duration for an AI intent.
  - **Inputs:**
    - `personality`: The `AIPersonality` of the ship.
    - `rng`: The random number generator (`RNG`) instance.
    - `opts`: Optional `ComputeOptions` that can specify if this is a damage-related evasion, which might affect the duration.
  - **Outputs:** A `number` representing the calculated duration for the intent.

- **`applyIntent(ship: Ship, now: number, intent: AIIntent, personality: AIPersonality, rng: RNG, opts?: ComputeOptions): number`**
  - **Purpose:** Applies a new intent to a ship and sets its `intentEndTime`.
  - **Inputs:**
    - `ship`: The `Ship` to apply the intent to.
    - `now`: The current simulation time.
    - `intent`: The `AIIntent` to apply.
    - `personality`: The ship's `AIPersonality`.
    - `rng`: The `RNG` instance.
    - `opts`: Optional `ComputeOptions` passed to `computeDuration`.
  - **Outputs:** The calculated `duration` of the intent.

Notes from this session (2025-09-15):

- Reviewed and annotated as part of the memory sweep. Intentionally small annotation only.
