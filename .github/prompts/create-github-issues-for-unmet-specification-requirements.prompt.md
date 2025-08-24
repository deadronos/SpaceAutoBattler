---
```prompt
---
mode: 'agent'
description: 'Cookbook: detect unmet spec requirements and produce issue payloads (one per unmet requirement) using feature_request template.'
---

Receipt: I'll extract unmet requirements from the spec and convert each into a GitHub issue.

Plan:
1) List every EARS requirement that is not implemented or lacks tests.
2) For each unmet requirement produce an issue Title, Acceptance, and Priority.
3) Output as Markdown ready for GitHub.

Assumptions: Spec uses EARS-style requirements.

Constraints: Limit output to top 10 unmet items.

Example: If the spec requires 'WHEN ship HP reaches 0, THE SYSTEM SHALL emit explosion', produce an issue to implement explosion events and tests.

```
