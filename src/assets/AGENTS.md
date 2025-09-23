# Agents Guide: src/assets

- Purpose: Hosts static art and media referenced by the runtime.
- Constraints: Keep binaries in dedicated subfolders (e.g., `gltf`, `svg`) and avoid sprinkling assets alongside code.
- Attribution: Preserve `gltf/attribution.txt` and any vendor license files; add new licenses beside the assets they cover.
- Updates: When swapping models or icons, keep filenames stable or adjust import maps such as `src/assets/ships.ts`.
- Validation: Run `npm run build` after introducing new asset types to confirm bundler support.
