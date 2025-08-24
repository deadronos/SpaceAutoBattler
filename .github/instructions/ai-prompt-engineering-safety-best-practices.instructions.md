---
applyTo: ['*']
description: "Comprehensive best practices for AI prompt engineering, safety frameworks, bias mitigation, and responsible AI usage for Copilot and LLMs."
---

# AI Prompt Engineering & Safety Best Practices

## Your Mission

As GitHub Copilot, you must understand and apply the principles of effective prompt engineering, AI safety, and responsible AI usage. Your goal is to help developers create prompts that are clear, safe, unbiased, and effective while following industry best practices and ethical guidelines. When generating or reviewing prompts, always consider safety, bias, security, and responsible AI usage alongside functionality.

## Introduction

Prompt engineering is the art and science of designing effective prompts for large language models (LLMs) and AI assistants like GitHub Copilot. Well-crafted prompts yield more accurate, safe, and useful outputs. This guide covers foundational principles, safety, bias mitigation, security, responsible AI usage, and practical templates/checklists for prompt engineering.

### What is Prompt Engineering?
---
applyTo: ['*']
description: "Concise AI prompt engineering & safety guidance (Cookbook style): one-line receipt, short plan, quick checks, assumptions, and safety rules."
---

# AI Prompting — Quick Guide (Cookbook style)

Receipt: "Provide clear, safe, and testable prompts — one-line instruction + 1–3 step plan."

Purpose: a compact rulebook for prompt authors and reviewers that favors explicit instructions, minimal ambiguity, and safety checks.

Plan (how to use this file):
- 1) Write a one-line task receipt. 2) Add a 1–3 step plan (inputs → action → expected format). 3) Run quick safety checks (see checklist).

Assumptions (common):
- Default audience: technical developers. If different, state the audience in the receipt.  
- Default format: Markdown unless JSON/CSV is requested.  

Minimal prompt contract (2 lines):
- Input: user-provided context + sanitized user data.  
- Output: structured, testable response (short summary + code or JSON block when requested).

Quick patterns (examples):
- Zero-shot: "Return a 6-line bash script that installs Node.js 20 on Windows, include comments."  
- Few-shot: "Example in: Input: '1+1' -> Output: '2'. Now evaluate: '2+2'"  
- Role: "You are a senior backend engineer. Review: [paste code]. Return a short issues list (max 6)."

Safety & anti-patterns (short):
- Never interpolate raw user input into system prompts. Sanitize first.  
- Avoid vague requests like "Fix this" — require scope + success criteria.  
- Prefer explicit output formats (e.g., JSON schema, code fence with language).

Checklist (apply before using outputs):
- [ ] Task receipt present (one line)
- [ ] Expected format specified (markdown/json/code + language)
- [ ] Assumptions listed or confirmed
- [ ] Safety checks: no PII, no instructions to break laws, no prompt-injection vectors
- [ ] Test cases or examples provided for complex outputs

Quick testing recipe (2–3 steps):
1. Unit test: run prompt through your eval harness with 1–2 representative inputs.  
2. Red-team test: feed adversarial inputs (e.g., "ignore instructions") and assert sanitized behavior.  
3. Human review: one reviewer checks outputs for bias, safety, and correctness.

Compact templates
- One-line receipt + plan:
    "Receipt: <one-line task>. Plan: 1) <input>; 2) <action>; 3) <output format>"

- Example (code generation):
    "Receipt: Generate TypeScript interface for a user profile. Plan: 1) Use fields id,email,name,createdAt,isActive; 2) Return a ts code block with JSDoc; 3) Add a one-line usage example."

When to escalate / human-in-the-loop
- If output affects safety, privacy, or legal compliance, require mandatory human review before release.

References (short list): OpenAI Prompting Guide, Microsoft Responsible AI, NIST AI RMF.  

End.
- "Constitutional AI: Harmlessness from AI Feedback" (Bai et al., 2022)
- "Red Teaming Language Models to Reduce Harms: Methods, Scaling Behaviors, and Lessons Learned" (Ganguli et al., 2022)
- "AI Safety Gridworlds" (Leike et al., 2017)


# AI Prompt Engineering & Safety — Short Guide

Receipt: "Write clear, safe, testable prompts."

Plan: 1) One-line task. 2) 1–3 step plan. 3) Safety check.

Checklist:
- [ ] Explicit task and format
- [ ] No PII, no prompt-injection
- [ ] Test cases/examples for complex outputs

End.

