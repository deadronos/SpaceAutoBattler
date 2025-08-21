---
mode: 'agent'
description: 'Cookbook: generate a concise, AI-friendly CI/CD workflow specification for a GitHub Actions file.'
---

Receipt: "Produce a short, structured CI/CD workflow spec for `${input:WorkflowFile}` and save as `/spec/spec-process-cicd-[workflow-name].md`."

Plan:
- Extract purpose, triggers, jobs, inputs/outputs, secrets, constraints, and failure paths.
- Render a dense, token-efficient markdown spec with sections: Overview, Jobs & Dependencies (with a tiny mermaid graph), Inputs/Outputs, Constraints, Error Handling, Quality Gates, Monitoring, Integration, Change Management.
- Return the markdown body and a recommended filename.

Assumptions:
- Keep the spec implementation-agnostic (no concrete runner commands or tool versions).
- Use tables/lists for density; mermaid only for small flow visuals.
- Keep output concise (preferably < 1200 tokens) and testable.

One-line template:
"Generate a CI/CD workflow spec for `${input:WorkflowFile}` → output `/spec/spec-process-cicd-[workflow-name].md` with Overview, Jobs, I/O, Constraints, Error Handling, Quality Gates, Monitoring."

Quick-check:
- Use consistent abbreviations and a short mermaid job-flow when helpful.
- Avoid embedding secrets or runnable shell commands.

Output format (markdown):
````md
---
title: CI/CD Workflow Specification - [Workflow Name]
version: 1.0
date_created: [YYYY-MM-DD]
owner: [Owner]
---

## Overview
- Purpose: [one-line]
- Triggers: [list]
- Targets: [environments]

## Jobs & Dependencies
- Small mermaid graph (1–8 nodes) showing job order.

| Job | Purpose | Depends on | Runner context |
|-----|---------|------------|----------------|
| build | build artifacts | — | linux/ubuntu-latest |

## Inputs / Outputs
- Inputs: env vars, path filters, secrets (list)
- Outputs: artifacts, job outputs (list)

## Constraints & Limits
- Timeouts, concurrency, resource constraints, permissions

## Error Handling
- Common failures and recovery steps (build/test/deploy)

## Quality Gates
- Code quality, security scans, test coverage thresholds

## Monitoring & Alerts
- Key metrics and alerting targets

## Change Management
- Spec-first update process, review, testing, deployment steps

````
