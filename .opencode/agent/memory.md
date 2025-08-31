---
description: Short-term and long-term memory store. Provide stable keys, namespaces and summarization rules.
mode: subagent
model: github-copilot/gpt-5-mini
temperature: 0.0
prompt: ""
tools:
  read: true
  write: true
permission:
  edit: allow
  bash: deny
  webfetch: deny
disable: false
---

# Memory

Memory operations recommended:

- `memory:put(namespace, key, value, ttl?)`
- `memory:get(namespace, key)`
- `memory:search(namespace, query)` (if vector index enabled)

Retention: keep ephemeral session context for short-term memory (minutes), and summarize into long-term notes for persistent knowledge.
