---
mode: agent
description: 'Website exploration for testing using Playwright MCP'
tools: ['changes', 'codebase', 'editFiles', 'fetch', 'findTestFiles', 'problems', 'runCommands', 'runTasks', 'runTests', 'search', 'searchResults', 'terminalLastCommand', 'terminalSelection', 'testFailure', 'playwright']
model: 'Claude Sonnet 4'
---

# Website Exploration for Testing

Your goal is to explore the website and identify key functionalities.

## Specific Instructions

1. Navigate to the provided URL using the Playwright MCP Server. If no URL is provided, ask the user to provide one.
2. Identify and interact with 3-5 core features or user flows.
3. Document the user interactions, relevant UI elements (and their locators), and the expected outcomes.
4. Close the browser context upon completion.
5. Provide a concise summary of your findings.
6. Propose and generate test cases based on the exploration.

Receipt: I'll create an exploratory Playwright script to find key pages and assert accessible roles.

Plan:
1) Crawl provided base URL for main routes (home, /login, /standalone) and capture titles.
2) For each route capture accessibility snapshot of `main` and list missing roles.
3) Output a report with pages, accessibility issues, and suggested selectors for tests.

Assumptions: Base site is locally served and accessible.

Constraints: Keep steps safe (no destructive actions) and limit to 10 pages.

Output: Markdown report and suggested Playwright test skeletons.

Example: Found `/standalone` — missing role on main; suggested selector: `getByRole('main')`.
