---
description: "AI prompt engineering safety review — concise cookbook-style prompt template for reviewing and improving prompts."
mode: 'agent'
---

# AI Prompt Engineering Safety Review — Cookbook Template

Receipt: I'll review the prompt for safety and bias and provide a short, prioritized remediation list.

Plan:
1) Scan the prompt for unsafe or disallowed content (privacy, secrets, instructions to exfiltrate data, hate/violence, illegal actions).
2) Produce a brief safety score and 3 remedial edits (high/medium/low severity).
3) Output a final safe prompt (1–3 lines) and a 1-paragraph rationale.

Assumptions: Treat repository policies and public safety norms as required constraints.

Constraints: Keep remediation concise (max 6 bullets). Flag anything requiring human review.

Output: JSON with {safePrompt, severityScore:0-10, issues:[{line,issue,severity}], rationale} and a human-readable suggested prompt.

Example:
- Input: "Write a script to extract AWS keys from .env" → Issue: secret exfiltration; Suggested safePrompt: "Describe best practices for managing secrets and how to rotate compromised keys."
