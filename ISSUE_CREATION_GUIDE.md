# Issue Creation Guide - Performance Review v2.0.5g Follow-ups

This guide provides the information needed to create GitHub issues for the follow-up tasks identified in the performance review.

## Quick Links

- Performance Review: [docs/performance-review-v2.0.5g.md](docs/performance-review-v2.0.5g.md)
- Issue Templates: [.github/issues-to-create/](.github/issues-to-create/)
- Task Details: [memory/tasks/TASK158-160-\*.md](memory/tasks/)

## Issues to Create

### 1. Enable Server Compression for Deployment 🔥 HIGH PRIORITY

**Labels**: `performance`, `enhancement`, `priority: high`

**Summary**: Enable gzip/brotli compression on deployment server to reduce bundle size by 60-70%.

**Key Points**:

- Current bundle: 6.64 MiB uncompressed → ~2 MiB compressed
- Highest ROI optimization from performance review
- Low effort, high impact

**Template**: `.github/issues-to-create/issue-server-compression.md`

---

### 2. Implement Progressive Texture Loading 🔥 HIGH PRIORITY

**Labels**: `performance`, `enhancement`, `priority: high`, `ux`

**Summary**: Implement progressive texture loading to improve initial load time by 3-5 seconds.

**Key Points**:

- Load low-res textures first, stream high-res in background
- Significant UX improvement for initial load
- Medium effort, high impact

**Template**: `.github/issues-to-create/issue-progressive-textures.md`

---

### 3. Replace Math.random() in ParticleTrails

**Labels**: `code-quality`, `determinism`, `priority: low`

**Summary**: Replace `Math.random()` usage with `SeededRng` to maintain determinism and replay consistency.

**Key Points**:

- Maintains determinism guarantees
- Minor allocation improvements
- Low effort, code quality improvement

**Template**: `.github/issues-to-create/issue-particle-trail-determinism.md`

---

## How to Create Issues

### Option 1: Manual Creation (Recommended if gh CLI not available)

For each issue:

1. Go to: https://github.com/deadronos/SpaceAutoBattler/issues/new
2. Open the corresponding template file in `.github/issues-to-create/`
3. Copy the title from the frontmatter
4. Copy the body content (everything after the second `---`)
5. Add the labels specified in the frontmatter
6. Click "Submit new issue"

### Option 2: Using GitHub CLI (if available)

```bash
cd .github/issues-to-create/

# Issue 1: Server Compression
gh issue create \
  --title "Enable Server Compression for Deployment" \
  --body-file issue-server-compression.md \
  --label "performance,enhancement,priority: high"

# Issue 2: Progressive Textures
gh issue create \
  --title "Implement Progressive Texture Loading" \
  --body-file issue-progressive-textures.md \
  --label "performance,enhancement,priority: high,ux"

# Issue 3: Particle Trail Determinism
gh issue create \
  --title "Replace Math.random() in ParticleTrails for Determinism" \
  --body-file issue-particle-trail-determinism.md \
  --label "code-quality,determinism,priority: low"
```

### Option 3: Using GitHub API

```bash
# Set your GitHub token
export GITHUB_TOKEN="your_token_here"

# Create each issue using curl
curl -X POST \
  -H "Authorization: token $GITHUB_TOKEN" \
  -H "Accept: application/vnd.github.v3+json" \
  https://api.github.com/repos/deadronos/SpaceAutoBattler/issues \
  -d @issue-data.json
```

## After Creating Issues

1. Link issues to performance review PR
2. Update task files in `memory/tasks/` with issue numbers
3. Consider adding issues to project board or milestone
4. Prioritize based on labels:
   - **High Priority**: Server compression, Progressive textures
   - **Low Priority**: Particle trail determinism

## Related Documentation

- **Full Performance Review**: `docs/performance-review-v2.0.5g.md`
- **Executive Summary**: `PERFORMANCE_REVIEW_SUMMARY.md`
- **Task Details**:
  - `memory/tasks/TASK158-enable-server-compression.md`
  - `memory/tasks/TASK159-progressive-texture-loading.md`
  - `memory/tasks/TASK160-particle-trail-determinism.md`

---

**Note**: These issues were identified in the comprehensive performance review of v2.0.5g completed on 2025-12-21. All performance metrics passed with healthy margins, and these are optimization opportunities for future iterations.
