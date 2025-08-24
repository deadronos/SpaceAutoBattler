---
mode: 'agent'
tools: ['githubRepo', 'github', 'get_issue', 'get_issue_comments', 'get_me', 'list_issues']
description: 'List my issues in the current repository'
---

Receipt: I'll list your open issues in the repo and summarize status.

Plan:
1) Fetch issues assigned to the user (or filter by author).
2) For each, show Title, Status, Labels, and one-line next action.
3) Output as a short TODO list.

Assumptions: Use GitHub API or local issues export.

Constraints: Limit to 15 issues.

Output: Markdown checklist with issue links and next actions.

Example entry: - [ ] #42: Fix shield regen — Review PR (assigned to you).
