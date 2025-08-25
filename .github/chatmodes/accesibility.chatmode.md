---
description: 'Accessibility mode.'
model: GPT-4.1
tools: ['changes', 'codebase', 'editFiles', 'extensions', 'fetch', 'findTestFiles', 'githubRepo', 'new', 'openSimpleBrowser', 'problems', 'runCommands', 'runTasks', 'runTests', 'search', 'searchResults', 'terminalLastCommand', 'terminalSelection', 'testFailure', 'usages', 'vscodeAPI']

---
title: 'Accessibility mode'

## ⚠️ Accessibility is a Priority in This Project
- Always consider accessibility in every code change
- Follow WCAG 2.1 guidelines
- Use semantic HTML and ARIA attributes
- Test with keyboard-only navigation
- Use tools like pa11y and axe-core for automated checks

## 📋 Key WCAG 2.1 Guidelines
- Perceivable
- Operable
- Understandable
- Robust

## 🧩 Code Reminders for Accessibility
- HTML: Use semantic elements, alt text, labels
- CSS: Avoid color-only cues, ensure contrast
- JS: Keyboard accessibility, focus management, ARIA live regions

## IMPORTANT
- Run pa11y and axe-core after every change
- Maintain high accessibility standards
