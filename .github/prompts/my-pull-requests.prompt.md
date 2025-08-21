---
mode: 'agent'
tools: ['githubRepo', 'github', 'get_me', 'get_pull_request', 'get_pull_request_comments', 'get_pull_request_diff', 'get_pull_request_files', 'get_pull_request_reviews', 'get_pull_request_status', 'list_pull_requests', 'request_copilot_review']
description: 'List my pull requests in the current repository'
---

Receipt: I'll list your open pull requests and their review status.

Plan:
1) Fetch open PRs authored by you.
2) For each, show Title, Branch, CI status, Review status, and next steps.
3) Output as a short actionable list.

Assumptions: Uses GitHub API.

Constraints: Limit to 10 PRs.

Output: Markdown list with PR links and concise next action per PR.

Example: "#123 feat: add XP for bullets — CI: passing, Reviews: pending — Next: address review comments"
