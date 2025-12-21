# Issues to Create

This directory contains issue templates that should be created in the GitHub repository.

## How to Create These Issues

You can create these issues manually through the GitHub web interface, or use the GitHub CLI:

```bash
# For each issue file, run:
gh issue create --title "$(grep '^title:' issue-file.md | cut -d: -f2-)" \
  --body "$(sed '1,/^---$/d' issue-file.md | sed '1,/^---$/d')" \
  --label "$(grep '^labels:' issue-file.md | cut -d: -f2- | tr -d '[]"' | tr ',' '\n' | xargs)"
```

Or create them manually:
1. Go to https://github.com/deadronos/SpaceAutoBattler/issues/new
2. Copy the title and body from each issue file
3. Add the specified labels

## Issues in This Directory

1. **issue-server-compression.md** - Enable server compression for 60-70% bundle size reduction (High Priority)
2. **issue-progressive-textures.md** - Implement progressive texture loading for 3-5s faster load (High Priority)
3. **issue-particle-trail-determinism.md** - Replace Math.random() in ParticleTrails (Low Priority)

All issues are from the performance review v2.0.5g.
