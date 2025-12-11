# DESIGN004 — Tech debt reconnaissance report

Date: 2025-10-26  
Author: GitHub Copilot

Confidence: 86% — Extensive repository familiarity and existing profiling notes make the discovery pass predictable; risks centre on misclassifying actively-used compatibility shims.

## Goal

Produce a repeatable process and artefact for cataloguing legacy or redundant code paths, culminating in `docs/tech-debt-report.md` with five prioritised remediation opportunities.

## Context & Problem Statement

- The codebase still carries several compatibility shims (React 19 JSX, Miniplex API) and fallback behaviours (legacy AI steering) that increase maintenance overhead.
- Recent audits (performance, environment) improved renderer and AI subsystems, yet we lack a consolidated view of removal candidates.
- Documentation standards require full YAML front matter; failing to comply blocks publication.
- The categories master list referenced in instructions is absent, so we must re-use known good values from prior reports until maintainers supply an authoritative list.

## Scope

### In scope

- Identify five tech-debt or legacy code paths that can be retired or refactored.
- Collect file evidence and describe impact, rating (percentage), and estimated implementation effort.
- Author `docs/tech-debt-report.md` following repo markdown rules and front matter schema.
- Update Memory Bank artefacts (requirements, design, task) per spec-driven workflow.

### Out of scope

- Implementing the refactors themselves.
- Modifying runtime behaviour beyond the documentation/report.
- Updating CI/workflow scripts or removing dependencies immediately.

## Constraints & Inputs

- Markdown instructions mandate YAML front matter with fields: `post_title`, `author1`, `post_slug`, `microsoft_alias`, `featured_image`, `categories`, `tags`, `ai_note`, `summary`, `post_date`.
- Spec-driven workflow demands EARS requirements, a design record, and an implementation plan stored in Memory Bank files.
- Tooling: TypeScript/Three.js project; lint/typecheck/test scripts available via npm.
- Evidence should cite files/lines for each recommendation to support reviewer follow-up.

## Architecture

1. **Discovery stage** — Use repository search (grep/semantic) to surface legacy markers (`legacy`, `TODO`, compatibility shims, unused dependencies).
2. **Qualification stage** — For each candidate, confirm current usage, assess removal impact, and estimate effort (S/M/L mapped to hours).
3. **Reporting stage** — Assemble structured markdown sections with tables summarising rating (%), effort, rationale, and evidence links.
4. **Validation stage** — Run markdown formatting review, confirm file placement, optionally execute `npm run typecheck` and `npm test` to ensure no regressions.

## Data Flow

```text
Repository scans ──► Candidate shortlist ──► Scoring worksheet ──► Markdown report
        ▲                                                 │
        └────────────── Memory bank context ◄──────────────┘
```

## Interfaces & Contracts

- **Discovery** inputs: glob patterns, keywords (`legacy`, `TODO`, `pixi.js`), project structure. Output: candidate notes with file paths.
- **Qualification** inputs: candidate notes, git history/memory context; outputs: rating %, effort estimate, risk notes.
- **Report writer** inputs: qualified candidates, front matter metadata; output: `docs/tech-debt-report.md` abiding markdown schema.

## Data Models

```ts
interface TechDebtEntry {
  id: string; // short slug, e.g., 'legacy-ai-fallback'
  title: string;
  location: string[]; // file paths or glob patterns
  ratingPercent: number; // 0–100 severity/priority
  effort: 'S (≤0.5d)' | 'M (1–2d)' | 'L (≥3d)';
  rationale: string; // concise description of why removal helps
  remediationOutline: string; // next steps or prerequisites
}
```

## Implementation Plan (High-Level)

1. Refresh requirements and design artefacts (✅ requirements added; design is this document).
2. Create task record (TASK250) with detailed subtasks and progress tracking.
3. Perform discovery/qualification searches, document supporting notes in task log.
4. Draft `docs/tech-debt-report.md` with front matter, summary, and per-item sections.
5. Review formatting, update Memory Bank progress, and run validation commands (typecheck/tests, if feasible) prior to hand-off.

## Error Handling Matrix

| Scenario                            | Detection                                             | Response                                                                                                  | Notes                                       |
| ----------------------------------- | ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| Required front matter field omitted | Markdown validator or manual review flags missing key | Verify against checklist; update front matter before finalisation                                         | Blocker until resolved                      |
| Category taxonomy unavailable       | Unable to locate `/categories.txt`                    | Reuse previously accepted category (`engineering`) and note follow-up in report                           | Document assumption in report Notes section |
| Candidate later deemed active       | Reviewer feedback or search shows runtime dependency  | Mark as follow-up in task log, adjust rating/notes, and, if necessary, replace with alternative candidate | Maintain audit trail in Memory Bank         |
| Effort estimate uncertain           | Lack of historical data                               | Default to conservative `M` and flag for further estimation; mention dependencies                         | Ensure transparency in report               |

## Testing Strategy

- Execute `npm run typecheck` and `npm test` after documentation is committed to ensure no unexpected regressions surfaced (belt-and-suspenders despite doc-only change).
- Manual review: open the rendered markdown (VS Code preview) to verify headings and table layout.
- Cross-check each recommendation against latest `dev` branch to ensure file references remain accurate.

## Follow-Up Considerations

- Engage maintainers to confirm appetite for removing legacy AI path before scheduling work.
- Align with documentation owners to procure the authoritative categories list referenced in markdown instructions.
- Consider automating tech-debt scans (lint rules or scripts) for future iterations.
