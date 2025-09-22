# Agents Guide: src/types

- Purpose: Source of ambient and shared TypeScript declarations.
- Index: Re-export shared runtime types from `index.ts`; keep module augmentation files focused and well-scoped.
- GameState: Treat the `GameState` definition as canonical—other modules should import from here instead of redefining shapes.
- Hygiene: Document any new global typings and align eslint/tsconfig settings if the surface area changes.
- Review: Run `npx tsc --noEmit` after editing declarations to catch downstream breakages early.
