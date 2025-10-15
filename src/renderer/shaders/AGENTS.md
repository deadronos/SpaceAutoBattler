# Agents Guide: src/renderer/shaders

- Purpose: Source GLSL assets and small helper shaders for StarDisk, corona, and custom effects.
- Formatting: Keep shader strings in their own files and document uniform expectations and ranges in comments.
- Validation: Prefer Playwright visual baseline tests and shader unit checks in Vitest where string transforms occur.
- Performance: Keep shader branching minimal for mobile; surface fallback variants for low-end devices.
