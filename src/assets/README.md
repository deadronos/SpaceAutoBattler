# assets/ - Game Assets

3D models, textures, and other game assets used in rendering.

## Asset Files

| File                    | Purpose                                  |
| ----------------------- | ---------------------------------------- |
| **planets.ts**          | Planet data and configuration loader     |
| **ships.ts**            | Ship model loader and cache manager      |
| **skysphere.ts**        | Skysphere texture and configuration      |
| **starDiskTextures.ts** | Star disk texture generation and loading |

## Subdirectories

### [gltf/](./gltf/)

3D models in GLTF/GLB format (ships, structures, etc.).

### [textures/](./textures/)

Texture images for various objects (planets, stars, effects).

### [skysphere/](./skysphere/)

Skysphere background images and assets.

## Asset Loading

Assets are loaded and cached using:

- `@react-three/drei`'s `useGLTF` for models
- `useTexture` for textures
- Custom loaders with GLTF patching
- Deterministic seeded RNG for procedural generation

## Performance Optimization

- Models cached and reused
- Textures atlased where possible
- LOD versions for distant objects
- Procedural generation for dynamic assets

## Attribution

Asset folders contain `attribution.txt` files crediting sources.
