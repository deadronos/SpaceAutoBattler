# Design — Renderer Performance Audit Report

## Summary

- Produce a repository-wide report that rates every source file under `src/` against pooling, caching, instancing, and adaptive performance practices.
- Capture strengths, risks, and prioritized recommendations using a repeatable evaluation rubric.
- Deliver the report as `docs/performance-report.md` with repository-standard front matter.

## Architecture Overview

```text
[Source Tree] --list--> [File Inventory]
      |                         |
      |                 +------v-------+
      |                 | Evaluation   |
      |                 | Rubric       |
      |                 +------^-------+
      |                        |
      +--> [Qualitative Notes] +--> [Ratings Table]
                                   |
                                   v
                         [Performance Report]
```

## Data Flow

1. Enumerate every `.ts`/`.tsx` file within `src/` using PowerShell (`Get-ChildItem`).
2. Review code (existing knowledge + spot checks) for pooling/caching/instancing/adaptive practices.
3. Assign a rating (`Excellent`, `Good`, `Fair`, `Poor`) using the rubric below and log supporting evidence.
4. Group findings by subsystem to surface systemic strengths and gaps.
5. Summarize recommendations ordered by impact versus effort.
6. Publish structured markdown with front matter, tables, and references.

## Interfaces

- **RatingEntry**
  - `file`: relative path (string)
  - `rating`: enum (`Excellent` | `Good` | `Fair` | `Poor`)
  - `notes`: short justification (string)
- **FindingGroup**
  - `title`: subsystem label (string)
  - `highlights`: array of summary bullets referencing files.
- **Recommendation**
  - `description`: improvement statement (string)
  - `impact`: High | Medium | Low
  - `effort`: High | Medium | Low
  - `linkedFiles`: array of paths (string[])

## Data Models

- **Rating Rubric**
  - *Excellent*: Demonstrates proactive pooling/instancing/caching with minimal per-frame allocations and adaptive hooks.
  - *Good*: Applies at least one strong optimization (instancing, memoization, Suspense) with minor gaps.
  - *Fair*: Baseline implementation; opportunities exist to reduce allocations, consolidate resources, or add adaptive controls.
  - *Poor*: Lacks expected reuse strategies and introduces avoidable per-frame work or unbounded allocations.
- **Subsystem Buckets**: Assets, Components (Environment, HUD, Combat), Game Systems, Renderer Utilities, Hooks, Config/Data, Types, Utilities, Root Entrypoints.

## Error Handling Matrix

| Scenario | Detection | Response |
| --- | --- | --- |
| File inventory misses new files | Compare report list count vs `Get-ChildItem` output | Re-run enumeration, update report table before finalizing |
| Rating evidence insufficient | Manual review notes lack examples | Re-open file, capture explicit code references in notes |
| Markdown validation failure (missing front matter) | Pre-publish lint/test | Add required YAML block and rerun check |
| Conflicting ratings across sessions | Memory/requirements mismatch | Update design doc and report to align with latest rubric |

## Testing Strategy

- Manual cross-check: verify every file in `Get-ChildItem` list appears exactly once in the ratings table.
- Self-review: ensure findings and recommendations reference real files and optimizations.
- Formatting validation: run markdown lint (if available) or visually inspect structure for compliance (YAML front matter, headings, tables).

## Open Questions

- None; scope confined to documentation deliverable.
