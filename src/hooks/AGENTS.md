# Agents Guide: src/hooks

- Purpose: Custom React hooks that wrap ECS queries and shared UI logic.
- Contracts: Provide explicit return types so consuming components stay well-typed.
- Side effects: Encapsulate subscriptions/cleanup inside `useEffect`; never mutate module globals.
- Reuse: If a hook becomes broadly useful, document expectations in its JSDoc and consider colocated tests.
- Validation: Add lightweight Vitest tests for data transforms or mock the game context when feasible.
