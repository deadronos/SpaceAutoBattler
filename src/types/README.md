# Types folder

This folder contains canonical, runtime-free TypeScript types used across the codebase.

Guidelines

- Import types with `import type { Foo } from './types/foo'` when possible. `import type` is erased at compile time and ensures no runtime `require`/`import` occurs.

- Keep files in this directory strictly type-only. Avoid exporting functions or values here that would produce runtime imports and risk circular dependencies.

- If you need to share runtime helpers, place them under `src/lib/` or another implementation module and keep their responsibilities separate from types.

- Examples

  // Correct — type-only import, no runtime dependency
  import type { PoolEntry } from '../types/pool';

  // Incorrect — this will generate a runtime import and may cause circular dependencies
  import { PoolEntry } from '../types/pool';

- When refactoring types that other modules depend on, prefer adding `export type` aliases to keep the runtime surface unchanged.

- If TypeScript cannot correctly erase a type import due to certain language features (e.g. using `typeof` with an imported value), consider moving that usage into a dedicated runtime module and keep the type declaration here.

Why this matters

Type-only imports prevent runtime circular imports which can cause `undefined` values at runtime and subtle bugs. Keeping types separate ensures more robust module graphs and easier reasoning about dependency direction.

If you need a short policy added to the repo README or a lint rule to enforce this, I can add a small ESLint rule or a pre-commit check as a follow-up.
