---
description: 'Automate filling in a form using Playwright MCP'
mode: agent
tools: ['playwright']
model: 'Claude Sonnet 4'
---

# Automating Filling in a Form with Playwright MCP

Your goal is to automate the process of filling in a form using Playwright MCP.

## Specific Instructions

Navigate to https://forms.microsoft.com/url-of-my-form

### Fill in the form with the following details:

1. Show: playwright live

2. Date: 15 July

3. Time: 1:00 AM

4. Topic: Playwright Live - Latest updates on Playwright MCP + Live Demo

5. Upload image: /Users/myuserName/Downloads/my-image.png

DO NOT SUBMIT THE FORM. 

Ask for a review of the form before submitting it.

---

Receipt: I'll generate a Playwright test that fills and submits a form following accessibility-first locators.

Plan:
1) Use `getByRole` and `getByLabel` locators where possible.
2) Add `test.step()` grouping and assertions for success states.
3) Provide retries and avoid fixed sleeps.

Assumptions: Test runs with Playwright TS in this repo's config.

Constraints: Provide test file ≤ 120 lines; include setup `beforeEach` navigation.

Output: Full TS test file content with comments and brief explanation.

Example: Fill login form and assert `toHaveURL('/dashboard')` and `main` contains username.
