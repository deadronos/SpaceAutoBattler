---
mode: agent
description: 'Generate a Playwright test based on a scenario using Playwright MCP'
tools: ['changes', 'codebase', 'editFiles', 'fetch', 'findTestFiles', 'problems', 'runCommands', 'runTasks', 'runTests', 'search', 'searchResults', 'terminalLastCommand', 'terminalSelection', 'testFailure', 'playwright']
model: 'Claude Sonnet 4'
---

# Test Generation with Playwright MCP

Your goal is to generate a Playwright test based on the provided scenario after completing all prescribed steps.

## Specific Instructions

- You are given a scenario, and you need to generate a playwright test for it. If the user does not provide a scenario, you will ask them to provide one.
- DO NOT generate test code prematurely or based solely on the scenario without completing all prescribed steps.
- DO run steps one by one using the tools provided by the Playwright MCP.
- Only after all steps are completed, emit a Playwright TypeScript test that uses `@playwright/test` based on message history
- Save generated test file in the tests directory
- Execute the test file and iterate until the test passes

## Receipt: I'll generate a resilient Playwright test for the requested feature.

### Plan:
1) Use role-based locators, `test.step()`, and web-first auto-retrying assertions.
2) Provide setup `beforeEach` navigation and any fixture logic.
3) Output a complete `.spec.ts` file and short explanation of assertions.

### Assumptions: The target page is reachable and uses semantic HTML.

### Constraints: Keep test < 150 lines and recommend `toHaveURL`, `toHaveText`, `toHaveCount` assertions.

### Output: Full TypeScript Playwright test content with steps and comments.

### Example: Scenario: Search for ship — open page, type 'Garfield' in search input (role=textbox name='Search Input'), press Enter, assert results contain 'Garfield'.
