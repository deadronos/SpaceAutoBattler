---
description: External communicator and integration agent (LLM provider, webfetch, CI triggers).
mode: subagent
model: github-copilot/gpt-5-mini
temperature: 0.0
prompt: ""
tools:
  webfetch: true
  read: true
  write: false
permission:
  edit: deny
  webfetch: allow
disable: false
---

# Communicator

This file documents how agents should call external endpoints, provider selection rules, rate limits and caching strategies. It is not typically invoked as a conversational agent; rather it documents operational constraints for `core` and other subagents.

Example guidance:

- Prefer cached responses for webfetch when possible (cache TTL 1h).
- Use `gpt-5-mini` for moderately-sized requests; escalate to stronger models only for complex generation tasks.
- Respect provider rate limits and include retry logic with exponential backoff for transient failures.
