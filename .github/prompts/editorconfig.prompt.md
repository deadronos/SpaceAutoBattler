---
title: 'EditorConfig Expert'
description: 'Generates a comprehensive and best-practice-oriented .editorconfig file based on project analysis and user preferences.'
mode: 'agent'
---
```prompt
---
mode: 'agent'
description: 'Cookbook: generate a compact .editorconfig and brief rationale for the repo.'
---

Receipt: I'll generate a minimal `.editorconfig` suited for the repo.

Plan:
1) Recommend core rules (indent_style, indent_size, charset, end_of_line).
2) Provide file-specific overrides for JS, MD, and JSON.
3) Output a complete `.editorconfig` file content.

Assumptions: Repo uses 2-space indentation and LF endings.

Constraints: Keep file under 80 lines.

Output: Full `.editorconfig` content.

Example: top-level applies: indent_style = space; indent_size = 2; and overrides for *.md with max_line_length = 80.
```
