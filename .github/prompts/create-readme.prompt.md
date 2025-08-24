---
mode: 'agent'
description: 'Create a README.md file for the project'
---

```prompt
---
mode: 'agent'
description: 'Cookbook: generate a concise, professional README.md for the repository.'
---

Receipt: I'll generate a concise README for the specified component or the repo root.

Plan:
1) Produce a 6-section README: short description, install, run, test, usage, contribution.
2) Provide example commands and minimal troubleshooting notes.
3) Suggest one-sentence badge lines (CI/test).

Assumptions: Node.js project unless otherwise specified.

Constraints: Keep README ≤ 500 words and include copy/paste commands.

Output: Markdown README text ready to paste.

Example: For `src/renderer.js` produce usage snippet showing how to serve `ui.html` and open the page.
```
