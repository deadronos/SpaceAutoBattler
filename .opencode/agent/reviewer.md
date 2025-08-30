---
description: Read-only code reviewer focusing on security, correctness, performance and style.
mode: subagent
model: gpt-5-mini
temperature: 0.1
prompt: "{file:./prompts/reviewer.txt}"
tools:
  read: true
  grep: true
  glob: true
  bash: true
  write: false
  edit: false
  webfetch: true
permission:
  edit: deny
  bash: ask
  webfetch: allow
policies:
  requireTests: true
disable: false
---

Reviewer MUST produce a structured review object:

```json
{ "approved": true|false, "issues": [{"severity":"major|minor|suggestion","file":"...","line":123,"message":"..."}], "confidence": 0.0-1.0 }
```

If `approved:false`, reviewer should provide concrete next steps for coder.
