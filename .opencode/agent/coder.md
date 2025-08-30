---
description: Produce code patches and tests for scoped tasks. Prefer producing patch artifacts rather than writing directly.
mode: subagent
model: gpt-5-mini
temperature: 0.0
prompt: "{file:./prompts/coder.txt}"
tools:
  write: false
  edit: false
  patch: true
  read: true
  grep: true
  glob: true
  webfetch: true
  bash: false
permission:
  edit: deny
  bash: deny
  webfetch: allow
policies:
  maxPatchSizeLines: 500
disable: false
---

Coder should return a structured object containing `patch` (unified diff or patch text), `baseRef` (commit/branch), `tests` (array of suggested test files) and `assumptions`.

Example output (JSON):

```
{ "patch": "--- a/src/foo.ts\n+++ b/src/foo.ts\n@@ -1,3 +1,7 @@...", "baseRef": "main@abcd123", "tests": ["test/foo.spec.ts"], "assumptions": ["..."] }
```
