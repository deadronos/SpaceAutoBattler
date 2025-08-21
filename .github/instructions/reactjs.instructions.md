---
description: 'ReactJS development standards and best practices'
applyTo: '**/*.jsx, **/*.tsx, **/*.js, **/*.ts, **/*.css, **/*.scss'
---

# ReactJS Development Instructions

Instructions for building high-quality ReactJS applications with modern patterns, hooks, and best practices following the official React documentation at https://react.dev.

## Project Context
- Latest React version (React 19+)
- TypeScript for type safety (when applicable)
- Functional components with hooks as default
- Follow React's official style guide and best practices
- Use modern build tools (Vite, Create React App, or custom Webpack setup)
- Implement proper component composition and reusability patterns

## Development Standards

### Architecture
- Use functional components with hooks as the primary pattern
- Implement component composition over inheritance
- Organize components by feature or domain for scalability
- Separate presentational and container components clearly
- Use custom hooks for reusable stateful logic
- Implement proper component hierarchies with clear data flow

### TypeScript Integration
- Use TypeScript interfaces for props, state, and component definitions
- Define proper types for event handlers and refs
- Implement generic components where appropriate
- Use strict mode in `tsconfig.json` for type safety
- Leverage React's built-in types (`React.FC`, `React.ComponentProps`, etc.)
- Create union types for component variants and states

### Component Design
- Follow the single responsibility principle for components
- Use descriptive and consistent naming conventions
---
description: 'React cookbook: one-line receipt, short plan, small component & hook templates, and a short checklist.'
applyTo: '**/*.jsx, **/*.tsx, **/*.js, **/*.ts'
---

# React — Quick Guide

Receipt: "Implement a small React feature/component — plan: props, state, effects, test."

Plan (4 steps):
1) Define API (props & types). 2) Implement UI as a small functional component. 3) Add hooks for logic (custom hook if reusable). 4) Add tests (RTL unit + behavior). 

Core rules (short):
- Use functional components + hooks.  
- Keep components single-responsibility and small.  
- Prefer composition over inheritance.  
- Use TypeScript types for public APIs where present.  
- Test user behavior (not implementation details).

Minimal component template (TS):
import React from 'react';

type Props = { title: string; onClick?: () => void };
export function SmallCard({ title, onClick }: Props) {
	return (
		<article>
			<h3>{title}</h3>
			<button onClick={onClick}>Action</button>
		</article>
	);
}

Minimal hook template:
import { useState, useEffect } from 'react';
export function useCounter(initial = 0) {
	const [count, setCount] = useState(initial);
	useEffect(() => { /* side-effects */ }, [count]);
	return { count, inc: () => setCount(c => c + 1) };
}

Testing checklist before PR:
- [ ] Prop types / interfaces defined.  
- [ ] Behavior tested (RTL): render, user event, assertion.  
- [ ] No unnecessary re-renders (memoize if measurable).  
- [ ] Accessibility: semantic HTML + keyboard focus + alt text.  
- [ ] Styles scoped and responsive.

End.
- Implement fallback UI for error scenarios
