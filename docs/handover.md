---
post_title: "Star Disk Fill Tuning Notes"
author1: "GitHub Copilot"
post_slug: "star-disk-fill-tuning"
microsoft_alias: "copilot"
featured_image: "https://example.com/star-disk-fill.png"
categories:
  - rendering
tags:
  - star-disk
  - shader
  - bloom
ai_note: "Drafted with GitHub Copilot assistance."
summary: "Practical tuning guidance for filling the star disk corona without overexposing the core."
post_date: 2025-09-26
---

<!-- markdownlint-disable-next-line MD041 -->
## Context

The fiery preset in `src/config/environment.ts` leaves a visible hollow between the white-hot core and the outer corona. Art direction asked how to thicken the disc without writing new code. This note distills the shader controls exposed through `starDisk.shader` so future handoffs can retune the look quickly.

## Controls that Expand the Disc

| Parameter | Location | Recommended Adjustment | Caveats |
| --- | --- | --- | --- |
| `baseFillStrength` | `starDisk.shader` | Raise toward `0.30–0.45` | Dominant control for mid-disc energy; too high can mute core contrast. |
| `coronaEdgeSoftness` | `starDisk.shader` | Lower to `0.30–0.35` | Softens rim falloff so wisps persist farther out; keep above `0.2` to avoid overbloom. |
| `textureRadialPower` | `starDisk.shader` | Lower to `0.35–0.40` | Pushes organic detail toward the outer disc; values `<0.3` smear the hotspot. |
| `coronaStrength` & `coronaIntensity` | `starDisk.shader` | Increase by ~`0.2` each | Thickens wispy layers; rebalance `coreStrength` to prevent washout. |
| `rimStrength` | `starDisk.shader` | Raise to `1.6–1.8` | Extends the bright ring that visually fills the mid-region. |
| `coreRadiusOuter` | `starDisk.shader` | Bump up ~`+0.05` | Expands the hotspot boundary so fill can blend smoothly. |
| `alphaStrength` | `starDisk.shader` | Increase slightly (`+0.05`) | Ensures denser fill survives the alpha discard threshold. |

## Recommended Tuning Workflow

1. Start with `baseFillStrength` adjustments in increments of `0.05`. This yields the fastest perceived fill gain.
2. Pair lower `coronaEdgeSoftness` with reduced `textureRadialPower` so the enhanced wisps actually reach the mid disc.
3. After each step, check the histogram in the selective bloom debug view; if the core clips, counter-adjust `coreStrength` (`2.6 → 2.2`) or tighten `coreTightness`.
4. Once the silhouette looks solid, nudge `coronaStrength`/`coronaIntensity` to taste and revisit `rimStrength` for balance.
5. Finish by boosting `alphaStrength` only if pixels near the rim disappear after bloom compositing.

## Validation Checklist

- Capture before/after screenshots under the same camera to confirm fuller disc coverage.
- Verify `npm run typecheck` and `npm test` still pass after any config changes.
- Review the selective bloom report to ensure overall exposure remains within the current post-processing thresholds.
- Document final parameter values in `memory/design-star-disk-shader.md` so subsequent iterations retain provenance.
