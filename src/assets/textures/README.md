# assets/textures/ - Texture Assets

Texture images for planets, stars, effects, and other visual elements.

## Texture Directories

| Directory     | Purpose                                   |
| ------------- | ----------------------------------------- |
| **planet/**   | Planetary surface textures and generation |
| **star/**     | Star and stellar object textures          |
| **gasgiant/** | Gas giant atmosphere textures             |

## Attribution

See `attribution.txt` for texture source credits and licenses.

## Texture Usage

Textures are:

- Loaded via `useTexture` hook from Drei
- Cached and pooled for performance
- Used by planet and celestial rendering
- Applied via material system
- Atlased where appropriate

## Performance

- Compressed formats used where supported
- LOD versions available for distant objects
- Mipmaps generated at load time
- Cleanup on component unmount
