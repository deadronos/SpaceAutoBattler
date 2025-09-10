## Decision Engine

Last-Reviewed: 2025-09-07

The `decisionEngine.ts` module provides a set of functions for scoring different AI intents and selecting the best one. This is used by the `AIController` to make more nuanced decisions about ship behavior.

### Exported Functions

- **`scorePursue(params: object): number`**
  - **Purpose:** Calculates a score for the 'pursue' intent based on factors like distance to the enemy, preferred range, AI personality, and whether the ship is a scout or the team is under alarm.
  - **Inputs:** An object containing parameters for scoring.
  - **Outputs:** A numerical score for the 'pursue' intent.

- **`scoreEvade(params: object): number`**
  - **Purpose:** Calculates a score for the 'evade' intent based on factors like distance to threats, recent damage, and other settings.
  - **Inputs:** An object containing parameters for scoring.
  - **Outputs:** A numerical score for the 'evade' intent.

- **`scoreRoam(params: object): number`**
  - **Purpose:** Calculates a score for the 'roam' intent based on the presence of nearby friends and the AI's group cohesion personality trait.
  - **Inputs:** An object containing parameters for scoring.
  - **Outputs:** A numerical score for the 'roam' intent.

- **`chooseBestIntent(scores: Partial<Record<AIIntent, number>>): AIIntent`**
  - **Purpose:** Selects the best AI intent from a map of intent scores.
  - **Inputs:** A partial record mapping `AIIntent` to a numerical score.
  - **Outputs:** The `AIIntent` with the highest score, or 'idle' if no scores are provided.
