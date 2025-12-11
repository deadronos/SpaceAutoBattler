# components/postprocessing/ - Post-Processing Effects

Builds and configures the post-processing effects pipeline for visual enhancements.

## Files

| File                  | Purpose                                                                                    |
| --------------------- | ------------------------------------------------------------------------------------------ |
| **createComposer.ts** | Factory function that creates and configures the post-processing composer with all effects |
| **buildEffects.ts**   | Builds individual post-processing effects and pass configurations                          |

## Effects Pipeline

The post-processing pipeline includes:

- **Bloom** - Glowing light effect for bright areas
- **Chromatic Aberration** - Color channel separation effect
- **Tone Mapping** - Color grading and exposure adjustment
- **FXAA** - Fast approximate anti-aliasing

## Integration

- Post-processing is set up in Postprocessing.tsx component
- Configured via `src/config/postprocessing.ts`
- Applied to the scene after rendering
- Can be toggled on/off via settings

## Performance

- Passes are applied in optimal order
- Bloom uses selective layer registration
- Effects can be disabled individually for performance
